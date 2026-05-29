const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'into', 'your', 'you', 'are', 'how',
  '一个', '这个', '那个', '怎么', '如何', '什么', '以及', '或者', '可以', '需要', '进行', '使用',
]);

export function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase();
  const latin = normalized.match(/[a-z0-9_#.-]{2,}/g) || [];
  const cjk = normalized.match(/[\u4e00-\u9fff]{2,}/g) || [];
  const cjkBigrams = cjk.flatMap(chunk => {
    if (chunk.length <= 4) return [chunk];
    const parts: string[] = [];
    for (let index = 0; index < chunk.length - 1; index += 1) {
      parts.push(chunk.slice(index, index + 2));
    }
    return parts;
  });
  return Array.from(new Set([...latin, ...cjk, ...cjkBigrams]
    .map(item => item.trim())
    .filter(item => item.length >= 2 && !STOP_WORDS.has(item))));
}

function termFrequency(keywords: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  keywords.forEach(keyword => counts.set(keyword, (counts.get(keyword) || 0) + 1));
  return counts;
}

export function scoreText(query: string, text: string): number {
  return ragScore(query, text);
}

export function ragScore(query: string, text: string): number {
  const queryKeywords = extractKeywords(query);
  const docKeywords = extractKeywords(text);
  if (queryKeywords.length === 0 || docKeywords.length === 0) return 0;

  const queryTerms = termFrequency(queryKeywords);
  const docTerms = termFrequency(docKeywords);
  const docLength = Math.max(1, docKeywords.length);
  const rawText = text.toLowerCase();
  let score = 0;

  queryTerms.forEach((queryTf, term) => {
    const docTf = docTerms.get(term) || (rawText.includes(term) ? 1 : 0);
    if (docTf === 0) return;
    const tf = docTf / (docTf + 1.2 + 0.75 * docLength / 100);
    score += (1 + Math.log(queryTf)) * tf;
  });

  const queryPhrase = query.trim().toLowerCase();
  if (queryPhrase.length >= 4 && rawText.includes(queryPhrase)) {
    score += 2;
  }
  return score;
}

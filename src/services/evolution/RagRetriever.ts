import { ragScore } from './MemoryPolicy';

export interface RagCandidate<T> {
  item: T;
  text: string;
  updatedAt?: number;
  boost?: number;
}

export interface RagRanked<T> {
  item: T;
  score: number;
}

export function ragRank<T>(
  query: string,
  candidates: RagCandidate<T>[],
  options: { limit?: number; now?: number } = {},
): RagRanked<T>[] {
  const now = options.now || Date.now();
  const ranked = candidates
    .map(candidate => {
      const baseScore = ragScore(query, candidate.text);
      const ageDays = candidate.updatedAt ? Math.max(0, (now - candidate.updatedAt) / 86_400_000) : 30;
      const recencyBoost = candidate.updatedAt ? 1 / (1 + ageDays / 30) : 0;
      const score = baseScore + recencyBoost * 0.15 + (candidate.boost || 0);
      return { item: candidate.item, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, options.limit ?? ranked.length);
}

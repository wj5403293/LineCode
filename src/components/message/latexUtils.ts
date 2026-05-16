const OUTER_DELIMITERS: Array<[string, string]> = [
  ['$$', '$$'],
  ['\\[', '\\]'],
  ['\\(', '\\)'],
];

function stripOuterDelimiters(value: string): string {
  for (const [open, close] of OUTER_DELIMITERS) {
    if (value.startsWith(open) && value.endsWith(close)) {
      return value.slice(open.length, value.length - close.length).trim();
    }
  }
  return value;
}

export function normalizeLatexSource(source: string): string {
  const stripped = stripOuterDelimiters(source.trim().replace(/\r\n?/g, '\n'));

  return stripped
    .replace(/\\(?:,|;|:|!)/g, ' ')
    .replace(/\\(?:quad|qquad)\b/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

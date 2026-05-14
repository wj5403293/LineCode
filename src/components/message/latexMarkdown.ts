const MarkdownIt = require('markdown-it');

const BACKSLASH = 0x5c;
const DOLLAR = 0x24;

function isEscaped(src: string, pos: number): boolean {
  let count = 0;
  for (let i = pos - 1; i >= 0 && src.charCodeAt(i) === BACKSLASH; i--) {
    count++;
  }
  return count % 2 === 1;
}

function isWhitespace(value?: string): boolean {
  return !value || /\s/.test(value);
}

function findClosingMarker(src: string, marker: string, from: number): number {
  let pos = from;
  while (pos < src.length) {
    const match = src.indexOf(marker, pos);
    if (match === -1) return -1;
    if (!isEscaped(src, match)) return match;
    pos = match + marker.length;
  }
  return -1;
}

function findClosingDollar(src: string, from: number): number {
  let pos = from;
  while (pos < src.length) {
    const match = src.indexOf('$', pos);
    if (match === -1) return -1;
    const prev = src[match - 1];
    const next = src[match + 1];
    if (
      !isEscaped(src, match) &&
      next !== '$' &&
      !isWhitespace(prev) &&
      !(next && /\d/.test(next))
    ) {
      return match;
    }
    pos = match + 1;
  }
  return -1;
}

function pushLatexToken(
  state: any,
  type: 'latex_inline' | 'latex_block',
  markup: string,
  content: string,
  block: boolean,
) {
  const token = state.push(type, 'math', 0);
  token.content = content.trim();
  token.markup = markup;
  token.block = block;
}

function latexInlineRule(state: any, silent: boolean): boolean {
  const { src, pos, posMax } = state;

  if (src.charCodeAt(pos) === BACKSLASH && !isEscaped(src, pos)) {
    const next = src[pos + 1];
    if (next === '(') {
      const close = findClosingMarker(src, '\\)', pos + 2);
      if (close === -1 || close >= posMax) return false;
      if (!silent) {
        pushLatexToken(state, 'latex_inline', '\\(', src.slice(pos + 2, close), false);
      }
      state.pos = close + 2;
      return true;
    }

    if (next === '[') {
      const close = findClosingMarker(src, '\\]', pos + 2);
      if (close === -1 || close >= posMax) return false;
      if (!silent) {
        pushLatexToken(state, 'latex_block', '\\[', src.slice(pos + 2, close), true);
      }
      state.pos = close + 2;
      return true;
    }
  }

  if (src.charCodeAt(pos) !== DOLLAR || isEscaped(src, pos)) {
    return false;
  }

  if (src.charCodeAt(pos + 1) === DOLLAR) {
    const close = findClosingMarker(src, '$$', pos + 2);
    if (close === -1 || close >= posMax) return false;
    if (!silent) {
      pushLatexToken(state, 'latex_block', '$$', src.slice(pos + 2, close), true);
    }
    state.pos = close + 2;
    return true;
  }

  if (isWhitespace(src[pos + 1])) return false;

  const close = findClosingDollar(src, pos + 1);
  if (close === -1 || close >= posMax) return false;

  if (!silent) {
    pushLatexToken(state, 'latex_inline', '$', src.slice(pos + 1, close), false);
  }
  state.pos = close + 1;
  return true;
}

function getLine(state: any, line: number): string {
  const start = state.bMarks[line] + state.tShift[line];
  const end = state.eMarks[line];
  return state.src.slice(start, end);
}

function latexBlockRule(state: any, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;

  const firstLine = getLine(state, startLine);
  const markup = firstLine.startsWith('$$') ? '$$' : firstLine.startsWith('\\[') ? '\\[' : null;
  if (!markup) return false;

  const closeMarkup = markup === '$$' ? '$$' : '\\]';
  const openLength = markup.length;
  const firstContent = firstLine.slice(openLength);
  const sameLineClose = findClosingMarker(firstContent, closeMarkup, 0);
  let content = '';
  let nextLine = startLine;

  if (sameLineClose > 0) {
    content = firstContent.slice(0, sameLineClose);
  } else {
    const lines: string[] = [];
    if (firstContent.trim()) lines.push(firstContent);

    let found = false;
    for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
      const line = getLine(state, nextLine);
      const close = findClosingMarker(line, closeMarkup, 0);
      if (close !== -1) {
        lines.push(line.slice(0, close));
        found = true;
        break;
      }
      lines.push(line);
    }

    if (!found) return false;
    content = lines.join('\n');
  }

  if (!content.trim()) return false;
  if (silent) return true;

  pushLatexToken(state, 'latex_block', markup, content, true);
  state.line = nextLine + 1;
  return true;
}

function latexMarkdownPlugin(md: any) {
  md.inline.ruler.before('escape', 'latex_inline', latexInlineRule);
  md.block.ruler.before('fence', 'latex_block', latexBlockRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
}

export const latexMarkdownIt = MarkdownIt({ typographer: true }).use(latexMarkdownPlugin);

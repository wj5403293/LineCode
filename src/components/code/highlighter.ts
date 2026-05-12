import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import type { SyntaxColors } from '../../theme';

const LANGUAGES: [string, any][] = [
  ['javascript', javascript], ['js', javascript],
  ['typescript', typescript], ['ts', typescript],
  ['python', python], ['py', python],
  ['java', java],
  ['cpp', cpp], ['c++', cpp],
  ['csharp', csharp], ['cs', csharp],
  ['go', go],
  ['rust', rust],
  ['bash', bash], ['sh', bash], ['shell', bash],
  ['json', json],
  ['xml', xml], ['html', xml],
  ['css', css],
  ['sql', sql],
  ['yaml', yaml], ['yml', yaml],
  ['markdown', markdown], ['md', markdown],
];

for (const [name, lang] of LANGUAGES) {
  hljs.registerLanguage(name, lang);
}

export function parseHighlightedHTML(
  html: string,
  tokenColors: Record<string, string>,
): Array<{ text: string; color: string }> {
  const tokens: Array<{ text: string; color: string }> = [];
  const regex = /<span class="hljs-([^"]+)">(.*?)<\/span>|([^<]+)/g;
  let match;

  while ((match = regex.exec(html)) !== null) {
    if (match[1]) {
      tokens.push({
        text: match[2].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
        color: tokenColors[match[1]] || tokenColors.default,
      });
    } else if (match[3]) {
      tokens.push({
        text: match[3].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'),
        color: tokenColors.default,
      });
    }
  }

  return tokens;
}

export function highlight(
  code: string,
  tokenColors: Record<string, string>,
  language?: string,
): Array<Array<{ text: string; color: string }>> {
  try {
    const result = language
      ? hljs.highlight(code, { language })
      : hljs.highlightAuto(code);

    const htmlLines = result.value.split('\n');
    return htmlLines.map(line => parseHighlightedHTML(line, tokenColors));
  } catch {
    return code.split('\n').map(line => [{ text: line, color: tokenColors.default }]);
  }
}

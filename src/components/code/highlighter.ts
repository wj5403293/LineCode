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

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(?:lt|gt|amp|quot|apos|nbsp|#39|#x27|#x2f);/gi, entity => {
    switch (entity.toLowerCase()) {
      case '&lt;':
        return '<';
      case '&gt;':
        return '>';
      case '&amp;':
        return '&';
      case '&quot;':
        return '"';
      case '&apos;':
      case '&#39;':
      case '&#x27;':
        return "'";
      case '&nbsp;':
        return ' ';
      case '&#x2f;':
        return '/';
      default:
        return entity;
    }
  });
}

export function parseHighlightedHTML(
  html: string,
  tokenColors: Record<string, string>,
): Array<{ text: string; color: string }> {
  const tokens: Array<{ text: string; color: string }> = [];
  const colorStack: string[] = [tokenColors.default];
  let cursor = 0;

  const pushText = (value: string) => {
    if (!value) return;
    const text = decodeHtmlEntities(value);
    if (!text) return;
    const color = colorStack[colorStack.length - 1] || tokenColors.default;
    const previous = tokens[tokens.length - 1];
    if (previous?.color === color) {
      previous.text += text;
      return;
    }
    tokens.push({ text, color });
  };

  while (cursor < html.length) {
    const tagStart = html.indexOf('<', cursor);
    if (tagStart === -1) {
      pushText(html.slice(cursor));
      break;
    }

    pushText(html.slice(cursor, tagStart));

    const tagEnd = html.indexOf('>', tagStart + 1);
    if (tagEnd === -1) {
      pushText(html.slice(tagStart));
      break;
    }

    const tag = html.slice(tagStart + 1, tagEnd).trim();
    if (/^span\b/i.test(tag)) {
      colorStack.push(colorForSpanTag(tag, tokenColors, colorStack[colorStack.length - 1]));
    } else if (/^\/span\b/i.test(tag) && colorStack.length > 1) {
      colorStack.pop();
    }

    cursor = tagEnd + 1;
  }

  return tokens;
}

function colorForSpanTag(
  tag: string,
  tokenColors: Record<string, string>,
  fallback: string,
): string {
  const classMatch = tag.match(/\bclass=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  const classValue = classMatch?.[1] || classMatch?.[2] || classMatch?.[3] || '';
  const candidates = classValue
    .split(/\s+/)
    .map(className => className.replace(/^hljs-/, ''))
    .flatMap(className => [className, className.replace(/_$/, '')]);

  for (const candidate of candidates) {
    if (tokenColors[candidate]) return tokenColors[candidate];
  }
  return fallback;
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

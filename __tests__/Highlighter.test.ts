import { highlight, parseHighlightedHTML } from '../src/components/code/highlighter';

const tokenColors = {
  keyword: 'keyword',
  tag: 'tag',
  name: 'name',
  title: 'title',
  default: 'default',
};

describe('code highlighter', () => {
  it('strips nested highlight.js span tags from rendered text', () => {
    const tokens = parseHighlightedHTML(
      '<span class="hljs-tag">&lt;<span class="hljs-name">script</span>&gt;</span>',
      tokenColors,
    );

    expect(tokens.map(token => token.text).join('')).toBe('<script>');
    expect(tokens.map(token => token.text).join('')).not.toContain('<span');
  });

  it('uses the first supported class from multi-class spans', () => {
    const tokens = parseHighlightedHTML(
      '<span class="hljs-title function_">run</span>',
      tokenColors,
    );

    expect(tokens).toEqual([{ text: 'run', color: 'title' }]);
  });

  it('does not leak hljs spans when highlighting nested html', () => {
    const lines = highlight('<script>const x = 1;</script>', tokenColors, 'html');
    const rendered = lines.map(line => line.map(token => token.text).join('')).join('\n');

    expect(rendered).toBe('<script>const x = 1;</script>');
    expect(rendered).not.toContain('hljs-');
    expect(rendered).not.toContain('<span');
  });
});

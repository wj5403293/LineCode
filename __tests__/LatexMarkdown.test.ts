import { latexMarkdownIt } from '../src/components/message/latexMarkdown';

function inlineChildren(source: string): any[] {
  return latexMarkdownIt
    .parse(source, {})
    .flatMap((token: any) => token.children || []);
}

describe('latexMarkdownIt', () => {
  it('parses dollar and parenthesis inline math', () => {
    const children = inlineChildren('Area is $A=\\pi r^2$ and \\(x+y\\).');
    const math = children.filter(token => token.type === 'latex_inline');

    expect(math.map(token => token.content)).toEqual(['A=\\pi r^2', 'x+y']);
  });

  it('parses display math blocks', () => {
    const tokens = latexMarkdownIt.parse('$$\na^2+b^2=c^2\n$$', {});
    const block = tokens.find((token: any) => token.type === 'latex_block');

    expect(block?.content).toBe('a^2+b^2=c^2');
    expect(block?.block).toBe(true);
  });

  it('does not parse math delimiters inside code', () => {
    const inline = inlineChildren('Use `$x$` literally.');
    const block = latexMarkdownIt.parse('```\n$$\nx\n$$\n```', {});

    expect(inline.some(token => token.type === 'latex_inline')).toBe(false);
    expect(block.some((token: any) => token.type === 'latex_block')).toBe(false);
  });

  it('leaves unclosed display math as text', () => {
    const tokens = latexMarkdownIt.parse('before\n$$\nunclosed\n\nafter', {});

    expect(tokens.some((token: any) => token.type === 'latex_block')).toBe(false);
    expect(tokens.map((token: any) => token.type)).toContain('paragraph_open');
  });
});

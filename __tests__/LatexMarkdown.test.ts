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

  it('parses same-line display math blocks with integrals', () => {
    const source = '$$\\zeta(3) = \\int_0^1 \\int_0^1 \\int_0^1 \\frac{1}{1 - xyz} \\, dx \\, dy \\, dz$$';
    const tokens = latexMarkdownIt.parse(source, {});
    const block = tokens.find((token: any) => token.type === 'latex_block');

    expect(block?.content).toContain('\\zeta(3)');
    expect(block?.content).toContain('\\int_0^1');
    expect(block?.content).toContain('\\, dx');
    expect(block?.block).toBe(true);
  });

  it('keeps trailing text after same-line display math', () => {
    const children = inlineChildren('$$x+y$$ after');
    const math = children.filter(token => token.type === 'latex_inline');

    expect(math.map(token => token.content)).toEqual(['x+y']);
    expect(children.some(token => token.type === 'text' && token.content === ' after')).toBe(true);
  });

  it('keeps paragraph display delimiters inline to avoid nested block views', () => {
    const children = inlineChildren('Before $$x+y$$ and \\[z\\] after.');
    const math = children.filter(token => token.type === 'latex_inline');

    expect(math.map(token => token.content)).toEqual(['x+y', 'z']);
    expect(children.some(token => token.type === 'latex_block')).toBe(false);
  });

  it('parses common display math environments as blocks', () => {
    const tokens = latexMarkdownIt.parse('\\begin{align}\na &= b + c\\\\\nd &= e\n\\end{align}', {});
    const block = tokens.find((token: any) => token.type === 'latex_block');

    expect(block?.content).toContain('\\begin{align}');
    expect(block?.content).toContain('\\end{align}');
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

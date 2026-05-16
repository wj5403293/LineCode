import { normalizeLatexSource } from '../src/components/message/latexUtils';

describe('normalizeLatexSource', () => {
  it('strips outer display delimiters', () => {
    expect(normalizeLatexSource('$$x+y$$')).toBe('x+y');
    expect(normalizeLatexSource('\\[x+y\\]')).toBe('x+y');
  });

  it('normalizes TeX spacing commands for the native renderer', () => {
    const source = '\\zeta(3) = \\int_0^1 \\frac{1}{1 - xyz} \\, dx \\; dy \\: dz';

    expect(normalizeLatexSource(source)).toBe(
      '\\zeta(3) = \\int_0^1 \\frac{1}{1 - xyz} dx dy dz',
    );
  });
});

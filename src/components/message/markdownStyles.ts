import { fontSizes, spacing } from '../../constants/theme';
import type { ThemeColors } from '../../theme';

export function createMdStyle(c: ThemeColors) {
  return {
    body: { color: c.text, fontSize: fontSizes.md, lineHeight: 22 },
    code_inline: {
      backgroundColor: c.codeBorder,
      color: c.accent,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 3,
      fontSize: fontSizes.sm,
      fontFamily: 'monospace',
    },
    code_block: {
      backgroundColor: 'transparent' as const,
      color: c.text,
      padding: 0,
      borderRadius: 0,
      fontSize: fontSizes.sm,
      fontFamily: 'monospace',
      lineHeight: 20,
      borderWidth: 0,
    },
    fence: {
      backgroundColor: 'transparent' as const,
      color: c.text,
      padding: 0,
      borderRadius: 0,
      fontSize: fontSizes.sm,
      fontFamily: 'monospace',
      lineHeight: 20,
      borderWidth: 0,
    },
    link: { color: c.userBubble },
    strong: { color: c.text, fontWeight: '700' as const },
    em: { color: c.text, fontStyle: 'italic' as const },
    bullet_list: { color: c.text, marginVertical: 2 },
    ordered_list: { color: c.text, marginVertical: 2 },
    list_item: { color: c.text },
    heading1: { color: c.text, fontSize: fontSizes.xl, fontWeight: '700' as const, marginVertical: 4 },
    heading2: { color: c.text, fontSize: fontSizes.lg, fontWeight: '700' as const, marginVertical: 4 },
    heading3: { color: c.text, fontSize: fontSizes.md, fontWeight: '700' as const, marginVertical: 2 },
    hr: { backgroundColor: c.borderLight, height: 1, marginVertical: 6 },
    blockquote: {
      borderLeftWidth: 2,
      borderLeftColor: c.textTertiary,
      paddingLeft: spacing.sm,
      color: c.textSecondary,
    },
    latex_textgroup: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      alignItems: 'center' as const,
    },
    latex_block: {
      width: '100%' as const,
      maxWidth: '100%' as const,
    },
  };
}

export function createUserMdStyle(c: ThemeColors) {
  const base = createMdStyle(c);
  return {
    ...base,
    body: { color: '#FFF', fontSize: fontSizes.md, lineHeight: 22 },
    code_inline: { ...base.code_inline, color: '#FFF' },
    strong: { color: '#FFF', fontWeight: '700' as const },
    em: { color: '#FFF', fontStyle: 'italic' as const },
    link: { color: '#B0D4FF' },
  };
}

export function createThinkingMdStyle(c: ThemeColors) {
  const base = createMdStyle(c);
  return {
    ...base,
    body: { color: c.textSecondary, fontSize: fontSizes.sm, lineHeight: 18 },
  };
}

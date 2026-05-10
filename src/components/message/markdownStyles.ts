import { colors, fontSizes, spacing } from '../../constants/theme';

export const mdStyle = {
  body: { color: colors.text, fontSize: fontSizes.md, lineHeight: 22 },
  code_inline: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: colors.accent,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: 'transparent',
    color: colors.text,
    padding: 0,
    borderRadius: 0,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    lineHeight: 20,
    borderWidth: 0,
  },
  fence: {
    backgroundColor: 'transparent',
    color: colors.text,
    padding: 0,
    borderRadius: 0,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    lineHeight: 20,
    borderWidth: 0,
  },
  link: { color: '#0A84FF' },
  strong: { color: colors.text, fontWeight: '700' as const },
  em: { color: colors.text, fontStyle: 'italic' as const },
  bullet_list: { color: colors.text, marginVertical: 2 },
  ordered_list: { color: colors.text, marginVertical: 2 },
  list_item: { color: colors.text },
  heading1: { color: colors.text, fontSize: fontSizes.xl, fontWeight: '700' as const, marginVertical: 4 },
  heading2: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '700' as const, marginVertical: 4 },
  heading3: { color: colors.text, fontSize: fontSizes.md, fontWeight: '700' as const, marginVertical: 2 },
  hr: { backgroundColor: colors.borderLight, height: 1, marginVertical: 6 },
  blockquote: {
    borderLeftWidth: 2,
    borderLeftColor: colors.textTertiary,
    paddingLeft: spacing.sm,
    color: colors.textSecondary,
  },
};

export const userMdStyle = {
  ...mdStyle,
  body: { color: '#FFF', fontSize: fontSizes.md, lineHeight: 22 },
  code_inline: { ...mdStyle.code_inline, color: '#FFF' },
  strong: { color: '#FFF', fontWeight: '700' as const },
  em: { color: '#FFF', fontStyle: 'italic' as const },
  link: { color: '#B0D4FF' },
};

export const thinkingMdStyle = {
  ...mdStyle,
  body: { color: colors.textSecondary, fontSize: fontSizes.sm, lineHeight: 18 },
};

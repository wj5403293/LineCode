import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import { fontSizes, radius, spacing } from '../constants/theme';
import { tutorialDocuments, TutorialVariant } from '../constants/tutorial';
import { useTheme } from '../theme';

interface Props {
  variant: TutorialVariant;
  onVariantChange: (variant: TutorialVariant) => void;
  onBack: () => void;
}

const variantOptions: { id: TutorialVariant; label: string; desc: string }[] = [
  { id: 'beginner', label: '新手版', desc: '零基础、一步一步照做' },
  { id: 'professional', label: '专业版', desc: '协议、执行环境、MCP 与安全细节' },
];

export default function TutorialScreen({ variant, onVariantChange, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const doc = tutorialDocuments[variant];
  const markdownStyle = useMemo(() => ({
    body: { color: colors.text, fontSize: fontSizes.md, lineHeight: 23 },
    heading1: { color: colors.text, fontSize: 25, lineHeight: 32, fontWeight: '800' as const, marginTop: spacing.sm, marginBottom: spacing.md },
    heading2: { color: colors.text, fontSize: 21, lineHeight: 28, fontWeight: '800' as const, marginTop: spacing.xl, marginBottom: spacing.sm },
    heading3: { color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700' as const, marginTop: spacing.lg, marginBottom: spacing.xs },
    heading4: { color: colors.text, fontSize: fontSizes.md, lineHeight: 22, fontWeight: '700' as const, marginTop: spacing.md, marginBottom: spacing.xs },
    paragraph: { color: colors.text, fontSize: fontSizes.md, lineHeight: 23, marginTop: spacing.xs, marginBottom: spacing.sm },
    strong: { color: colors.text, fontWeight: '800' as const },
    em: { color: colors.textSecondary, fontStyle: 'italic' as const },
    bullet_list: { marginBottom: spacing.sm },
    ordered_list: { marginBottom: spacing.sm },
    list_item: { color: colors.text, fontSize: fontSizes.md, lineHeight: 23, marginBottom: 2 },
    blockquote: {
      backgroundColor: colors.surfaceLight,
      borderLeftWidth: 3,
      borderLeftColor: colors.accent,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
      marginVertical: spacing.md,
    },
    fence: {
      backgroundColor: colors.codeBg,
      color: colors.text,
      borderColor: colors.codeBorder,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: fontSizes.sm,
      lineHeight: 20,
      fontFamily: 'monospace',
      marginVertical: spacing.sm,
    },
    code_block: {
      backgroundColor: colors.codeBg,
      color: colors.text,
      borderColor: colors.codeBorder,
      borderWidth: 1,
      borderRadius: radius.md,
      padding: spacing.md,
      fontSize: fontSizes.sm,
      lineHeight: 20,
      fontFamily: 'monospace',
      marginVertical: spacing.sm,
    },
    code_inline: {
      backgroundColor: colors.codeBorder,
      color: colors.accent,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      fontSize: fontSizes.sm,
      fontFamily: 'monospace',
    },
    table: { borderWidth: 1, borderColor: colors.borderLight, borderRadius: radius.sm, marginVertical: spacing.md },
    tr: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderLight },
    th: { color: colors.text, fontWeight: '800' as const, padding: spacing.sm, backgroundColor: colors.surfaceLight },
    td: { color: colors.textSecondary, padding: spacing.sm },
    hr: { backgroundColor: colors.borderLight, height: 1, marginVertical: spacing.lg },
    link: { color: colors.accent },
  }), [colors]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="使用教程" onBack={onBack} />
      <View style={[styles.selector, { backgroundColor: colors.surfaceElevated, borderColor: colors.borderLight }]}>
        {variantOptions.map(option => {
          const active = option.id === variant;
          return (
            <TouchableOpacity
              key={option.id}
              style={[styles.variantButton, active && { backgroundColor: colors.accentMuted }]}
              onPress={() => onVariantChange(option.id)}
              activeOpacity={0.75}
            >
              <View style={styles.variantTextWrap}>
                <Text style={[styles.variantLabel, { color: active ? colors.accent : colors.text }]}>{option.label}</Text>
                <Text style={[styles.variantDesc, { color: colors.textTertiary }]}>{option.desc}</Text>
              </View>
              {active && <Check size={18} color={colors.accent} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{doc.subtitle}</Text>
        <Markdown style={markdownStyle}>{doc.markdown}</Markdown>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  selector: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  variantButton: {
    minHeight: 62,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  variantTextWrap: { flex: 1 },
  variantLabel: { fontSize: fontSizes.md, fontWeight: '800' },
  variantDesc: { fontSize: fontSizes.xs, marginTop: 2 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  subtitle: { fontSize: fontSizes.sm, lineHeight: 20, marginBottom: spacing.md },
});

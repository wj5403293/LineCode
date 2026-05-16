import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createMdStyle } from './markdownStyles';
import { createMessageMarkdownRules } from './markdownRules';

interface Props {
  content: string;
  streaming?: boolean;
  codeWrap?: boolean;
  mathFormulaRenderingEnabled?: boolean;
}

export default React.memo(function TextBlock({
  content,
  streaming,
  codeWrap,
  mathFormulaRenderingEnabled,
}: Props) {
  const { colors } = useTheme();
  const mdStyle = useMemo(() => createMdStyle(colors), [colors]);
  const customRules = useMemo(
    () => createMessageMarkdownRules({ codeWrap }),
    [codeWrap],
  );
  const mathRules = useMemo(
    () => mathFormulaRenderingEnabled
      ? createMessageMarkdownRules({ codeWrap, mathFormulaRenderingEnabled: true })
      : undefined,
    [codeWrap, mathFormulaRenderingEnabled],
  );
  const mathMarkdownIt = useMemo(
    () => mathFormulaRenderingEnabled ? require('./latexMarkdown').latexMarkdownIt : undefined,
    [mathFormulaRenderingEnabled],
  );

  if (!content && !streaming) return null;

  if (!content && streaming) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
      </View>
    );
  }

  const markdown = mathFormulaRenderingEnabled ? (
    <Markdown style={mdStyle} rules={mathRules} markdownit={mathMarkdownIt}>{content || ''}</Markdown>
  ) : (
    <Markdown style={mdStyle} rules={customRules}>{content || ''}</Markdown>
  );

  return markdown;
});

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
});

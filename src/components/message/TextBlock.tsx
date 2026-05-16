import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createMdStyle } from './markdownStyles';
import { createMessageMarkdownRules } from './markdownRules';
import { useTypewriterText } from '../../hooks/useTypewriterText';

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
  const renderContent = useTypewriterText(content, !!streaming);
  const shouldRenderMath = !!mathFormulaRenderingEnabled && !streaming;
  const mdStyle = useMemo(() => createMdStyle(colors), [colors]);
  const customRules = useMemo(
    () => createMessageMarkdownRules({ codeWrap }),
    [codeWrap],
  );
  const mathRules = useMemo(
    () => shouldRenderMath
      ? createMessageMarkdownRules({ codeWrap, mathFormulaRenderingEnabled: true })
      : undefined,
    [codeWrap, shouldRenderMath],
  );
  const mathMarkdownIt = useMemo(
    () => shouldRenderMath ? require('./latexMarkdown').latexMarkdownIt : undefined,
    [shouldRenderMath],
  );

  if (!content && !streaming) return null;

  if (!content && streaming) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={colors.textTertiary} />
      </View>
    );
  }

  const markdown = shouldRenderMath ? (
    <Markdown style={mdStyle} rules={mathRules} markdownit={mathMarkdownIt}>{renderContent || ''}</Markdown>
  ) : (
    <Markdown style={mdStyle} rules={customRules}>{renderContent || ''}</Markdown>
  );

  return markdown;
});

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
});

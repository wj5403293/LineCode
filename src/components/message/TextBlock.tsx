import React, { useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../theme';
import { createMdStyle } from './markdownStyles';
import { createMessageMarkdownRules } from './markdownRules';
import { useTypewriterText } from '../../hooks/useTypewriterText';
import { StreamingContext } from '../../contexts/StreamingContext';

interface Props {
  content: string;
  streaming?: boolean;
  codeWrap?: boolean;
  mathFormulaRenderingEnabled?: boolean;
}

const rulesCache = new Map<string, ReturnType<typeof createMessageMarkdownRules>>();

function getMarkdownRules(codeWrap?: boolean, mathFormulaRenderingEnabled?: boolean) {
  const key = `${!!codeWrap}|${!!mathFormulaRenderingEnabled}`;
  let cached = rulesCache.get(key);
  if (!cached) {
    cached = createMessageMarkdownRules({ codeWrap, mathFormulaRenderingEnabled });
    rulesCache.set(key, cached);
  }
  return cached;
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
  const customRules = useMemo(() => getMarkdownRules(codeWrap, false), [codeWrap]);
  const mathRules = useMemo(
    () => shouldRenderMath ? getMarkdownRules(codeWrap, true) : undefined,
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

  return (
    <StreamingContext.Provider value={!!streaming}>
      {markdown}
    </StreamingContext.Provider>
  );
});

const styles = StyleSheet.create({
  loading: {
    paddingVertical: spacing.sm,
    alignItems: 'flex-start',
  },
});

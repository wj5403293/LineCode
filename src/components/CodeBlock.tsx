import React from 'react';
import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import HighlightedCode from './code/HighlightedCode';
import CopyButton from './code/CopyButton';

interface Props {
  language?: string;
  code: string;
  wordWrap?: boolean;
}

export default React.memo(function CodeBlock({ language, code, wordWrap = false }: Props) {
  const { colors } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const cleanLang = language?.split('\n')[0]?.trim() || '';
  const lineCount = code.split('\n').length;
  const maxBodyHeight = Math.max(180, Math.min(420, Math.floor(windowHeight * 0.48)));

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg }]}>
      <View style={styles.header}>
        <Text style={[styles.lang, { color: colors.textTertiary }]} numberOfLines={1}>{cleanLang || 'code'}</Text>
        <CopyButton text={code} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.codeBorder }]} />
      <ScrollView
        style={[styles.bodyScroll, { maxHeight: maxBodyHeight }]}
        contentContainerStyle={styles.bodyScrollContent}
        showsVerticalScrollIndicator={lineCount > 18}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {wordWrap ? (
          <View style={[styles.codeContent, styles.wrappedCodeContent]}>
            <HighlightedCode code={code} language={cleanLang || undefined} wordWrap={wordWrap} />
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            nestedScrollEnabled
            directionalLockEnabled
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.horizontalScrollContent}
          >
            <View style={styles.codeContent}>
              <HighlightedCode code={code} language={cleanLang || undefined} wordWrap={wordWrap} />
            </View>
          </ScrollView>
        )}
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    borderRadius: radius.sm,
    marginVertical: 6,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: spacing.sm,
  },
  lang: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  codeContent: {
    padding: spacing.md,
  },
  wrappedCodeContent: {
    width: '100%',
  },
  bodyScroll: {
    width: '100%',
    maxWidth: '100%',
    flexGrow: 0,
  },
  bodyScrollContent: {
    minWidth: '100%',
  },
  horizontalScrollContent: {
    minWidth: '100%',
  },
});

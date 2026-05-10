import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors, spacing, fontSizes, radius } from '../constants/theme';
import HighlightedCode from './code/HighlightedCode';
import CopyButton from './code/CopyButton';

interface Props {
  language?: string;
  code: string;
  wordWrap?: boolean;
}

export default React.memo(function CodeBlock({ language, code, wordWrap = false }: Props) {
  const cleanLang = language?.split('\n')[0]?.trim() || '';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.lang}>{cleanLang || 'code'}</Text>
        <CopyButton text={code} />
      </View>
      <View style={styles.divider} />
      <ScrollView
        horizontal={!wordWrap}
        showsHorizontalScrollIndicator={false}
      >
        <View style={styles.codeContent}>
          <HighlightedCode code={code} language={cleanLang || undefined} />
        </View>
      </ScrollView>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
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
  },
  lang: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  codeContent: {
    padding: spacing.md,
  },
});

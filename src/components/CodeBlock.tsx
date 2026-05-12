import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
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
  const cleanLang = language?.split('\n')[0]?.trim() || '';

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg }]}>
      <View style={styles.header}>
        <Text style={[styles.lang, { color: colors.textTertiary }]}>{cleanLang || 'code'}</Text>
        <CopyButton text={code} />
      </View>
      <View style={[styles.divider, { backgroundColor: colors.codeBorder }]} />
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
    fontSize: fontSizes.xs,
    fontWeight: '500',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  codeContent: {
    padding: spacing.md,
  },
});

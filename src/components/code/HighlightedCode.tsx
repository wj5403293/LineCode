import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSizes } from '../../constants/theme';
import { useTheme } from '../../theme';
import { highlight } from './highlighter';

interface Props {
  code: string;
  language?: string;
  wordWrap?: boolean;
}

export default React.memo(function HighlightedCode({ code, language, wordWrap = false }: Props) {
  const { colors, syntax } = useTheme();
  const lines = useMemo(() => highlight(code, syntax as unknown as Record<string, string>, language), [code, language, syntax]);

  return (
    <>
      {lines.map((lineTokens, lineIdx) => (
        <View key={lineIdx} style={[styles.line, !wordWrap && styles.nowrapLine]}>
          <Text style={[styles.lineNumber, { color: colors.textTertiary }]}>{lineIdx + 1}</Text>
          <Text selectable style={[styles.codeText, !wordWrap && styles.nowrapCodeText, { color: colors.text }]}>
            {lineTokens.map((token, tokenIdx) => (
              <Text key={tokenIdx} selectable style={{ color: token.color }}>
                {token.text}
              </Text>
            ))}
            {lineTokens.length === 0 && ' '}
          </Text>
        </View>
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    minHeight: 20,
  },
  nowrapLine: {
    alignSelf: 'flex-start',
  },
  lineNumber: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    lineHeight: 20,
    width: 28,
    opacity: 0.5,
  },
  codeText: {
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    lineHeight: 20,
    flex: 1,
  },
  nowrapCodeText: {
    flex: 0,
    flexShrink: 0,
  },
});

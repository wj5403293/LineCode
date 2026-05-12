import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSizes } from '../../constants/theme';
import { useTheme } from '../../theme';
import { highlight } from './highlighter';

interface Props {
  code: string;
  language?: string;
}

export default React.memo(function HighlightedCode({ code, language }: Props) {
  const { colors, syntax } = useTheme();
  const lines = useMemo(() => highlight(code, syntax as unknown as Record<string, string>, language), [code, language, syntax]);

  return (
    <>
      {lines.map((lineTokens, lineIdx) => (
        <View key={lineIdx} style={styles.line}>
          <Text style={[styles.lineNumber, { color: colors.textTertiary }]}>{lineIdx + 1}</Text>
          <Text style={[styles.codeText, { color: colors.text }]}>
            {lineTokens.map((token, tokenIdx) => (
              <Text key={tokenIdx} style={{ color: token.color }}>
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
  },
  lineNumber: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    width: 28,
    opacity: 0.5,
  },
  codeText: {
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    lineHeight: 20,
    flex: 1,
  },
});

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fontSizes } from '../../constants/theme';
import { highlight } from './highlighter';

interface Props {
  code: string;
  language?: string;
}

export default React.memo(function HighlightedCode({ code, language }: Props) {
  const lines = useMemo(() => highlight(code, language), [code, language]);

  return (
    <>
      {lines.map((lineTokens, lineIdx) => (
        <View key={lineIdx} style={styles.line}>
          <Text style={styles.lineNumber}>{lineIdx + 1}</Text>
          <Text style={styles.codeText}>
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
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    width: 28,
    opacity: 0.5,
  },
  codeText: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    lineHeight: 20,
    flex: 1,
  },
});

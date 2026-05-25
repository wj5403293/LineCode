import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSizes } from '../../constants/theme';
import { useTheme } from '../../theme';
import { highlight } from './highlighter';

interface Props {
  code: string;
  language?: string;
  wordWrap?: boolean;
  streaming?: boolean;
}

type TokenLines = Array<Array<{ text: string; color: string }>>;

const HIGHLIGHT_CACHE_MAX = 50;
const highlightCache = new Map<string, TokenLines>();

function cachedHighlight(
  code: string,
  language: string | undefined,
  syntax: Record<string, string>,
): TokenLines {
  const key = `${language || 'auto'}:${code}`;
  const hit = highlightCache.get(key);
  if (hit) {
    highlightCache.delete(key);
    highlightCache.set(key, hit);
    return hit;
  }
  const result = highlight(code, syntax, language);
  highlightCache.set(key, result);
  if (highlightCache.size > HIGHLIGHT_CACHE_MAX) {
    const oldestKey = highlightCache.keys().next().value;
    if (oldestKey !== undefined) highlightCache.delete(oldestKey);
  }
  return result;
}

function plainLines(code: string, color: string): TokenLines {
  return code.split('\n').map(line => (line ? [{ text: line, color }] : []));
}

export default React.memo(function HighlightedCode({ code, language, wordWrap = false, streaming = false }: Props) {
  const { colors, syntax } = useTheme();
  const lines = useMemo(() => {
    if (streaming) {
      return plainLines(code, colors.text);
    }
    return cachedHighlight(code, language, syntax as unknown as Record<string, string>);
  }, [code, language, syntax, streaming, colors.text]);

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

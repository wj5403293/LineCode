import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { spacing, fontSizes } from '../../constants/theme';
import { useTheme } from '../../theme';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  oldLine?: number;
  newLine?: number;
}

interface Props {
  oldContent: string;
  newContent: string;
  maxLines?: number;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');

  const m = oldLines.length;
  const n = newLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  let i = m, j = n;
  const ops: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      ops.unshift({ type: 'context', content: oldLines[i - 1], oldLine: i, newLine: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift({ type: 'add', content: newLines[j - 1], newLine: j });
      j--;
    } else {
      ops.unshift({ type: 'remove', content: oldLines[i - 1], oldLine: i });
      i--;
    }
  }

  return ops;
}

export default React.memo(function DiffView({ oldContent, newContent, maxLines = 50 }: Props) {
  const { colors } = useTheme();
  const lines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);
  const displayLines = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.container}>
        {displayLines.map((line, idx) => (
          <View key={idx} style={[
            styles.line,
            line.type === 'add' && { backgroundColor: colors.diffAddBg },
            line.type === 'remove' && { backgroundColor: colors.diffDelBg },
          ]}>
            <Text style={[styles.lineNum, { color: colors.textTertiary }]}>{line.oldLine ?? ''}</Text>
            <Text style={[styles.lineNum, { color: colors.textTertiary }]}>{line.newLine ?? ''}</Text>
            <Text style={[
              styles.linePrefix,
              { color: colors.textTertiary },
              line.type === 'add' && { color: colors.diffAddText },
              line.type === 'remove' && { color: colors.diffDelText },
            ]}>
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </Text>
            <Text style={[
              styles.lineText,
              { color: colors.text },
              line.type === 'add' && { color: colors.diffAddText },
              line.type === 'remove' && { color: colors.diffDelText },
            ]}>
              {line.content}
            </Text>
          </View>
        ))}
        {truncated && <Text style={[styles.truncated, { color: colors.textTertiary }]}>... (diff 已截断，共 {lines.length} 行)</Text>}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  scroll: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
  },
  scrollContent: {
    minWidth: '100%',
  },
  container: {
    minWidth: '100%',
    paddingVertical: spacing.xs,
  },
  line: {
    flexDirection: 'row',
    minWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  lineNum: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    width: 28,
    textAlign: 'right',
    marginRight: 4,
    opacity: 0.5,
  },
  linePrefix: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    width: 12,
  },
  lineText: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    flexShrink: 0,
  },
  truncated: {
    fontSize: fontSizes.xs,
    padding: spacing.sm,
    fontStyle: 'italic',
  },
});

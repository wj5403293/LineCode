import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '../../constants/theme';

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
  const result: DiffLine[] = [];

  // Simple LCS-based diff
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
  const lines = useMemo(() => computeDiff(oldContent, newContent), [oldContent, newContent]);
  const displayLines = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.container}>
        {displayLines.map((line, idx) => (
          <View key={idx} style={[styles.line, line.type === 'add' && styles.lineAdd, line.type === 'remove' && styles.lineRemove]}>
            <Text style={styles.lineNum}>{line.oldLine ?? ''}</Text>
            <Text style={styles.lineNum}>{line.newLine ?? ''}</Text>
            <Text style={[styles.linePrefix, line.type === 'add' && styles.prefixAdd, line.type === 'remove' && styles.prefixRemove]}>
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </Text>
            <Text style={[styles.lineText, line.type === 'add' && styles.textAdd, line.type === 'remove' && styles.textRemove]}>
              {line.content}
            </Text>
          </View>
        ))}
        {truncated && <Text style={styles.truncated}>... (diff 已截断，共 {lines.length} 行)</Text>}
      </View>
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  line: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  lineAdd: {
    backgroundColor: 'rgba(46,160,67,0.12)',
  },
  lineRemove: {
    backgroundColor: 'rgba(248,81,73,0.12)',
  },
  lineNum: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    width: 28,
    textAlign: 'right',
    marginRight: 4,
    opacity: 0.5,
  },
  linePrefix: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    width: 12,
  },
  prefixAdd: {
    color: '#3FB950',
  },
  prefixRemove: {
    color: '#F85149',
  },
  lineText: {
    color: colors.text,
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    flex: 1,
  },
  textAdd: {
    color: '#3FB950',
  },
  textRemove: {
    color: '#F85149',
  },
  truncated: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    padding: spacing.sm,
    fontStyle: 'italic',
  },
});

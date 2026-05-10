import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trash2, AlertTriangle, Check } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../../constants/theme';

interface Props {
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export default React.memo(function ToolCallDelete({ input, result, isError }: Props) {
  const paths: string[] = Array.isArray(input.paths) ? input.paths : [];

  const isComplete = !!result;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.deleteBadge}>
          <Trash2 size={12} color="#F85149" />
          <Text style={styles.deleteText}>DELETE</Text>
        </View>
        <Text style={styles.countText}>
          {paths.length} 个项目
        </Text>
      </View>

      {isError && result && (
        <View style={styles.errorSection}>
          <AlertTriangle size={14} color="#F85149" />
          <Text style={styles.errorText}>{result}</Text>
        </View>
      )}

      {isComplete && !isError && result && (
        <View style={styles.resultSection}>
          <Check size={14} color="#3FB950" />
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(248,81,73,0.08)',
    borderRadius: radius.sm,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(248,81,73,0.2)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  deleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248,81,73,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deleteText: {
    color: '#F85149',
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  countText: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  errorSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(248,81,73,0.2)',
  },
  errorText: {
    color: '#F85149',
    fontSize: fontSizes.xs,
    flex: 1,
  },
  resultSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(248,81,73,0.2)',
  },
  resultText: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    flex: 1,
  },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Trash2, AlertTriangle, Check } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export default React.memo(function ToolCallDelete({ input, result, isError }: Props) {
  const { colors } = useTheme();
  const paths: string[] = Array.isArray(input.paths) ? input.paths : [];

  const isComplete = !!result;

  return (
    <View style={[styles.container, { backgroundColor: colors.dangerMuted, borderColor: colors.dangerMuted2 }]}>
      <View style={styles.header}>
        <View style={[styles.deleteBadge, { backgroundColor: colors.dangerMuted2 }]}>
          <Trash2 size={12} color={colors.danger} />
          <Text style={[styles.deleteText, { color: colors.danger }]}>DELETE</Text>
        </View>
        <Text style={[styles.countText, { color: colors.textSecondary }]}>
          {paths.length} 个项目
        </Text>
      </View>

      {isError && result && (
        <View style={[styles.errorSection, { borderTopColor: colors.dangerMuted2 }]}>
          <AlertTriangle size={14} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{result}</Text>
        </View>
      )}

      {isComplete && !isError && result && (
        <View style={[styles.resultSection, { borderTopColor: colors.dangerMuted2 }]}>
          <Check size={14} color={colors.success} />
          <Text style={[styles.resultText, { color: colors.textSecondary }]}>{result}</Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: 1,
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
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deleteText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  countText: {
    fontSize: fontSizes.sm,
  },
  errorSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  errorText: {
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
  },
  resultText: {
    fontSize: fontSizes.xs,
    flex: 1,
  },
});

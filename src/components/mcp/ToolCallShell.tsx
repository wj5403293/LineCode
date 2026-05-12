import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, Check, ExternalLink, Play, Terminal, X, Zap } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  pending?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
  onDefaultExecute?: () => void;
  onViewCommand?: (command: string) => void;
}

export default React.memo(function ToolCallShell({
  input,
  result,
  isError,
  pending,
  onCancel,
  onConfirm,
  onDefaultExecute,
  onViewCommand,
}: Props) {
  const { colors } = useTheme();
  const command = String(input.command || '');

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg }]}>
      <View style={styles.header}>
        <Terminal size={14} color={isError ? colors.danger : colors.textTertiary} />
        <Text
          style={[styles.command, { color: isError ? colors.danger : colors.textTertiary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {command || 'shell_execute'}
        </Text>
        {onViewCommand && (
          <TouchableOpacity
            style={[styles.viewButton, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}
            onPress={() => onViewCommand(command)}
            activeOpacity={0.75}
          >
            <ExternalLink size={12} color={colors.textSecondary} />
            <Text style={[styles.viewText, { color: colors.textSecondary }]}>完整</Text>
          </TouchableOpacity>
        )}
      </View>
      {pending && (
        <View style={[styles.confirmSection, { borderTopColor: colors.codeBorder }]}>
          <TouchableOpacity
            style={[styles.autoButton, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]}
            onPress={onDefaultExecute}
            activeOpacity={0.75}
          >
            <Zap size={13} color={colors.accent} />
            <Text style={[styles.autoText, { color: colors.textSecondary }]}>自动运行</Text>
          </TouchableOpacity>

          <View style={styles.confirmSpacer} />

          <TouchableOpacity
            style={[styles.secondaryButton, { backgroundColor: colors.codeBorder }]}
            onPress={onCancel}
            activeOpacity={0.75}
          >
            <X size={13} color={colors.textSecondary} />
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>跳过</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={onConfirm}
            activeOpacity={0.75}
          >
            <Play size={13} color={colors.textOnColor} />
            <Text style={[styles.primaryText, { color: colors.textOnColor }]}>运行</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!result && (
        <View style={styles.resultRow}>
          {isError
            ? <AlertCircle size={12} color={colors.danger} />
            : <Check size={12} color={colors.success} />}
          <Text
            style={[styles.result, { color: isError ? colors.danger : colors.textSecondary }]}
            numberOfLines={4}
          >
            {result}
          </Text>
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    marginVertical: 2,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  command: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  viewButton: {
    flexShrink: 0,
    minHeight: 26,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: spacing.sm,
  },
  viewText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  confirmSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
    marginTop: spacing.xs,
  },
  autoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 30,
    minWidth: 78,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
  },
  autoText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  confirmSpacer: {
    flex: 1,
  },
  secondaryButton: {
    minHeight: 30,
    minWidth: 50,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.sm,
  },
  primaryButton: {
    minHeight: 30,
    minWidth: 50,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: spacing.sm,
  },
  primaryText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  secondaryText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 2,
  },
  result: {
    flex: 1,
    fontSize: fontSizes.xs,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
});

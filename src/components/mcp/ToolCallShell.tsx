import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, Check, ChevronDown, ChevronRight, ExternalLink, Play, Terminal, X, Zap } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  streaming?: boolean;
  streamingOutput?: string;
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
  streaming,
  streamingOutput,
  pending,
  onCancel,
  onConfirm,
  onDefaultExecute,
  onViewCommand,
}: Props) {
  const { colors } = useTheme();
  const command = String(input.command || '');
  const [expanded, setExpanded] = useState(false);
  const displayResult = streaming ? (streamingOutput || '正在执行...') : (result || '');
  const outputLines = useMemo(() => {
    if (!displayResult) return [];
    return displayResult.split(/\r?\n/);
  }, [displayResult]);
  const hasOutput = outputLines.length > 0;
  const canExpand = hasOutput && (outputLines.length > 4 || displayResult.length > 240 || !!streaming);
  const preview = useMemo(() => {
    if (!displayResult) return '';
    if (expanded) return displayResult;
    const tail = outputLines.slice(-4).join('\n');
    return tail.length > 320 ? `${tail.slice(tail.length - 320)}` : tail;
  }, [displayResult, expanded, outputLines]);
  const statusColor = isError ? colors.danger : streaming ? colors.accent : colors.success;

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg }]}>
      <View style={styles.header}>
        <Terminal size={14} color={isError ? colors.danger : streaming ? colors.accent : colors.textTertiary} />
        <Text
          style={[styles.command, { color: isError ? colors.danger : streaming ? colors.accent : colors.textTertiary }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {command || 'shell_execute'}
        </Text>
        {streaming && <ActivityIndicator size="small" color={colors.accent} />}
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
      {!!displayResult && (
        <View style={[styles.outputSection, { borderTopColor: colors.codeBorder }]}>
          <TouchableOpacity
            style={styles.outputHeader}
            onPress={() => canExpand && setExpanded(prev => !prev)}
            activeOpacity={canExpand ? 0.72 : 1}
            disabled={!canExpand}
          >
            {streaming ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : isError ? (
              <AlertCircle size={12} color={colors.danger} />
            ) : (
              <Check size={12} color={colors.success} />
            )}
            <Text style={[styles.outputTitle, { color: statusColor }]}>
              {streaming ? '执行中' : isError ? '执行失败' : '执行完成'}
            </Text>
            <Text style={[styles.outputMeta, { color: colors.textTertiary }]}>
              {outputLines.length} 行
            </Text>
            {canExpand && (
              expanded
                ? <ChevronDown size={13} color={colors.textTertiary} />
                : <ChevronRight size={13} color={colors.textTertiary} />
            )}
          </TouchableOpacity>
          {expanded ? (
            <ScrollView
              style={[styles.expandedOutput, { backgroundColor: colors.surface, borderColor: colors.codeBorder }]}
              nestedScrollEnabled
            >
              <Text selectable style={[styles.result, { color: isError ? colors.danger : colors.textSecondary }]}>
                {preview}
              </Text>
            </ScrollView>
          ) : (
            <Text
              selectable
              style={[styles.result, { color: isError ? colors.danger : colors.textSecondary }]}
              numberOfLines={4}
            >
              {preview}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
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
    minWidth: 0,
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
    minWidth: 0,
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
    minWidth: 0,
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
  outputSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
    gap: 4,
  },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 22,
  },
  outputTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  outputMeta: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.xs,
    textAlign: 'right',
  },
  result: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  expandedOutput: {
    maxHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
});

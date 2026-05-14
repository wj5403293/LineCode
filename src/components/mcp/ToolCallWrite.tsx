import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FileCode, Check, X, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import DiffView from './DiffView';
import { diffService } from '../../services/DiffService';
import { workspaceFs } from '../../services/WorkspaceFileSystem';
import { DiffRecord } from '../../types';

interface Props {
  name?: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  toolCallId: string;
  diffId?: string;
  reviewState?: 'accepted' | 'rejected';
  homePath: string;
  streaming?: boolean;
  onReview?: (toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => void;
}

export default React.memo(function ToolCallWrite({
  name,
  input,
  result,
  isError,
  toolCallId,
  diffId,
  reviewState,
  homePath,
  streaming,
  onReview,
}: Props) {
  const { colors } = useTheme();
  const filePath = String(input.file_path || '');
  const fileName = filePath.split('/').pop() || filePath;
  const displayFileName = fileName || '未命名文件';
  const displayPath = filePath || displayFileName;
  const [diffRecord, setDiffRecord] = useState<DiffRecord | null>(null);
  const [diffExpanded, setDiffExpanded] = useState(false);
  const [rejectError, setRejectError] = useState('');
  const [localReviewState, setLocalReviewState] = useState<'accepted' | 'rejected' | null>(null);

  const ext = displayFileName.includes('.') ? displayFileName.split('.').pop()?.toLowerCase() : '';
  const langLabel = ext ? ext.toUpperCase() : 'TXT';
  const actionLabel = name?.includes('edit') ? '编辑' : '写入';

  const isComplete = !streaming && !!result;

  useEffect(() => {
    if (isComplete && !isError && filePath) {
      const fullPath = workspaceFs.resolvePath(filePath, homePath);
      if (diffId) {
        diffService.getDiff(diffId).then(record => {
          if (record) setDiffRecord(record);
        }).catch(() => {});
      } else {
        diffService.getDiffChain(fullPath).then(chain => {
          const last = chain.filter(d => !d.reverted).pop();
          if (last) setDiffRecord(last);
        }).catch(() => {});
      }
    }
  }, [isComplete, isError, filePath, homePath, diffId]);

  useEffect(() => {
    if (reviewState !== 'rejected' || !diffRecord || diffRecord.reverted) return;
    diffService.getDiff(diffRecord.id).then(record => {
      if (record?.reverted) setDiffRecord(record);
    }).catch(() => {});
  }, [reviewState, diffRecord]);

  const hasDiff = isComplete && !isError && !!diffRecord;
  const effectiveReviewState = reviewState || localReviewState;
  const confirmed = effectiveReviewState === 'accepted'
    ? true
    : effectiveReviewState === 'rejected' || diffRecord?.reverted
      ? false
      : null;
  const statusColor = isError
    ? colors.danger
    : confirmed === false
      ? colors.danger
      : isComplete || confirmed === true
        ? colors.success
        : streaming
          ? colors.accent
          : colors.textTertiary;

  const handleConfirm = () => {
    setRejectError('');
    setLocalReviewState('accepted');
    onReview?.(toolCallId, 'accepted', diffRecord?.id || diffId);
  };

  const handleReject = async () => {
    setRejectError('');
    const targetDiffId = diffRecord?.id || diffId;
    if (!targetDiffId) {
      setLocalReviewState('rejected');
      onReview?.(toolCallId, 'rejected', targetDiffId);
      return;
    }

    const revertResult = await diffService.revertDiff(targetDiffId);
    if (!revertResult.success) {
      setRejectError(revertResult.message);
      return;
    }

    const updated = await diffService.getDiff(targetDiffId);
    if (updated) setDiffRecord(updated);
    setLocalReviewState('rejected');
    onReview?.(toolCallId, 'rejected', targetDiffId);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg, borderColor: isError ? colors.dangerMuted2 : colors.codeBorder }]}>
      <View style={styles.header}>
        <View style={styles.fileRow}>
          <View style={[styles.fileIcon, { borderColor: colors.codeBorder }]}>
            <FileCode size={14} color={statusColor} />
          </View>
          <View style={styles.fileMeta}>
            <View style={styles.titleRow}>
              <View style={[styles.langBadge, { backgroundColor: colors.surfaceLight, borderColor: colors.codeBorder }]}>
                <Text style={[styles.langText, { color: colors.textSecondary }]}>{langLabel}</Text>
              </View>
              <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{displayFileName}</Text>
            </View>
            <Text style={[styles.filePath, { color: colors.textTertiary }]} numberOfLines={1}>{displayPath}</Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: colors.surfaceLight, borderColor: colors.codeBorder }]}
            accessibilityLabel={streaming ? '写入中' : isError || confirmed === false ? '失败' : '完成'}
          >
            {streaming || !isComplete ? (
              <ActivityIndicator size="small" color={statusColor} />
            ) : isError || confirmed === false ? (
              <X size={14} color={colors.danger} />
            ) : (
              <Check size={14} color={colors.success} />
            )}
          </View>
        </View>

        {isComplete && confirmed === null && !isError && hasDiff && (
          <View style={styles.reviewRow}>
            <View style={[styles.actionBadge, { backgroundColor: colors.accentMuted, borderColor: colors.accentMuted2 }]}>
              <Text style={[styles.actionText, { color: colors.accent }]}>{actionLabel}</Text>
            </View>
            <View style={styles.reviewSpacer} />
            <TouchableOpacity
              style={[styles.rejectBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.dangerMuted2 }]}
              onPress={handleReject}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`撤销 ${displayFileName} 的变更`}
            >
              <X size={14} color={colors.danger} />
              <Text style={[styles.rejectText, { color: colors.danger }]}>撤销</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: colors.accent }]}
              onPress={handleConfirm}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`同意 ${displayFileName} 的变更`}
            >
              <Check size={14} color={colors.textOnColor} />
              <Text style={[styles.confirmText, { color: colors.textOnColor }]}>同意</Text>
            </TouchableOpacity>
          </View>
        )}

        {(!isComplete || isError || confirmed !== null || !hasDiff) && (
          <View style={styles.compactMetaRow}>
            <View style={[styles.actionBadge, { backgroundColor: colors.surfaceLight, borderColor: colors.codeBorder }]}>
              <Text style={[styles.actionText, { color: colors.textSecondary }]}>{actionLabel}</Text>
            </View>
          </View>
        )}
      </View>

      {hasDiff && diffRecord && (
        <View style={[styles.diffSection, { borderTopColor: colors.codeBorder }]}>
          <TouchableOpacity
            style={styles.diffHeader}
            onPress={() => setDiffExpanded(prev => !prev)}
            activeOpacity={0.7}
          >
            {diffExpanded ? (
              <ChevronDown size={12} color={colors.accent} />
            ) : (
              <ChevronRight size={12} color={colors.accent} />
            )}
            <Text style={[styles.diffLabel, { color: colors.accent }]}>查看 Diff</Text>
          </TouchableOpacity>

          {diffExpanded && (
            <DiffView
              oldContent={diffRecord.oldContent}
              newContent={diffRecord.newContent}
            />
          )}
        </View>
      )}

      {isError && result && (
        <View style={[styles.errorSection, { borderTopColor: colors.codeBorder }]}>
          <AlertCircle size={14} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{result}</Text>
        </View>
      )}

      {!!rejectError && (
        <View style={[styles.errorSection, { borderTopColor: colors.codeBorder }]}>
          <AlertCircle size={14} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{rejectError}</Text>
        </View>
      )}

      {isComplete && !isError && result && (!hasDiff || confirmed !== null) && (
        <Text style={[styles.result, { color: colors.textSecondary, borderTopColor: colors.codeBorder }]}>{result}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    marginVertical: 4,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  fileIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 0,
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  langText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  fileName: {
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    flex: 1,
  },
  filePath: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionBadge: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  actionText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  reviewSpacer: {
    flex: 1,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 30,
    minWidth: 62,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  confirmText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 30,
    minWidth: 62,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rejectText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
  },
  diffSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  diffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  diffLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '500',
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
  result: {
    fontSize: fontSizes.xs,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

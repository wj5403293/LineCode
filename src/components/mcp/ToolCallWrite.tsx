import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FileCode, Check, X, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import DiffView from './DiffView';
import { diffService } from '../../services/DiffService';
import { DiffRecord } from '../../types';

interface Props {
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
  const [diffRecord, setDiffRecord] = useState<DiffRecord | null>(null);
  const [diffExpanded, setDiffExpanded] = useState(false);
  const [rejectError, setRejectError] = useState('');

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  const langLabel = ext ? ext.toUpperCase() : 'TXT';

  const isComplete = !streaming && !!result;

  useEffect(() => {
    if (isComplete && !isError && filePath) {
      const fullPath = filePath.startsWith('/') ? filePath : `${homePath}/${filePath}`;
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

  const hasDiff = isComplete && !isError && diffRecord;
  const confirmed = reviewState === 'accepted'
    ? true
    : reviewState === 'rejected' || diffRecord?.reverted
      ? false
      : null;

  const handleConfirm = () => {
    setRejectError('');
    onReview?.(toolCallId, 'accepted', diffRecord?.id || diffId);
  };

  const handleReject = async () => {
    setRejectError('');
    const targetDiffId = diffRecord?.id || diffId;
    if (!targetDiffId) {
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
    onReview?.(toolCallId, 'rejected', targetDiffId);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg }]}>
      <View style={styles.header}>
        <View style={[styles.langBadge, { backgroundColor: colors.accentMuted }]}>
          <FileCode size={12} color={colors.accent} />
          <Text style={[styles.langText, { color: colors.accent }]}>{langLabel}</Text>
        </View>
        <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{fileName}</Text>
        <View style={styles.actions}>
          {streaming && (
            <View style={[styles.streamingBadge, { backgroundColor: colors.accentMuted2 }]}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.streamingText, { color: colors.accent }]}>编写中</Text>
            </View>
          )}
          {!streaming && !isComplete && (
            <ActivityIndicator size="small" color={colors.textTertiary} />
          )}
          {isComplete && confirmed === null && !isError && hasDiff && (
            <>
              <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: colors.dangerMuted }]} onPress={handleReject} activeOpacity={0.7}>
                <X size={14} color={colors.danger} />
                <Text style={[styles.rejectText, { color: colors.danger }]}>拒绝</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: colors.accent }]} onPress={handleConfirm} activeOpacity={0.7}>
                <Check size={14} color={colors.textOnColor} />
                <Text style={[styles.confirmText, { color: colors.textOnColor }]}>同意</Text>
              </TouchableOpacity>
            </>
          )}
          {confirmed === true && (
            <View style={styles.statusBadge}>
              <Check size={12} color={colors.success} />
              <Text style={[styles.statusText, { color: colors.success }]}>已同意</Text>
            </View>
          )}
          {confirmed === false && (
            <View style={styles.statusBadge}>
              <X size={12} color={colors.danger} />
              <Text style={[styles.statusText, { color: colors.danger }]}>已拒绝</Text>
            </View>
          )}
        </View>
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
            <Text style={[styles.diffLabel, { color: colors.accent }]}>查看变更</Text>
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

      {isComplete && !isError && result && confirmed !== null && (
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streamingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  streamingText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confirmText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rejectText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
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

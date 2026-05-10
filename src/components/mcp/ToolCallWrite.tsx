import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FileCode, Check, X, AlertCircle } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../../constants/theme';
import DiffView from './DiffView';
import { diffService } from '../../services/DiffService';

interface Props {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  homePath: string;
  streaming?: boolean; // 正在写入中
}

export default React.memo(function ToolCallWrite({ name, input, result, isError, homePath, streaming }: Props) {
  const filePath = String(input.file_path || '');
  const fileName = filePath.split('/').pop() || filePath;
  const [confirmed, setConfirmed] = useState<boolean | null>(null);

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  const langLabel = ext ? ext.toUpperCase() : 'TXT';

  // 是否已写入完成（有 result 且不在 streaming）
  const isComplete = !!result && !streaming;
  // 是否有 diff 内容可显示
  const hasDiff = isComplete && !isError && (input._oldContent !== undefined || input.content !== undefined);

  const handleConfirm = () => setConfirmed(true);

  const handleReject = async () => {
    setConfirmed(false);
    const fullPath = filePath.startsWith('/') ? filePath : `${homePath}/${filePath}`;
    await diffService.revertLast(fullPath);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.langBadge}>
          <FileCode size={12} color={colors.accent} />
          <Text style={styles.langText}>{langLabel}</Text>
        </View>
        <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
        <View style={styles.actions}>
          {streaming && (
            <ActivityIndicator size="small" color={colors.accent} />
          )}
          {!streaming && !isComplete && (
            <ActivityIndicator size="small" color={colors.textTertiary} />
          )}
          {isComplete && confirmed === null && !isError && (
            <>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} activeOpacity={0.7}>
                <X size={14} color="#F85149" />
                <Text style={styles.rejectText}>拒绝</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.7}>
                <Check size={14} color="#FFF" />
                <Text style={styles.confirmText}>同意</Text>
              </TouchableOpacity>
            </>
          )}
          {confirmed === true && (
            <View style={styles.statusBadge}>
              <Check size={12} color="#3FB950" />
              <Text style={styles.statusText}>已同意</Text>
            </View>
          )}
          {confirmed === false && (
            <View style={styles.statusBadge}>
              <X size={12} color="#F85149" />
              <Text style={[styles.statusText, { color: '#F85149' }]}>已拒绝</Text>
            </View>
          )}
        </View>
      </View>

      {/* 写入中状态 */}
      {streaming && (
        <View style={styles.progressSection}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={styles.progressText}>正在写入...</Text>
        </View>
      )}

      {/* 写入完成且有 diff */}
      {hasDiff && (
        <>
          <View style={styles.divider} />
          <DiffView
            oldContent={String(input._oldContent || '')}
            newContent={String(input.content || '')}
          />
        </>
      )}

      {/* 错误信息 */}
      {isError && result && (
        <View style={styles.errorSection}>
          <AlertCircle size={14} color="#F85149" />
          <Text style={styles.errorText}>{result}</Text>
        </View>
      )}

      {/* 正常结果信息 */}
      {isComplete && !isError && result && confirmed !== null && (
        <Text style={styles.result}>{result}</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
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
    backgroundColor: 'rgba(48,209,88,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langText: {
    color: colors.accent,
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  fileName: {
    color: colors.text,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  confirmText: {
    color: '#FFF',
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  rejectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(248,81,73,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rejectText: {
    color: '#F85149',
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
    color: '#3FB950',
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  progressText: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  errorSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  errorText: {
    color: '#F85149',
    fontSize: fontSizes.xs,
    flex: 1,
  },
  result: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
});

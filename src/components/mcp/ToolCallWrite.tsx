import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { FileCode, Check, X, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../../constants/theme';
import DiffView from './DiffView';
import { diffService } from '../../services/DiffService';
import { DiffRecord } from '../../types';

interface Props {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  homePath: string;
  streaming?: boolean;
}

export default React.memo(function ToolCallWrite({ name, input, result, isError, homePath, streaming }: Props) {
  const filePath = String(input.file_path || '');
  const fileName = filePath.split('/').pop() || filePath;
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const [diffRecord, setDiffRecord] = useState<DiffRecord | null>(null);
  const [diffExpanded, setDiffExpanded] = useState(false);

  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
  const langLabel = ext ? ext.toUpperCase() : 'TXT';

  const isComplete = !streaming && !!result;

  useEffect(() => {
    if (isComplete && !isError && filePath) {
      const fullPath = filePath.startsWith('/') ? filePath : `${homePath}/${filePath}`;
      diffService.getDiffChain(fullPath).then(chain => {
        const last = chain.filter(d => !d.reverted).pop();
        if (last) {
          setDiffRecord(last);
        }
      }).catch(() => {});
    }
  }, [isComplete, isError, filePath, homePath]);

  const hasDiff = isComplete && !isError && diffRecord;

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
            <View style={styles.streamingBadge}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.streamingText}>编写中</Text>
            </View>
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

      {hasDiff && diffRecord && (
        <View style={styles.diffSection}>
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
            <Text style={styles.diffLabel}>查看变更</Text>
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
        <View style={styles.errorSection}>
          <AlertCircle size={14} color="#F85149" />
          <Text style={styles.errorText}>{result}</Text>
        </View>
      )}

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
  streamingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(48,209,88,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  streamingText: {
    color: colors.accent,
    fontSize: fontSizes.xs,
    fontWeight: '600',
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
  diffSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  diffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  diffLabel: {
    color: colors.accent,
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

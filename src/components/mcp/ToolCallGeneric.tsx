import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertCircle, Check, ChevronDown, ChevronRight, Wrench } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';
import ContainedScrollView from '../ContainedScrollView';

const COLLAPSED_LINE_COUNT = 4;

interface Props {
  name: string;
  input?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  streaming?: boolean;
}

export default React.memo(function ToolCallGeneric({
  name,
  input,
  result,
  isError,
  streaming,
}: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(true);
  const displayInput = useMemo(() => formatValue(input || {}), [input]);
  const displayResult = useMemo(() => formatText(result || ''), [result]);
  const resultLines = useMemo(
    () => displayResult ? displayResult.split(/\r?\n/) : [],
    [displayResult],
  );
  const hasResult = displayResult.length > 0;
  const canExpand = hasResult && (resultLines.length > COLLAPSED_LINE_COUNT || displayResult.length > 320);
  const statusColor = isError ? colors.danger : streaming || !hasResult ? colors.accent : colors.success;

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg, borderColor: isError ? colors.dangerMuted2 : colors.codeBorder }]}>
      <View style={styles.header}>
        <View style={[styles.iconFrame, { borderColor: colors.codeBorder }]}>
          <Wrench size={13} color={statusColor} />
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.label, { color: colors.textTertiary }]}>MCP 调用</Text>
          <Text style={[styles.name, { color: isError ? colors.danger : colors.text }]} numberOfLines={1}>
            {name}
          </Text>
        </View>
        {streaming || !hasResult ? (
          <ActivityIndicator size="small" color={statusColor} />
        ) : isError ? (
          <AlertCircle size={14} color={colors.danger} />
        ) : (
          <Check size={14} color={colors.success} />
        )}
      </View>

      {!!displayInput && displayInput !== '{}' && (
        <View style={[styles.inputSection, { borderTopColor: colors.codeBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>输入</Text>
          <Text style={[styles.inputText, { color: colors.textSecondary }]} numberOfLines={2}>
            {displayInput}
          </Text>
        </View>
      )}

      {hasResult && (
        <View style={[styles.resultSection, { borderTopColor: colors.codeBorder }]}>
          <TouchableOpacity
            style={styles.resultHeader}
            onPress={() => canExpand && setExpanded(prev => !prev)}
            activeOpacity={canExpand ? 0.72 : 1}
            disabled={!canExpand}
            accessibilityRole="button"
            accessibilityLabel={`${name} 返回值`}
          >
            {isError ? (
              <AlertCircle size={12} color={colors.danger} />
            ) : (
              <Check size={12} color={colors.success} />
            )}
            <Text style={[styles.sectionTitle, { color: isError ? colors.danger : colors.textTertiary }]}>
              返回值
            </Text>
            <Text style={[styles.resultMeta, { color: colors.textTertiary }]}>
              {resultLines.length} 行
            </Text>
            {canExpand && (
              expanded
                ? <ChevronDown size={13} color={colors.textTertiary} />
                : <ChevronRight size={13} color={colors.textTertiary} />
            )}
          </TouchableOpacity>

          {expanded || !canExpand ? (
            <ContainedScrollView
              style={[styles.resultScroll, { backgroundColor: colors.surface, borderColor: colors.codeBorder }]}
              contentContainerStyle={styles.resultScrollContent}
            >
              <Text selectable style={[styles.resultText, { color: isError ? colors.danger : colors.textSecondary }]}>
                {displayResult}
              </Text>
            </ContainedScrollView>
          ) : (
            <Text
              selectable
              style={[styles.resultText, { color: isError ? colors.danger : colors.textSecondary }]}
              numberOfLines={COLLAPSED_LINE_COUNT}
            >
              {displayResult}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

function formatValue(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return value;
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === 'string') return parsed;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return value;
  }
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    width: '100%',
    maxWidth: '100%',
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconFrame: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 1,
  },
  name: {
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  inputSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  sectionTitle: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  inputText: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  resultSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 22,
  },
  resultMeta: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.xs,
    textAlign: 'right',
  },
  resultText: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
    fontFamily: 'monospace',
  },
  resultScroll: {
    maxHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
  },
  resultScrollContent: {
    padding: spacing.sm,
  },
});

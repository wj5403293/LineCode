import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Eye, AlertCircle, Search, Check } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export default React.memo(function ToolCallRead({ name, input, result, isError }: Props) {
  const { colors } = useTheme();
  const label = String(input.file_path || input.pattern || input.query || input.url || name);
  const Icon = name === 'web_search' ? Search : Eye;
  const actionLabel = name === 'web_search'
    ? '搜索'
    : name === 'web_fetch'
      ? '抓取'
      : name === 'glob'
        ? '匹配'
        : '读取';
  const isComplete = !!result;

  const handleLongPress = () => {
    if (result) {
      Clipboard.setString(result);
      Alert.alert('已复制', '内容已复制到剪贴板');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.codeBg, borderColor: isError ? colors.dangerMuted2 : colors.codeBorder }]}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      disabled={!result}
      accessibilityRole="button"
      accessibilityLabel={`${actionLabel}: ${label}`}
    >
      <View style={styles.header}>
        <View style={[styles.iconFrame, { borderColor: isError ? colors.dangerMuted2 : colors.codeBorder }]}>
          <Icon size={13} color={isError ? colors.danger : colors.textSecondary} />
        </View>
        <View style={styles.textBlock}>
          <Text style={[styles.action, { color: isError ? colors.danger : colors.textSecondary }]}>{actionLabel}</Text>
          <Text style={[styles.path, { color: isError ? colors.danger : colors.text }]} numberOfLines={1}>{label}</Text>
        </View>
        <View style={styles.status}>
          {!isComplete ? (
            <ActivityIndicator size="small" color={colors.textTertiary} />
          ) : isError ? (
            <AlertCircle size={13} color={colors.danger} />
          ) : (
            <Check size={13} color={colors.success} />
          )}
        </View>
      </View>
      {isError && result && (
        <View style={[styles.errorRow, { borderTopColor: colors.codeBorder }]}>
          <AlertCircle size={12} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{result}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    marginVertical: 2,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 42,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  iconFrame: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  action: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 1,
  },
  path: {
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  status: {
    width: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  errorText: {
    fontSize: fontSizes.xs,
    flex: 1,
  },
});

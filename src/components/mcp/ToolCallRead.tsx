import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { Eye, AlertCircle, Search } from 'lucide-react-native';
import { spacing, fontSizes } from '../../constants/theme';
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

  const handleLongPress = () => {
    if (result) {
      Clipboard.setString(result);
      Alert.alert('已复制', '内容已复制到剪贴板');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.codeBg }]}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      disabled={!result}
    >
      <Icon size={14} color={isError ? colors.danger : colors.textTertiary} />
      <Text style={[styles.path, { color: isError ? colors.danger : colors.textTertiary }]} numberOfLines={1}>{label}</Text>
      {isError && result && (
        <View style={styles.errorRow}>
          <AlertCircle size={12} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{result}</Text>
        </View>
      )}
    </TouchableOpacity>
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
  path: {
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  errorText: {
    fontSize: fontSizes.xs,
    flex: 1,
  },
});

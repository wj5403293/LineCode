import React from 'react';
import { View, Text, StyleSheet, Clipboard, TouchableOpacity, Alert } from 'react-native';
import { Eye, AlertCircle } from 'lucide-react-native';
import { colors, spacing, fontSizes } from '../../constants/theme';

interface Props {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

export default React.memo(function ToolCallRead({ name, input, result, isError }: Props) {
  const filePath = String(input.file_path || input.pattern || '');

  const handleLongPress = () => {
    if (result) {
      Clipboard.setString(result);
      Alert.alert('已复制', '内容已复制到剪贴板');
    }
  };

  return (
    <TouchableOpacity
      style={styles.container}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      disabled={!result}
    >
      <Eye size={14} color={isError ? '#F85149' : colors.textTertiary} />
      <Text style={[styles.path, isError && styles.pathError]} numberOfLines={1}>{filePath}</Text>
      {isError && result && (
        <View style={styles.errorRow}>
          <AlertCircle size={12} color="#F85149" />
          <Text style={styles.errorText}>{result}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    marginVertical: 2,
    gap: 4,
  },
  path: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  pathError: {
    color: '#F85149',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  errorText: {
    color: '#F85149',
    fontSize: fontSizes.xs,
    flex: 1,
  },
});

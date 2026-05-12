import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Archive } from 'lucide-react-native';
import { spacing, fontSizes } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  status?: 'running' | 'done' | 'error';
}

export default React.memo(function ContextCompactBlock({ status = 'running' }: Props) {
  const { colors } = useTheme();
  const isRunning = status === 'running';
  const isError = status === 'error';

  return (
    <View style={[styles.container, { backgroundColor: colors.codeBg }]}>
      <Archive size={14} color={isError ? colors.danger : colors.textTertiary} />
      <Text style={[styles.label, { color: isError ? colors.danger : colors.textTertiary }]}>压缩</Text>
      <View style={styles.spacer} />
      {isRunning && <ActivityIndicator size="small" color={colors.textTertiary} />}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minHeight: 34,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
    marginVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
  spacer: {
    flex: 1,
  },
});

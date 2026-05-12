import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { spacing, fontSizes } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  title: string;
}

export default React.memo(function SectionHeader({ title }: Props) {
  const { colors } = useTheme();

  return (
    <Text style={[styles.title, { color: colors.textTertiary }]}>{title}</Text>
  );
});

const styles = StyleSheet.create({
  title: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
});

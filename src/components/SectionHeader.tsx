import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '../constants/theme';

interface Props {
  title: string;
}

export default React.memo(function SectionHeader({ title }: Props) {
  return <Text style={styles.title}>{title}</Text>;
});

const styles = StyleSheet.create({
  title: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
});

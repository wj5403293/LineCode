import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius, spacing } from '../../constants/theme';
import { useTheme } from '../../theme';
import SectionHeader from '../SectionHeader';

interface Props {
  title: string;
  children: React.ReactNode;
}

export default React.memo(function FormSection({ title, children }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      <View style={[styles.formGroup, { backgroundColor: colors.surfaceElevated }]}>
        {children}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  section: {
    paddingTop: spacing.lg,
  },
  formGroup: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.md,
  },
});

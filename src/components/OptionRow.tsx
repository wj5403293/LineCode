import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '../constants/theme';

interface Props {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  active?: boolean;
  onPress?: () => void;
}

export default React.memo(function OptionRow({ icon, label, desc, active, onPress }: Props) {
  const containerStyle = useMemo(
    () => [styles.option, active && styles.optionActive],
    [active],
  );

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      {icon}
      <View style={styles.content}>
        <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
        {desc && <Text style={styles.desc}>{desc}</Text>}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  optionActive: {
    backgroundColor: 'rgba(48,209,88,0.08)',
  },
  content: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  labelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  desc: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});

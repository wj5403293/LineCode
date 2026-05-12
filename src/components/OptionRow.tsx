import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { spacing, fontSizes } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  active?: boolean;
  onPress?: () => void;
}

export default React.memo(function OptionRow({ icon, label, desc, active, onPress }: Props) {
  const { colors } = useTheme();

  const containerStyle = useMemo(
    () => [styles.option, { borderBottomColor: colors.borderLight }, active && { backgroundColor: colors.accentMuted }],
    [active, colors.borderLight, colors.accentMuted],
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
        <Text style={[styles.label, { color: active ? colors.accent : colors.text }, active && styles.labelActive]}>
          {label}
        </Text>
        {desc && <Text style={[styles.desc, { color: colors.textTertiary }]}>{desc}</Text>}
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
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '600',
  },
  desc: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});

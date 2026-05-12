import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { spacing, fontSizes } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export default React.memo(function SwitchRow({ icon, label, desc, value, onValueChange }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.row, { borderBottomColor: colors.borderLight }]}>
      <View style={styles.content}>
        {icon}
        <View style={styles.text}>
          <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
          {desc && <Text style={[styles.desc, { color: colors.textTertiary }]}>{desc}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.surfaceLight, true: colors.accentDim }}
        thumbColor={value ? colors.accent : colors.textTertiary}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  text: {
    flex: 1,
  },
  label: {
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  desc: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});

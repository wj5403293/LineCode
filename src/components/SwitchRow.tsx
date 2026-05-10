import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { colors, spacing, fontSizes } from '../constants/theme';

interface Props {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

export default React.memo(function SwitchRow({ icon, label, desc, value, onValueChange }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.content}>
        {icon}
        <View style={styles.text}>
          <Text style={styles.label}>{label}</Text>
          {desc && <Text style={styles.desc}>{desc}</Text>}
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
    borderBottomColor: colors.borderLight,
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
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  desc: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});

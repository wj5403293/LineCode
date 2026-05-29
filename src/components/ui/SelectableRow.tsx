import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { fontSizes, spacing } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  label: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
  icon: React.ReactNode;
  last?: boolean;
}

export default React.memo(function SelectableRow({
  label,
  desc,
  selected,
  onPress,
  icon,
  last = false,
}: Props) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        selected && { backgroundColor: colors.accentMuted },
        !last && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, { backgroundColor: selected ? colors.accentMuted : colors.surfaceLight }]}>
        {icon}
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: selected ? colors.accent : colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.desc, { color: colors.textTertiary }]} numberOfLines={2}>
          {desc}
        </Text>
      </View>
      <View
        style={[
          styles.checkCircle,
          {
            backgroundColor: selected ? colors.accent : colors.surfaceLight,
            borderColor: selected ? colors.accent : colors.borderLight,
          },
        ]}
      >
        {selected && <Check size={13} color={colors.textOnColor} />}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 62,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  desc: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    lineHeight: 17,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

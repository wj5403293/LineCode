import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { fontSizes, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../theme';

interface Props {
  icon: React.ReactNode;
  label: string;
  desc?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  busy?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  showChevron?: boolean;
  activeOpacity?: number;
}

export default React.memo(function ActionRow({
  icon,
  label,
  desc,
  onPress,
  onLongPress,
  busy = false,
  disabled = false,
  destructive = false,
  showChevron = false,
  activeOpacity = 0.7,
}: Props) {
  const { colors } = useTheme();
  const muted = disabled || busy;
  const iconBackground = destructive ? colors.dangerMuted : colors.accentMuted;

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.borderLight }, muted && styles.disabled]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={activeOpacity}
      disabled={muted || (!onPress && !onLongPress)}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBackground }]}>
        {icon}
      </View>
      <View style={styles.textWrap}>
        <Text style={[styles.label, { color: muted ? colors.textTertiary : colors.text }]}>{label}</Text>
        {!!desc && <Text style={[styles.desc, { color: colors.textTertiary }]}>{desc}</Text>}
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={destructive ? colors.danger : colors.accent} />
      ) : showChevron ? (
        <ChevronRight size={17} color={colors.textTertiary} />
      ) : null}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  disabled: {
    opacity: 0.55,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  desc: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    lineHeight: 18,
  },
});

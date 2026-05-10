import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { colors, spacing, fontSizes } from '../constants/theme';

interface Props {
  title: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
}

export default React.memo(function ScreenHeader({ title, onBack, rightAction }: Props) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.iconBtn} />
      )}
      <Text style={styles.title}>{title}</Text>
      {rightAction ?? <View style={styles.iconBtn} />}
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
});

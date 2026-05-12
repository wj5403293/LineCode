import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, Plus, Shield, MoreVertical, Menu } from 'lucide-react-native';
import { spacing, fontSizes } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  projectLabel: string;
  onPressMenu: () => void;
  onPressProject: () => void;
  onPressPermission: () => void;
  onPressAdd: () => void;
  onPressMore: () => void;
}

export default React.memo(function Header({
  projectLabel, onPressMenu, onPressProject, onPressPermission, onPressAdd, onPressMore,
}: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { backgroundColor: colors.bg, borderBottomColor: colors.border }]}>
      <TouchableOpacity style={styles.iconBtn} onPress={onPressMenu} activeOpacity={0.6}>
        <Menu size={20} color={colors.text} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.projectBtn} onPress={onPressProject} activeOpacity={0.6}>
        <View style={[styles.statusDot, { backgroundColor: colors.accent }]} />
        <Text style={[styles.projectName, { color: colors.text }]}>{projectLabel}</Text>
        <ChevronDown size={14} color={colors.textSecondary} />
      </TouchableOpacity>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.iconBtn} onPress={onPressPermission} activeOpacity={0.6}>
          <Shield size={18} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onPressAdd} activeOpacity={0.6}>
          <Plus size={20} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={onPressMore} activeOpacity={0.6}>
          <MoreVertical size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  projectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  projectName: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

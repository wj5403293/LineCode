import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Check } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';

interface Option {
  id: string;
  label: string;
  desc?: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: Option[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  icon?: React.ReactNode;
}

interface ItemProps {
  item: Option;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const DialogItem = React.memo(function DialogItem({ item, isSelected, onSelect }: ItemProps) {
  const { colors } = useTheme();
  const style = useMemo(() => [styles.item, isSelected && { backgroundColor: colors.accentMuted }], [isSelected, colors.accentMuted]);
  return (
    <TouchableOpacity style={style} onPress={() => onSelect(item.id)} activeOpacity={0.6}>
      <View style={styles.itemContent}>
        <Text style={[styles.label, { color: colors.text }]}>{item.label}</Text>
        {item.desc && <Text style={[styles.desc, { color: colors.textTertiary }]}>{item.desc}</Text>}
      </View>
      {isSelected && <Check size={18} color={colors.accent} />}
    </TouchableOpacity>
  );
});

function Dialog({ visible, title, options, selectedId, onSelect, onClose, icon }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={[styles.backdrop, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[styles.handle, { backgroundColor: colors.textTertiary }]} />
          <View style={styles.header}>
            {icon}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          {options.map(opt => (
            <DialogItem
              key={opt.id}
              item={opt}
              isSelected={opt.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </View>
      </View>
    </Modal>
  );
}

export default React.memo(Dialog);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  itemActive: {},
  itemContent: {
    flex: 1,
  },
  label: {
    fontSize: fontSizes.md,
  },
  desc: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});

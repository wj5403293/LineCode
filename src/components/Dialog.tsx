import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

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
  const style = useMemo(() => [styles.item, isSelected && styles.itemActive], [isSelected]);
  return (
    <TouchableOpacity style={style} onPress={() => onSelect(item.id)} activeOpacity={0.6}>
      <View style={styles.itemContent}>
        <Text style={styles.label}>{item.label}</Text>
        {item.desc && <Text style={styles.desc}>{item.desc}</Text>}
      </View>
      {isSelected && <Check size={18} color={colors.accent} />}
    </TouchableOpacity>
  );
});

function Dialog({ visible, title, options, selectedId, onSelect, onClose, icon }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            {icon}
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.divider} />
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
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.textTertiary,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  sheet: {
    backgroundColor: colors.surfaceElevated,
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
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.borderLight,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  itemActive: {
    backgroundColor: 'rgba(48, 209, 88, 0.08)',
  },
  itemContent: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: fontSizes.md,
  },
  desc: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});

import React from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { fontSizes, radius, spacing } from '../constants/theme';
import { useTheme } from '../theme';

interface Props {
  visible: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function CreateProjectModal({
  visible,
  value,
  onChangeText,
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modalCard, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>创建项目</Text>
          <TextInput
            style={[styles.modalInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.borderLight }]}
            value={value}
            onChangeText={onChangeText}
            placeholder="项目名称"
            placeholderTextColor={colors.textTertiary}
            autoFocus
            autoCapitalize="none"
          />
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalBtn} onPress={onCancel}>
              <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.accent }]} onPress={onConfirm}>
              <Text style={[styles.modalBtnText, { color: colors.textOnColor }]}>创建</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.md,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalBtn: {
    minHeight: 38,
    minWidth: 72,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  modalBtnText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
});

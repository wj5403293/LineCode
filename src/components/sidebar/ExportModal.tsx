import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { spacing, fontSizes, radius } from '../../constants/theme';
import { useTheme } from '../../theme';

interface ExportModalProps {
  visible: boolean;
  result?: string | null;
  error?: string | null;
  onClose: () => void;
}

export function ExportModal({ visible, result, error, onClose }: ExportModalProps) {
  const { colors } = useTheme();
  if (!result && !error) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.modal, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.title, { color: colors.text }]}>{error ? '导出失败' : '导出成功'}</Text>
          <Text style={[styles.path, { color: colors.textSecondary }]}>{error || result}</Text>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.accent }]} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textOnColor }]}>确定</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modal: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  path: {
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontFamily: 'monospace',
  },
  closeBtn: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  closeText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});

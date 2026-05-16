import React from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Download, X } from 'lucide-react-native';
import { HotUpdateInfo } from '../services/HotUpdateService';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import SettingsSwitch from './SettingsSwitch';

interface Props {
  visible: boolean;
  update: HotUpdateInfo | null;
  autoUpdateEnabled?: boolean;
  installing: boolean;
  error?: string | null;
  onToggleAutoUpdate?: (enabled: boolean) => void | Promise<void>;
  onUpdate: () => void;
  onCancel: () => void;
}

export default function UpdatePromptModal({
  visible,
  update,
  autoUpdateEnabled,
  installing,
  error,
  onToggleAutoUpdate,
  onUpdate,
  onCancel,
}: Props) {
  const { colors } = useTheme();
  if (!update) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.panel, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: colors.accentMuted }]}>
              <Download size={20} color={colors.accent} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>发现新版本</Text>
              <Text style={[styles.version, { color: colors.textSecondary }]}>{update.versionName}</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel} disabled={installing}>
              <X size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={[styles.logBox, { backgroundColor: colors.surfaceLight }]} contentContainerStyle={styles.logContent}>
            <Text style={[styles.logText, { color: colors.textSecondary }]}>
              {update.changelog || '暂无更新日志'}
            </Text>
          </ScrollView>

          {error && (
            <View style={[styles.errorBox, { backgroundColor: colors.dangerMuted, borderColor: colors.danger }]}>
              <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
            </View>
          )}

          {typeof autoUpdateEnabled === 'boolean' && onToggleAutoUpdate && (
            <View style={[styles.switchRow, { borderColor: colors.borderLight }]}>
              <View style={styles.switchText}>
                <Text style={[styles.switchLabel, { color: colors.text }]}>自动检查更新</Text>
                <Text style={[styles.switchDesc, { color: colors.textTertiary }]}>启动时检查 base.zip 详情</Text>
              </View>
              <SettingsSwitch
                value={autoUpdateEnabled}
                onValueChange={onToggleAutoUpdate}
                disabled={installing}
              />
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.border }]}
              onPress={onCancel}
              disabled={installing}
            >
              <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.accent }, installing && styles.disabledButton]}
              onPress={onUpdate}
              disabled={installing}
            >
              {installing ? (
                <ActivityIndicator size="small" color={colors.textOnColor} />
              ) : (
                <Text style={[styles.primaryText, { color: colors.textOnColor }]}>更新</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  panel: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  version: {
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBox: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    maxHeight: 180,
  },
  logContent: {
    padding: spacing.md,
  },
  logText: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: fontSizes.sm,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  switchText: {
    flex: 1,
    paddingRight: spacing.md,
  },
  switchLabel: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  switchDesc: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  primaryButton: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.65,
  },
  secondaryText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  primaryText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});

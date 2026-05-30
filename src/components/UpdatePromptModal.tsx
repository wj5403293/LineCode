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
import { AlertTriangle, Download, PackageOpen, X } from 'lucide-react-native';
import { HotUpdateInfo } from '../services/HotUpdateService';
import { APP_ANDROID_VERSION_CODE, APP_VERSION } from '../constants/appInfo';
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
  const apkLabel = update.requiresApk
    ? `目标 APK ${update.versionName}`
    : `当前 APK ${APP_VERSION} (${APP_ANDROID_VERSION_CODE})`;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.panel, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.header}>
            <View style={[styles.iconWrap, { backgroundColor: colors.accentMuted }]}>
              {update.requiresApk
                ? <PackageOpen size={22} color={colors.accent} />
                : <Download size={22} color={colors.accent} />}
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text }]}>发现更新链路</Text>
              <Text style={[styles.version, { color: colors.textSecondary }]}>
                {apkLabel}
              </Text>
              <Text style={[styles.version, { color: colors.textSecondary }]}>
                热补丁将更新到 {update.versionName} ({update.versionCode})
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onCancel} disabled={installing}>
              <X size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {update.requiresApk && (
            <View style={[styles.apkNotice, { backgroundColor: colors.processingMuted, borderColor: colors.warning }]}>
              <AlertTriangle size={15} color={colors.warning} />
              <Text style={[styles.apkNoticeText, { color: colors.text }]}>
                此更新链路包含需要新版 APK 的版本，将下载加密安装包并打开系统安装器。
              </Text>
            </View>
          )}

          <ScrollView style={[styles.logBox, { backgroundColor: colors.surfaceLight, borderColor: colors.borderLight }]} contentContainerStyle={styles.logContent}>
            {(update.updateChain.length > 0 ? update.updateChain : [{
              versionCode: update.versionCode,
              versionName: update.versionName,
              changelog: update.changelog,
              requiresApk: update.requiresApk,
            }]).map((item, index) => (
              <View
                key={`${item.versionCode}-${index}`}
                style={[
                  styles.chainItem,
                  { borderColor: colors.borderLight },
                  index === 0 && styles.firstChainItem,
                ]}
              >
                <View style={styles.chainHeader}>
                  <Text style={[styles.chainTitle, { color: colors.text }]}>{item.versionName}</Text>
                  <Text style={[styles.chainBadge, { color: item.requiresApk ? colors.warning : colors.accent }]}>
                    {item.requiresApk ? '需要 APK' : '热更新'}
                  </Text>
                </View>
                <Text style={[styles.chainCode, { color: colors.textTertiary }]}>版本号 {item.versionCode}</Text>
                <Text style={[styles.logText, { color: colors.textSecondary }]}>
                  {item.changelog || '暂无更新日志'}
                </Text>
              </View>
            ))}
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
                <Text style={[styles.switchDesc, { color: colors.textTertiary }]}>启动时检查 base.txt 更新链路</Text>
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
                <Text style={[styles.primaryText, { color: colors.textOnColor }]}>
                  {update.requiresApk ? '安装 APK' : '安装热更新'}
                </Text>
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
    padding: spacing.lg,
  },
  panel: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
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
    maxHeight: 360,
    borderWidth: StyleSheet.hairlineWidth,
  },
  logContent: {
    padding: spacing.md,
  },
  apkNotice: {
    marginTop: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  apkNoticeText: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.sm,
    lineHeight: 19,
  },
  chainItem: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
    marginTop: spacing.md,
    gap: 4,
  },
  firstChainItem: {
    borderTopWidth: 0,
    paddingTop: 0,
    marginTop: 0,
  },
  chainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chainTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  chainBadge: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  chainCode: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
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

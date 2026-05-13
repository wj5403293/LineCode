import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BatteryCharging, Bell, Music, Zap } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SwitchRow from '../components/SwitchRow';
import { spacing, radius } from '../constants/theme';
import { useTheme } from '../theme';
import { KeepAliveSettings, settingsService } from '../services/settings';
import { requestIgnoreBatteryOptimizations, setFakeMusicPlayback, setForegroundCodingService, setKeepAwake } from '../utils/keepAwake';

interface Props {
  onBack: () => void;
}

const DEFAULT_SETTINGS: KeepAliveSettings = {
  wakeLock: true,
  foregroundService: false,
  fakeMusic: false,
  ignoreBatteryOptimizations: false,
};

export default function KeepAliveSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [settings, setSettings] = useState<KeepAliveSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    settingsService.getKeepAliveSettings().then(setSettings).catch(() => {});
  }, []);

  const update = useCallback(async (patch: Partial<KeepAliveSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await settingsService.setKeepAliveSettings(next);
  }, [settings]);

  const handleWakeLock = useCallback((enabled: boolean) => {
    update({ wakeLock: enabled }).catch(() => {});
    if (!enabled) setKeepAwake(false);
  }, [update]);

  const handleForegroundService = useCallback((enabled: boolean) => {
    update({ foregroundService: enabled }).catch(() => {});
    if (!enabled) setForegroundCodingService(false);
  }, [update]);

  const handleFakeMusic = useCallback((enabled: boolean) => {
    update({ fakeMusic: enabled }).catch(() => {});
    if (!enabled) setFakeMusicPlayback(false);
  }, [update]);

  const handleBattery = useCallback(async (enabled: boolean) => {
    await update({ ignoreBatteryOptimizations: enabled });
    if (enabled) {
      try {
        await requestIgnoreBatteryOptimizations();
      } catch (err: any) {
        Alert.alert('申请失败', err?.message || String(err));
      }
    }
  }, [update]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="保活设置" onBack={onBack} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SectionHeader title="编码任务保活" />
          <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
            <SwitchRow
              icon={<Zap size={20} color={colors.textSecondary} />}
              label="Wake Lock"
              desc="对话生成和压缩时保持 CPU 与屏幕唤醒"
              value={settings.wakeLock}
              onValueChange={handleWakeLock}
            />
            <SwitchRow
              icon={<Bell size={20} color={colors.textSecondary} />}
              label="前台服务通知"
              desc="后台运行时挂通知，显示“正在编码”"
              value={settings.foregroundService}
              onValueChange={handleForegroundService}
            />
            <SwitchRow
              icon={<Music size={20} color={colors.textSecondary} />}
              label="假音乐播放"
              desc="后台任务期间启动静音 AudioTrack"
              value={settings.fakeMusic}
              onValueChange={handleFakeMusic}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="系统白名单" />
          <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
            <SwitchRow
              icon={<BatteryCharging size={20} color={colors.textSecondary} />}
              label="忽略电池优化"
              desc="打开 Android 白名单申请页面"
              value={settings.ignoreBatteryOptimizations}
              onValueChange={handleBattery}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingBottom: 100 },
  section: { paddingTop: spacing.xl },
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});

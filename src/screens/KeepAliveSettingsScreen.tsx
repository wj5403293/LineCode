import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BatteryCharging, Bell, Music, Zap } from 'lucide-react-native';
import SwitchRow from '../components/SwitchRow';
import { useTheme } from '../theme';
import { KeepAliveSettings, settingsService } from '../services/settings';
import { requestIgnoreBatteryOptimizations, setFakeMusicPlayback, setForegroundCodingService, setKeepAwake } from '../utils/keepAwake';
import { ScreenScaffold, SettingsSection } from '../components/ui';

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
  const { colors } = useTheme();
  const [settings, setSettings] = useState<KeepAliveSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    settingsService.getKeepAliveSettings()
      .then(nextSettings => {
        settingsRef.current = nextSettings;
        setSettings(nextSettings);
      })
      .catch(() => {});
  }, []);

  const update = useCallback(async (patch: Partial<KeepAliveSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    await settingsService.setKeepAliveSettings(next);
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const requestNotificationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }, []);

  const handleWakeLock = useCallback(async (enabled: boolean) => {
    await update({ wakeLock: enabled });
    if (!enabled) setKeepAwake(false);
  }, [update]);

  const handleForegroundService = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        Alert.alert('通知权限未开启', 'Android 13 及以上需要允许通知后才能显示“正在编码”。');
        throw new Error('通知权限未开启');
      }
    }
    const previous = settingsRef.current.foregroundService;
    await update({ foregroundService: enabled });
    try {
      await setForegroundCodingService(enabled);
    } catch (err) {
      await update({ foregroundService: previous });
      throw err;
    }
  }, [requestNotificationPermission, update]);

  const handleFakeMusic = useCallback(async (enabled: boolean) => {
    const previous = settingsRef.current.fakeMusic;
    await update({ fakeMusic: enabled });
    try {
      await setFakeMusicPlayback(enabled);
    } catch (err) {
      await update({ fakeMusic: previous });
      throw err;
    }
  }, [update]);

  const handleBattery = useCallback(async (enabled: boolean) => {
    const previous = settingsRef.current.ignoreBatteryOptimizations;
    await update({ ignoreBatteryOptimizations: enabled });
    if (enabled) {
      try {
        await requestIgnoreBatteryOptimizations();
      } catch (err: any) {
        await update({ ignoreBatteryOptimizations: previous });
        Alert.alert('申请失败', err?.message || String(err));
        throw err;
      }
    }
  }, [update]);

  return (
    <ScreenScaffold title="保活设置" onBack={onBack}>
      <SettingsSection title="编码任务保活">
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
          desc="开启后常驻显示“正在编码”通知"
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
      </SettingsSection>

      <SettingsSection title="系统白名单">
        <SwitchRow
          icon={<BatteryCharging size={20} color={colors.textSecondary} />}
          label="忽略电池优化"
          desc="打开 Android 白名单申请页面"
          value={settings.ignoreBatteryOptimizations}
          onValueChange={handleBattery}
        />
      </SettingsSection>
    </ScreenScaffold>
  );
}

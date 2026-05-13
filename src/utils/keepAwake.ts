import { NativeModules } from 'react-native';

type KeepAwakeModule = {
  setEnabled?: (enabled: boolean) => Promise<void>;
  setForegroundServiceEnabled?: (enabled: boolean) => Promise<void>;
  setFakeMusicEnabled?: (enabled: boolean) => Promise<void>;
  requestIgnoreBatteryOptimizations?: () => Promise<boolean>;
};

const KeepAwake = NativeModules.KeepAwake as KeepAwakeModule | undefined;

export function setKeepAwake(enabled: boolean): void {
  KeepAwake?.setEnabled?.(enabled).catch((err: unknown) => {
    console.warn('[LineCode] KeepAwake failed:', err);
  });
}

export function setForegroundCodingService(enabled: boolean): Promise<void> {
  return KeepAwake?.setForegroundServiceEnabled?.(enabled).catch((err: unknown) => {
    console.warn('[LineCode] Foreground service failed:', err);
  }) || Promise.resolve();
}

export function setFakeMusicPlayback(enabled: boolean): Promise<void> {
  return KeepAwake?.setFakeMusicEnabled?.(enabled).catch((err: unknown) => {
    console.warn('[LineCode] Fake music failed:', err);
  }) || Promise.resolve();
}

export function requestIgnoreBatteryOptimizations(): Promise<boolean> {
  return KeepAwake?.requestIgnoreBatteryOptimizations?.() || Promise.resolve(false);
}

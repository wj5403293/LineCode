import { NativeModules } from 'react-native';

type KeepAwakeModule = {
  setEnabled?: (enabled: boolean) => Promise<void>;
};

const KeepAwake = NativeModules.KeepAwake as KeepAwakeModule | undefined;

export function setKeepAwake(enabled: boolean): void {
  KeepAwake?.setEnabled?.(enabled).catch((err: unknown) => {
    console.warn('[LineCode] KeepAwake failed:', err);
  });
}

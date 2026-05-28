import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';

export interface AndroidKeyboardFrame {
  visibleBottom: number;
  windowHeight: number;
  keyboardHeight: number;
}

type KeyboardFrameModuleType = {
  start?: () => void;
  stop?: () => void;
};

const EVENT_NAME = 'LineCodeKeyboardFrameChanged';

function getKeyboardFrameModule(): KeyboardFrameModuleType | undefined {
  return NativeModules.KeyboardFrameModule as KeyboardFrameModuleType | undefined;
}

export function addAndroidKeyboardFrameListener(listener: (frame: AndroidKeyboardFrame) => void): () => void {
  const keyboardFrameModule = getKeyboardFrameModule();
  if (Platform.OS !== 'android' || !keyboardFrameModule?.start) {
    return () => {};
  }

  const subscription = DeviceEventEmitter.addListener(EVENT_NAME, (event: Partial<AndroidKeyboardFrame>) => {
    const windowHeight = Number(event.windowHeight || 0);
    const visibleBottom = Number(event.visibleBottom || 0);
    const keyboardHeight = Number(event.keyboardHeight || Math.max(0, windowHeight - visibleBottom));
    listener({ visibleBottom, windowHeight, keyboardHeight });
  });

  keyboardFrameModule.start();

  return () => {
    subscription.remove();
    keyboardFrameModule.stop?.();
  };
}

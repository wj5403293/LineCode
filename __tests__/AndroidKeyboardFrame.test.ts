import { DeviceEventEmitter, NativeModules, Platform } from 'react-native';
import { addAndroidKeyboardFrameListener } from '../src/utils/androidKeyboardFrame';

describe('addAndroidKeyboardFrameListener', () => {
  const originalOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    NativeModules.KeyboardFrameModule = {
      start: jest.fn(),
      stop: jest.fn(),
    };
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    delete NativeModules.KeyboardFrameModule;
  });

  it('starts native PopupWindow listener and normalizes frame events', () => {
    const listener = jest.fn();
    const remove = addAndroidKeyboardFrameListener(listener);

    DeviceEventEmitter.emit('LineCodeKeyboardFrameChanged', {
      visibleBottom: 640,
      windowHeight: 1000,
    });

    expect(NativeModules.KeyboardFrameModule.start).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      visibleBottom: 640,
      windowHeight: 1000,
      keyboardHeight: 360,
    });

    remove();
    expect(NativeModules.KeyboardFrameModule.stop).toHaveBeenCalledTimes(1);
  });
});

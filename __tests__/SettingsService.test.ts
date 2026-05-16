import AsyncStorage from '@react-native-async-storage/async-storage';
import { settingsService } from '../src/services/settings';

describe('settingsService math formula rendering', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('defaults math formula rendering to disabled', async () => {
    await expect(settingsService.getMathFormulaRenderingEnabled()).resolves.toBe(false);
  });

  it('persists math formula rendering changes', async () => {
    await settingsService.setMathFormulaRenderingEnabled(true);
    await expect(settingsService.getMathFormulaRenderingEnabled()).resolves.toBe(true);

    await settingsService.setMathFormulaRenderingEnabled(false);
    await expect(settingsService.getMathFormulaRenderingEnabled()).resolves.toBe(false);
  });

  it('notifies subscribers after setting changes', async () => {
    const listener = jest.fn();
    const unsubscribe = settingsService.subscribe(listener);

    await settingsService.setMathFormulaRenderingEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    await settingsService.setMathFormulaRenderingEnabled(false);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

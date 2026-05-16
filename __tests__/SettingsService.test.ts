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
});

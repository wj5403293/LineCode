import AsyncStorage from '@react-native-async-storage/async-storage';
import { isLearningModeEnabled, setLearningModeEnabled } from '../src/services/LearningModeService';
import { modelStorage } from '../src/services/storage';
import { Model } from '../src/types';

describe('LearningModeService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('uses global learning mode setting for new model behavior', async () => {
    expect(await isLearningModeEnabled(null)).toBe(false);

    await setLearningModeEnabled(true);

    expect(await isLearningModeEnabled(null)).toBe(true);
  });

  it('migrates legacy per-model learningMode flags out of stored models', async () => {
    const legacy: Model = {
      id: 'm1',
      name: 'Legacy',
      provider: 'openai',
      modelId: 'gpt-test',
      apiKey: 'key',
      learningMode: true,
    };
    await modelStorage.saveModels([legacy]);

    expect(await isLearningModeEnabled(legacy)).toBe(true);
    await setLearningModeEnabled(false);

    const [stored] = await modelStorage.getModels();
    expect(stored.learningMode).toBeUndefined();
    expect(await isLearningModeEnabled(stored)).toBe(false);
  });
});

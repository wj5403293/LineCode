import AsyncStorage from '@react-native-async-storage/async-storage';
import { modelStorage } from '../src/services/storage';

describe('modelStorage learning mode migration', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('normalizes legacy models to learningMode false', async () => {
    await AsyncStorage.setItem('@lineai_models', JSON.stringify([
      {
        id: 'legacy',
        name: 'Legacy',
        provider: 'openai',
        modelId: 'gpt-test',
        apiKey: 'sk-test',
      },
      {
        id: 'enabled',
        name: 'Enabled',
        provider: 'anthropic',
        modelId: 'claude-test',
        apiKey: 'sk-test',
        learningMode: true,
      },
    ]));

    const models = await modelStorage.getModels();

    expect(models[0].learningMode).toBe(false);
    expect(models[1].learningMode).toBe(true);
  });

  it('persists an explicit learningMode boolean when saving models', async () => {
    await modelStorage.saveModels([
      {
        id: 'new',
        name: 'New',
        provider: 'openai',
        modelId: 'gpt-test',
        apiKey: 'sk-test',
        learningMode: true,
      },
    ]);

    const raw = await AsyncStorage.getItem('@lineai_models');
    expect(raw).toContain('"learningMode":true');
  });
});

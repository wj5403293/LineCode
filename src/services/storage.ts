import AsyncStorage from '@react-native-async-storage/async-storage';
import { Model } from '../types';

const KEYS = {
  MODELS: '@lineai_models',
  SELECTED_MODEL: '@lineai_selected_model',
} as const;

class ModelStorage {
  async getModels(): Promise<Model[]> {
    const json = await AsyncStorage.getItem(KEYS.MODELS);
    return json ? JSON.parse(json) : [];
  }

  async saveModels(models: Model[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.MODELS, JSON.stringify(models));
  }

  async getSelectedModelId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.SELECTED_MODEL);
  }

  async setSelectedModelId(id: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.SELECTED_MODEL, id);
  }
}

export const modelStorage = new ModelStorage();

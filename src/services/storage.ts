import AsyncStorage from '@react-native-async-storage/async-storage';
import { Model } from '../types';

const KEYS = {
  MODELS: '@lineai_models',
  SELECTED_MODEL: '@lineai_selected_model',
} as const;

class ModelStorage {
  private selectedModelListeners = new Set<(id: string) => void>();

  private normalizeModel(model: Model): Model {
    return { ...model };
  }

  async getModels(): Promise<Model[]> {
    const json = await AsyncStorage.getItem(KEYS.MODELS);
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed) ? parsed.map(model => this.normalizeModel(model)) : [];
  }

  async saveModels(models: Model[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.MODELS, JSON.stringify(models.map(model => this.normalizeModel(model))));
  }

  async getSelectedModelId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.SELECTED_MODEL);
  }

  async setSelectedModelId(id: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.SELECTED_MODEL, id);
    this.selectedModelListeners.forEach(listener => listener(id));
  }

  subscribeSelectedModel(listener: (id: string) => void): () => void {
    this.selectedModelListeners.add(listener);
    return () => {
      this.selectedModelListeners.delete(listener);
    };
  }
}

export const modelStorage = new ModelStorage();

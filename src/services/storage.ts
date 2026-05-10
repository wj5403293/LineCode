import AsyncStorage from '@react-native-async-storage/async-storage';
import { Model } from '../types';

const MODELS_KEY = '@lineai_models';
const SELECTED_KEY = '@lineai_selected_model';

export async function getModels(): Promise<Model[]> {
  const json = await AsyncStorage.getItem(MODELS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveModels(models: Model[]): Promise<void> {
  await AsyncStorage.setItem(MODELS_KEY, JSON.stringify(models));
}

export async function getSelectedModelId(): Promise<string | null> {
  return AsyncStorage.getItem(SELECTED_KEY);
}

export async function setSelectedModelId(id: string): Promise<void> {
  await AsyncStorage.setItem(SELECTED_KEY, id);
}

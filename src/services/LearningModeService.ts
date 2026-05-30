import { settingsService } from './settings';
import { modelStorage } from './storage';
import { Model } from '../types';

export async function isLearningModeEnabled(model?: Pick<Model, 'learningMode'> | null): Promise<boolean> {
  if (model?.learningMode === true) return true;
  return settingsService.getLearningModeEnabled();
}

export async function setLearningModeEnabled(enabled: boolean): Promise<void> {
  await settingsService.setLearningModeEnabled(enabled);
  const models = await modelStorage.getModels();
  const migrated = models.map(model => {
    if (model.learningMode === undefined) return model;
    const rest = { ...model };
    delete rest.learningMode;
    return rest as Model;
  });
  if (migrated.some((model, index) => model !== models[index])) {
    await modelStorage.saveModels(migrated);
  }
}

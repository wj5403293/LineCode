import { NativeModules, Platform } from 'react-native';

type LineAIConfigNativeModule = {
  localModelEnabled?: boolean;
  modelRuntime?: string;
};

const LineAIConfig = NativeModules.LineAIConfig as LineAIConfigNativeModule | undefined;

export const MODEL_RUNTIME = LineAIConfig?.modelRuntime || 'local';

export const LOCAL_MODEL_ENABLED = Platform.OS === 'android'
  ? LineAIConfig?.localModelEnabled !== false
  : true;

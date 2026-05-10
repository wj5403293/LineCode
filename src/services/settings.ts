import AsyncStorage from '@react-native-async-storage/async-storage';

const CODE_WRAP_KEY = '@lineai_code_wrap';
const DISPLAY_MODE_KEY = '@lineai_display_mode';
const TONE_KEY = '@lineai_tone';
const THINKING_SCROLL_KEY = '@lineai_thinking_scroll';
const THINKING_AUTO_EXPAND_KEY = '@lineai_thinking_auto_expand';

export type DisplayMode = 'bubble' | 'fullscreen';
export type ToneMode = 'chat' | 'coding';

export async function getCodeWrap(): Promise<boolean> {
  const value = await AsyncStorage.getItem(CODE_WRAP_KEY);
  return value === 'true';
}

export async function setCodeWrap(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(CODE_WRAP_KEY, String(enabled));
}

export async function getDisplayMode(): Promise<DisplayMode> {
  const value = await AsyncStorage.getItem(DISPLAY_MODE_KEY);
  return (value as DisplayMode) || 'fullscreen';
}

export async function setDisplayMode(mode: DisplayMode): Promise<void> {
  await AsyncStorage.setItem(DISPLAY_MODE_KEY, mode);
}

export async function getToneMode(): Promise<ToneMode> {
  const value = await AsyncStorage.getItem(TONE_KEY);
  return (value as ToneMode) || 'coding';
}

export async function setToneMode(mode: ToneMode): Promise<void> {
  await AsyncStorage.setItem(TONE_KEY, mode);
}

export async function getThinkingScroll(): Promise<boolean> {
  const value = await AsyncStorage.getItem(THINKING_SCROLL_KEY);
  return value !== 'false'; // default true
}

export async function setThinkingScroll(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(THINKING_SCROLL_KEY, String(enabled));
}

export async function getThinkingAutoExpand(): Promise<boolean> {
  const value = await AsyncStorage.getItem(THINKING_AUTO_EXPAND_KEY);
  return value === 'true'; // default false
}

export async function setThinkingAutoExpand(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(THINKING_AUTO_EXPAND_KEY, String(enabled));
}

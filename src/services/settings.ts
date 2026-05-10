import AsyncStorage from '@react-native-async-storage/async-storage';

export type DisplayMode = 'bubble' | 'fullscreen';
export type ToneMode = 'chat' | 'coding';

const KEYS = {
  CODE_WRAP: '@lineai_code_wrap',
  DISPLAY_MODE: '@lineai_display_mode',
  TONE: '@lineai_tone',
  THINKING_SCROLL: '@lineai_thinking_scroll',
  THINKING_AUTO_EXPAND: '@lineai_thinking_auto_expand',
} as const;

class SettingsService {
  private async get<T>(key: string, fallback: T): Promise<T> {
    const value = await AsyncStorage.getItem(key);
    if (value === null) return fallback;
    return value as unknown as T;
  }

  private async set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, String(value));
  }

  async getCodeWrap(): Promise<boolean> {
    return this.get(KEYS.CODE_WRAP, false);
  }

  async setCodeWrap(enabled: boolean): Promise<void> {
    await this.set(KEYS.CODE_WRAP, enabled);
  }

  async getDisplayMode(): Promise<DisplayMode> {
    return this.get(KEYS.DISPLAY_MODE, 'fullscreen' as DisplayMode);
  }

  async setDisplayMode(mode: DisplayMode): Promise<void> {
    await this.set(KEYS.DISPLAY_MODE, mode);
  }

  async getToneMode(): Promise<ToneMode> {
    return this.get(KEYS.TONE, 'coding' as ToneMode);
  }

  async setToneMode(mode: ToneMode): Promise<void> {
    await this.set(KEYS.TONE, mode);
  }

  async getThinkingScroll(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.THINKING_SCROLL);
    return value !== 'false';
  }

  async setThinkingScroll(enabled: boolean): Promise<void> {
    await this.set(KEYS.THINKING_SCROLL, enabled);
  }

  async getThinkingAutoExpand(): Promise<boolean> {
    return this.get(KEYS.THINKING_AUTO_EXPAND, false);
  }

  async setThinkingAutoExpand(enabled: boolean): Promise<void> {
    await this.set(KEYS.THINKING_AUTO_EXPAND, enabled);
  }
}

export const settingsService = new SettingsService();

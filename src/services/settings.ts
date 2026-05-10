import AsyncStorage from '@react-native-async-storage/async-storage';

export type DisplayMode = 'bubble' | 'fullscreen';
export type ToneMode = 'chat' | 'coding';
export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high' | 'max';
export type PermissionMode = 'readonly' | 'auto' | 'confirm';

export const REASONING_EFFORT_DESC: Record<ReasoningEffort, { label: string; desc: string }> = {
  off: { label: '关闭', desc: '不启用思考模式，响应更快' },
  low: { label: '低', desc: '简短思考，适合简单任务' },
  medium: { label: '中', desc: '标准思考深度，平衡速度和质量' },
  high: { label: '高', desc: '深度思考，适合复杂任务' },
  max: { label: '最高', desc: '最深度思考，适合极难问题' },
};

export const PERMISSION_MODE_DESC: Record<PermissionMode, { label: string; desc: string }> = {
  readonly: { label: '只读', desc: '仅允许读取文件，禁止写入和删除' },
  auto: { label: '自动', desc: '自动执行所有操作，删除需确认' },
  confirm: { label: '确认', desc: '危险操作需要用户确认' },
};

const KEYS = {
  CODE_WRAP: '@lineai_code_wrap',
  DISPLAY_MODE: '@lineai_display_mode',
  TONE: '@lineai_tone',
  THINKING_SCROLL: '@lineai_thinking_scroll',
  THINKING_AUTO_EXPAND: '@lineai_thinking_auto_expand',
  REASONING_EFFORT: '@lineai_reasoning_effort',
  PERMISSION_MODE: '@lineai_permission_mode',
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

  async getReasoningEffort(): Promise<ReasoningEffort> {
    return this.get(KEYS.REASONING_EFFORT, 'medium' as ReasoningEffort);
  }

  async setReasoningEffort(effort: ReasoningEffort): Promise<void> {
    await this.set(KEYS.REASONING_EFFORT, effort);
  }

  async getPermissionMode(): Promise<PermissionMode> {
    return this.get(KEYS.PERMISSION_MODE, 'auto' as PermissionMode);
  }

  async setPermissionMode(mode: PermissionMode): Promise<void> {
    await this.set(KEYS.PERMISSION_MODE, mode);
  }
}

export const settingsService = new SettingsService();

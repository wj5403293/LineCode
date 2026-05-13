import AsyncStorage from '@react-native-async-storage/async-storage';

export type DisplayMode = 'bubble' | 'fullscreen';
export type ToneMode = 'chat' | 'coding';
export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high' | 'max';
export type PermissionMode = 'readonly' | 'auto' | 'confirm';
export type ThemeMode = 'system' | 'light' | 'dark' | 'coffee' | 'vscode' | 'githubDark' | 'gruvbox' | 'highContrast' | 'custom';
export type BrowserMode = 'builtin' | 'external';
export type MCPExecutionMode = 'local' | 'ssh';

const THEME_MODES: readonly ThemeMode[] = [
  'system',
  'light',
  'dark',
  'coffee',
  'vscode',
  'githubDark',
  'gruvbox',
  'highContrast',
  'custom',
];

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
  PRESERVE_REASONING: '@lineai_preserve_reasoning',
  PERMISSION_MODE: '@lineai_permission_mode',
  THEME_MODE: '@lineai_theme_mode',
  CUSTOM_THEME_COLORS: '@lineai_custom_theme_colors',
  BROWSER_MODE: '@lineai_browser_mode',
  GPT55_PROMO_SEEN: '@lineai_gpt55_promo_seen',
  FIRST_LAUNCH_GUIDE_SEEN: '@lineai_first_launch_guide_seen',
  MCP_EXECUTION_MODE: '@lineai_mcp_execution_mode',
  AUTO_UPDATE_ENABLED: '@linecode_auto_update_enabled',
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

  async getPreserveReasoning(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.PRESERVE_REASONING);
    return value === 'true';
  }

  async setPreserveReasoning(enabled: boolean): Promise<void> {
    await this.set(KEYS.PRESERVE_REASONING, enabled);
  }

  async getPermissionMode(): Promise<PermissionMode> {
    return this.get(KEYS.PERMISSION_MODE, 'auto' as PermissionMode);
  }

  async setPermissionMode(mode: PermissionMode): Promise<void> {
    await this.set(KEYS.PERMISSION_MODE, mode);
  }

  async getThemeMode(): Promise<ThemeMode> {
    const mode = await this.get(KEYS.THEME_MODE, 'system' as ThemeMode);
    return THEME_MODES.includes(mode) ? mode : 'system';
  }

  async setThemeMode(mode: ThemeMode): Promise<void> {
    await this.set(KEYS.THEME_MODE, mode);
  }

  async getCustomThemeColors(): Promise<Record<string, string> | null> {
    const json = await AsyncStorage.getItem(KEYS.CUSTOM_THEME_COLORS);
    if (!json) return null;
    try {
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  async setCustomThemeColors(colors: Record<string, string>): Promise<void> {
    await AsyncStorage.setItem(KEYS.CUSTOM_THEME_COLORS, JSON.stringify(colors));
  }

  async getBrowserMode(): Promise<BrowserMode> {
    return this.get(KEYS.BROWSER_MODE, 'builtin' as BrowserMode);
  }

  async setBrowserMode(mode: BrowserMode): Promise<void> {
    await this.set(KEYS.BROWSER_MODE, mode);
  }

  async getMCPExecutionMode(): Promise<MCPExecutionMode> {
    return this.get(KEYS.MCP_EXECUTION_MODE, 'local' as MCPExecutionMode);
  }

  async setMCPExecutionMode(mode: MCPExecutionMode): Promise<void> {
    await this.set(KEYS.MCP_EXECUTION_MODE, mode);
  }

  async getGpt55PromoSeen(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.GPT55_PROMO_SEEN);
    return value === 'true';
  }

  async setGpt55PromoSeen(seen: boolean): Promise<void> {
    await this.set(KEYS.GPT55_PROMO_SEEN, seen);
  }

  async getFirstLaunchGuideSeen(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.FIRST_LAUNCH_GUIDE_SEEN);
    return value === 'true';
  }

  async setFirstLaunchGuideSeen(seen: boolean): Promise<void> {
    await this.set(KEYS.FIRST_LAUNCH_GUIDE_SEEN, seen);
  }

  async getAutoUpdateEnabled(): Promise<boolean> {
    const value = await AsyncStorage.getItem(KEYS.AUTO_UPDATE_ENABLED);
    return value === 'true';
  }

  async setAutoUpdateEnabled(enabled: boolean): Promise<void> {
    await this.set(KEYS.AUTO_UPDATE_ENABLED, enabled);
  }
}

export const settingsService = new SettingsService();

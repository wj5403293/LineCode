import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter, EmitterSubscription, NativeModules, Platform } from 'react-native';

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey: string;
  passphrase: string;
}

const STORAGE_KEY = '@lineai_ssh_config';

export const TERMUX_ALLOW_EXTERNAL_APPS_COMMAND = `mkdir -p ~/.termux
properties_path="$HOME/.termux/termux.properties"
touch "$properties_path"
grep -qxF 'allow-external-apps=true' "$properties_path" || printf '\\nallow-external-apps=true\\n' >> "$properties_path"
termux-reload-settings >/dev/null 2>&1 || true`;

interface SshNativeModule {
  execute(
    host: string,
    port: number,
    username: string,
    password: string,
    privateKey: string,
    passphrase: string,
    command: string,
    timeoutMs: number,
  ): Promise<string>;
  executeStreaming?(
    host: string,
    port: number,
    username: string,
    password: string,
    privateKey: string,
    passphrase: string,
    command: string,
    timeoutMs: number,
    executionId: string,
  ): Promise<string>;
  setupTermuxSshd(timeoutMs: number): Promise<string>;
  openLineAiAppSettings(): Promise<boolean>;
  openTermux(): Promise<boolean>;
}

const Ssh = NativeModules.SshModule as SshNativeModule | undefined;
const SSH_OUTPUT_EVENT = 'LineAISshOutput';

interface SshOutputEvent {
  executionId?: string;
  stream?: 'stdout' | 'stderr' | 'system';
  data?: string;
  done?: boolean;
  exitStatus?: number;
}

export interface SSHExecuteOptions {
  executionId?: string;
  onOutput?: (event: {
    stream: 'stdout' | 'stderr' | 'system';
    data: string;
    done?: boolean;
    exitStatus?: number;
  }) => void;
}

const DEFAULT_CONFIG: SSHConfig = {
  host: '127.0.0.1',
  port: 8022,
  username: '',
  password: '',
  privateKey: '',
  passphrase: '',
};

class SSHService {
  private config: SSHConfig | null = null;

  async getConfig(): Promise<SSHConfig> {
    if (this.config) return this.config;

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      this.config = DEFAULT_CONFIG;
      return this.config;
    }

    try {
      const parsed = JSON.parse(json);
      this.config = {
        host: String(parsed.host || DEFAULT_CONFIG.host),
        port: Number(parsed.port || DEFAULT_CONFIG.port),
        username: String(parsed.username || ''),
        password: String(parsed.password || ''),
        privateKey: String(parsed.privateKey || ''),
        passphrase: String(parsed.passphrase || ''),
      };
    } catch {
      this.config = DEFAULT_CONFIG;
    }

    return this.config;
  }

  async saveConfig(config: SSHConfig): Promise<void> {
    const next = this.normalizeConfig(config);
    this.config = next;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return this.hasRequiredFields(config);
  }

  async executeCommand(
    command: string,
    timeoutMs = 30000,
    configOverride?: SSHConfig,
    options: SSHExecuteOptions = {},
  ): Promise<string> {
    if (!command.trim()) {
      throw new Error('命令不能为空');
    }
    if (Platform.OS !== 'android' || !Ssh) {
      throw new Error('当前平台不支持 SSH Shell 执行');
    }

    const config = configOverride ? this.normalizeConfig(configOverride) : await this.getConfig();
    if (!this.hasRequiredFields(config)) {
      throw new Error('SSH 未配置完整，请填写 host、port、username，并填写 password 或 private key。');
    }

    const boundedTimeout = Math.max(1000, Math.min(Number(timeoutMs || 30000), 300000));
    const executionId = options.executionId || `ssh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const canStream = !!options.onOutput && !!Ssh.executeStreaming;
    let subscription: EmitterSubscription | null = null;

    if (canStream) {
      subscription = DeviceEventEmitter.addListener(SSH_OUTPUT_EVENT, (event: SshOutputEvent) => {
        if (event.executionId !== executionId) return;
        const stream = event.stream === 'stderr' || event.stream === 'system' ? event.stream : 'stdout';
        options.onOutput?.({
          stream,
          data: String(event.data || ''),
          done: event.done,
          exitStatus: event.exitStatus,
        });
      });
    }

    try {
      if (canStream && Ssh.executeStreaming) {
        return await Ssh.executeStreaming(
          config.host,
          config.port,
          config.username,
          config.password,
          config.privateKey,
          config.passphrase,
          command,
          boundedTimeout,
          executionId,
        );
      }

      return await Ssh.execute(
        config.host,
        config.port,
        config.username,
        config.password,
        config.privateKey,
        config.passphrase,
        command,
        boundedTimeout,
      );
    } finally {
      subscription?.remove();
    }
  }

  async testConnection(config: SSHConfig): Promise<string> {
    return this.executeCommand('echo LineAI SSH OK && whoami && pwd', 10000, config);
  }

  async setupTermuxOpenSsh(): Promise<{ config: SSHConfig; output: string; shell?: string; rcPath?: string }> {
    if (Platform.OS !== 'android' || !Ssh?.setupTermuxSshd) {
      throw new Error('当前平台不支持 Termux 自动配置');
    }

    const output = await Ssh.setupTermuxSshd(15 * 60 * 1000);
    const parsed = this.parseTermuxSetupOutput(output);
    if (!parsed.username || !parsed.privateKey) {
      throw new Error(`Termux 已返回结果，但未解析到 username 或 private key。\n${output}`);
    }

    const nextConfig: SSHConfig = {
      host: parsed.host || DEFAULT_CONFIG.host,
      port: parsed.port || DEFAULT_CONFIG.port,
      username: parsed.username,
      password: '',
      privateKey: parsed.privateKey,
      passphrase: '',
    };
    await this.saveConfig(nextConfig);
    return {
      config: nextConfig,
      output,
      shell: parsed.shell,
      rcPath: parsed.rcPath,
    };
  }

  async openLineAiAppSettings(): Promise<void> {
    if (Platform.OS !== 'android' || !Ssh?.openLineAiAppSettings) {
      throw new Error('当前平台不支持打开应用权限设置');
    }
    await Ssh.openLineAiAppSettings();
  }

  async openTermux(): Promise<void> {
    if (Platform.OS !== 'android' || !Ssh?.openTermux) {
      throw new Error('当前平台不支持打开 Termux');
    }
    await Ssh.openTermux();
  }

  private normalizeConfig(config: SSHConfig): SSHConfig {
    return {
      host: config.host.trim() || DEFAULT_CONFIG.host,
      port: Number(config.port || DEFAULT_CONFIG.port),
      username: config.username.trim(),
      password: config.password,
      privateKey: config.privateKey,
      passphrase: config.passphrase,
    };
  }

  private hasRequiredFields(config: SSHConfig): boolean {
    return !!(config.host && config.port && config.username && (config.password || config.privateKey));
  }

  private parseTermuxSetupOutput(output: string): {
    username?: string;
    host?: string;
    port?: number;
    shell?: string;
    rcPath?: string;
    privateKey?: string;
  } {
    const readValue = (key: string): string | undefined => {
      const line = output.split(/\r?\n/).find(item => item.startsWith(`${key}=`));
      return line ? line.slice(key.length + 1).trim() : undefined;
    };

    const privateKeyMatch = output.match(/LINEAI_PRIVATE_KEY_BEGIN\n([\s\S]*?)\nLINEAI_PRIVATE_KEY_END/);
    return {
      username: readValue('LINEAI_TERMUX_USERNAME'),
      host: readValue('LINEAI_TERMUX_HOST'),
      port: Number(readValue('LINEAI_TERMUX_PORT') || DEFAULT_CONFIG.port),
      shell: readValue('LINEAI_TERMUX_SHELL'),
      rcPath: readValue('LINEAI_TERMUX_RC'),
      privateKey: privateKeyMatch?.[1]?.trim(),
    };
  }
}

export const sshService = new SSHService();

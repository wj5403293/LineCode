import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey: string;
  passphrase: string;
}

const STORAGE_KEY = '@lineai_ssh_config';

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
}

const Ssh = NativeModules.SshModule as SshNativeModule | undefined;

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

  async executeCommand(command: string, timeoutMs = 30000, configOverride?: SSHConfig): Promise<string> {
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
    return Ssh.execute(
      config.host,
      config.port,
      config.username,
      config.password,
      config.privateKey,
      config.passphrase,
      command,
      boundedTimeout,
    );
  }

  async testConnection(config: SSHConfig): Promise<string> {
    return this.executeCommand('echo LineAI SSH OK && whoami && pwd', 10000, config);
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
}

export const sshService = new SSHService();

import AsyncStorage from '@react-native-async-storage/async-storage';
import { MCPConfig } from '../types';

const STORAGE_KEY = '@linecode_mcp_configs';

const DEFAULT_CONFIGS: MCPConfig[] = [
  {
    id: 'file_ops',
    name: '文件操作',
    description: '读取、写入和编辑文件',
    enabled: true,
    tools: ['file_read', 'file_write', 'file_edit', 'file_delete', 'glob'],
  },
  {
    id: 'http_server',
    name: 'HTTP 服务器',
    description: '启动本地 HTTP 文件服务器',
    enabled: true,
    tools: ['http_server'],
  },
  {
    id: 'agent',
    name: 'Agent',
    description: '分派 Agent 处理任务',
    enabled: true,
    tools: ['agent'],
  },
];

class MCPService {
  private configs: MCPConfig[] | null = null;

  async getConfigs(): Promise<MCPConfig[]> {
    if (this.configs) return this.configs;

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) {
      const parsed = JSON.parse(json);
      this.configs = parsed;
      const fileOps = (parsed as MCPConfig[]).find(c => c.id === 'file_ops');
      if (fileOps && !fileOps.tools.includes('file_delete')) {
        fileOps.tools = ['file_read', 'file_write', 'file_edit', 'file_delete', 'glob'];
        await this.save();
      }
      const hasAgent = (parsed as MCPConfig[]).some(c => c.id === 'agent');
      if (!hasAgent && this.configs) {
        this.configs.push({
          id: 'agent',
          name: 'Agent',
          description: '分派 Agent 处理任务',
          enabled: true,
          tools: ['agent'],
        });
        await this.save();
      }
    } else {
      this.configs = DEFAULT_CONFIGS;
      await this.save();
    }
    return this.configs!;
  }

  async toggleMCP(id: string): Promise<void> {
    const configs = await this.getConfigs();
    const config = configs.find(c => c.id === id);
    if (config) {
      config.enabled = !config.enabled;
      await this.save();
    }
  }

  async getEnabledTools(): Promise<string[]> {
    const configs = await this.getConfigs();
    return configs.filter(c => c.enabled).flatMap(c => c.tools);
  }

  async getEnabledToolNames(): Promise<Set<string>> {
    const tools = await this.getEnabledTools();
    return new Set(tools);
  }

  async buildToolPrompt(): Promise<string> {
    const configs = await this.getConfigs();
    const enabled = configs.filter(c => c.enabled);

    if (enabled.length === 0) return '';

    const sections = enabled.map(config => {
      const toolList = config.tools.map(t => `  - ${t}`).join('\n');
      return `### ${config.name}\n${toolList}`;
    });

    return `## 可用工具\n你可以使用以下工具：\n\n${sections.join('\n\n')}\n\n工具以 function calling 方式调用。`;
  }

  private async save(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs));
  }
}

export const mcpService = new MCPService();

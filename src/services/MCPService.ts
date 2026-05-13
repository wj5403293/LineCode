import AsyncStorage from '@react-native-async-storage/async-storage';
import { MCPConfig } from '../types';
import { permissionService } from './PermissionService';
import { MCPExecutionMode, settingsService } from './settings';

const STORAGE_KEY = '@linecode_mcp_configs';

// 按权限模式过滤：只读模式下只允许 read 类工具
const TOOL_CATEGORIES: Record<string, 'read' | 'write' | 'system'> = {
  file_read: 'read',
  glob: 'read',
  web_search: 'read',
  web_fetch: 'read',
  file_write: 'write',
  file_edit: 'write',
  file_delete: 'write',
  http_server: 'system',
  agent: 'system',
  agent_pipeline: 'system',
  shell_execute: 'system',
};

function isToolAllowed(toolName: string, mode: string): boolean {
  if (mode !== 'readonly') return true;
  return TOOL_CATEGORIES[toolName] === 'read';
}

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
    tools: ['agent', 'agent_pipeline'],
  },
  {
    id: 'shell',
    name: 'SSH Shell',
    description: '通过 SSH 执行 shell 命令',
    enabled: true,
    tools: ['shell_execute'],
  },
  {
    id: 'web_search',
    name: '网页搜索',
    description: '搜索互联网并查看网页内容',
    enabled: false,
    tools: ['web_search', 'web_fetch'],
  },
];

function normalizeConfigs(configs: MCPConfig[]): { configs: MCPConfig[]; changed: boolean } {
  let changed = false;
  const next = configs.map(config => ({ ...config, tools: [...config.tools] }));

  const upsert = (config: MCPConfig) => {
    const existing = next.find(item => item.id === config.id);
    if (!existing) {
      next.push(config);
      changed = true;
      return;
    }
    if (existing.name !== config.name || existing.description !== config.description) {
      existing.name = config.name;
      existing.description = config.description;
      changed = true;
    }
    const missingTool = config.tools.some(tool => !existing.tools.includes(tool));
    if (missingTool) {
      existing.tools = config.tools;
      changed = true;
    }
  };

  DEFAULT_CONFIGS.forEach(upsert);
  return { configs: next, changed };
}

class MCPService {
  private configs: MCPConfig[] | null = null;

  async getConfigs(): Promise<MCPConfig[]> {
    if (this.configs) return this.configs;

    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (json) {
      const parsed = JSON.parse(json);
      const normalized = normalizeConfigs(parsed as MCPConfig[]);
      this.configs = normalized.configs;
      if (normalized.changed) await this.save();
    } else {
      this.configs = DEFAULT_CONFIGS.map(config => ({ ...config, tools: [...config.tools] }));
      await this.save();
    }
    return this.configs!;
  }

  async setMCPEnabled(id: string, enabled: boolean): Promise<void> {
    const configs = await this.getConfigs();
    const config = configs.find(c => c.id === id);
    if (config) {
      config.enabled = enabled;
      await this.save();
    }
  }

  async toggleMCP(id: string): Promise<void> {
    const configs = await this.getConfigs();
    const config = configs.find(c => c.id === id);
    if (config) {
      await this.setMCPEnabled(id, !config.enabled);
    }
  }

  async getEnabledTools(): Promise<string[]> {
    const configs = await this.getConfigs();
    const executionMode = await this.getExecutionMode();
    const mode = permissionService.getMode();
    const webSearchTools = configs.find(c => c.id === 'web_search')?.enabled
      ? ['web_search', 'web_fetch'].filter(t => isToolAllowed(t, mode))
      : [];
    if (executionMode === 'ssh') {
      const shell = configs.find(c => c.id === 'shell');
      return [
        ...(shell?.enabled ? ['shell_execute'] : []),
        ...webSearchTools,
      ];
    }

    return configs
      .filter(c => c.enabled)
      .filter(c => c.id !== 'shell')
      .flatMap(c => c.tools)
      .filter(t => isToolAllowed(t, mode));
  }

  async getEnabledToolNames(): Promise<Set<string>> {
    const tools = await this.getEnabledTools();
    return new Set(tools);
  }

  async buildToolPrompt(): Promise<string> {
    const configs = await this.getConfigs();
    const executionMode = await this.getExecutionMode();
    if (executionMode === 'ssh') {
      const shell = configs.find(c => c.id === 'shell');
      const webSearch = configs.find(c => c.id === 'web_search');
      if (!shell?.enabled && !webSearch?.enabled) return '';
      const sections = [
        shell?.enabled
          ? [
              '### SSH Shell',
              '  - shell_execute',
              'shell_execute 默认在 SSH 会话的登录目录执行，需要目录信息时先执行 pwd 或 cd。',
            ].join('\n')
          : '',
        webSearch?.enabled
          ? [
              '### 网页搜索',
              '  - web_search',
              '  - web_fetch',
              'web_search 和 web_fetch 由应用侧网络配置执行，不依赖 SSH 主机环境。需要最新或外部信息时先搜索，再打开关键结果核对。',
            ].join('\n')
          : '',
      ].filter(Boolean).join('\n\n');
      return [
        '## 可用工具',
        '当前执行目标是 SSH Shell。本地文件读写、文件搜索、Agent、Agent Pipeline 和 HTTP 服务器已禁用。',
        sections,
        '不要引用应用私有 home 工作目录；如果系统提示提供了 SSH 项目目录，必须在该目录内操作。',
        '如需读取、写入或搜索文件，请通过 shell 命令在 SSH 环境内完成。',
        '每次工具返回后必须继续分析输出；如果任务还没完成，继续调用合适工具执行下一步。',
        '不要因为刚执行过一次或两次 shell 命令就结束；只有确认任务完成、受阻或需要用户决定时才回复用户。',
      ].join('\n');
    }

    const mode = permissionService.getMode();
    const enabled = configs.filter(c => c.enabled && c.id !== 'shell');

    if (enabled.length === 0) return '';

    const sections = enabled.map(config => {
      const tools = config.tools.filter(t => isToolAllowed(t, mode));
      if (tools.length === 0) return '';
      const toolList = tools.map(t => `  - ${t}`).join('\n');
      return `### ${config.name}\n${toolList}`;
    }).filter(Boolean);

    if (sections.length === 0) return '';

    return `## 可用工具\n你可以使用以下工具：\n\n${sections.join('\n\n')}\n\n工具以 function calling 方式调用。每次工具返回后必须继续分析结果；如果任务还没完成，继续调用合适工具执行下一步。不要因为刚执行过一次或两次工具就结束；只有确认任务完成、受阻或需要用户决定时才回复用户。`;
  }

  private async save(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.configs));
  }

  async getExecutionMode(): Promise<MCPExecutionMode> {
    return settingsService.getMCPExecutionMode();
  }

  async setExecutionMode(mode: MCPExecutionMode): Promise<void> {
    await settingsService.setMCPExecutionMode(mode);
  }
}

export const mcpService = new MCPService();

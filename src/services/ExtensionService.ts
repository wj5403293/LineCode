import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { copyFile } from 'react-native-saf-x';
import { unzip } from 'react-native-zip-archive';
import { createDefaultRegistry } from '../mcp/tools';
import { MCPConfig, ToolDefinition } from '../types';
import { mcpService } from './MCPService';
import { projectService } from './ProjectService';
import { sshService } from './SSHService';

export type ExtensionKind = 'agent' | 'mcp' | 'skills' | 'linecode';

export interface CustomAgentExtension {
  id: string;
  enabled: boolean;
  name: string;
  slug: string;
  prompt: string;
  trigger: string;
  toolNames: string[];
  mcpIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CustomMcpExtension {
  id: string;
  enabled: boolean;
  name: string;
  url: string;
  tools: McpToolSummary[];
  createdAt: number;
  updatedAt: number;
}

export interface McpToolSummary {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export type SkillInstallLocation = 'app' | 'project' | 'ssh';

export interface SkillInstallTarget {
  id: SkillInstallLocation;
  label: string;
  desc: string;
  disabled?: boolean;
}

export interface InstalledSkillExtension {
  id: string;
  name: string;
  fileName: string;
  location: SkillInstallLocation;
  locationLabel: string;
  path: string;
  installedAt: number;
}

export interface PickedDocument {
  uri: string;
  name?: string | null;
}

const KEYS = {
  AGENTS: '@linecode_extension_agents',
  MCPS: '@linecode_extension_mcps',
  SKILLS: '@linecode_extension_skills',
} as const;

const SKILL_TMP_DIR = `${RNFS.DocumentDirectoryPath}/.linecode/tmp/skills`;
const SSH_SKILL_DIR = '$HOME/.linecode/skills';
const SSH_TMP_DIR = '$HOME/.linecode/tmp';
const SSH_UPLOAD_CHUNK_SIZE = 28 * 1024;
const MAX_SKILL_PROMPT_CHARS = 18 * 1024;

function nowId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeFileName(name: string): string {
  const clean = name.trim().replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 96);
  return clean || `skill_${Date.now()}.zip`;
}

function ensureZipFileName(name: string): string {
  const clean = sanitizeFileName(name);
  return clean.toLowerCase().endsWith('.zip') ? clean : `${clean}.zip`;
}

function removeZipExtension(fileName: string): string {
  return fileName.replace(/\.zip$/i, '');
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function normalizeHttpUrl(url: string): string {
  const value = url.trim();
  if (!/^https?:\/\//i.test(value)) {
    throw new Error('MCP 地址必须以 http:// 或 https:// 开头。');
  }
  return value.replace(/\/$/, '');
}

function extractJsonFromEventStream(text: string): string {
  const dataLines = text
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trim())
    .filter(line => line && line !== '[DONE]');
  return dataLines[0] || text;
}

function normalizeToolList(value: unknown): McpToolSummary[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => {
      if (typeof item === 'string') {
        return { name: item };
      }
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : '';
      if (!name) return null;
      return {
        name,
        description: typeof record.description === 'string' ? record.description : undefined,
        inputSchema: normalizeInputSchema(record.inputSchema || record.input_schema || record.schema),
      };
    })
    .filter((item): item is McpToolSummary => !!item);
}

function normalizeInputSchema(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function parseMcpToolResponse(text: string): McpToolSummary[] {
  const jsonText = extractJsonFromEventStream(text);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const result = parsed.result as Record<string, unknown> | undefined;
  const data = parsed.data as Record<string, unknown> | undefined;
  return normalizeToolList(
    result?.tools
      ?? parsed.tools
      ?? data?.tools
      ?? result?.servers
      ?? parsed.servers
      ?? data?.servers,
  );
}

function normalizeAgent(value: Partial<CustomAgentExtension>): CustomAgentExtension | null {
  if (!value || typeof value !== 'object') return null;
  if (!value.id || !value.name || !value.slug || !value.prompt) return null;
  return {
    id: String(value.id),
    enabled: value.enabled !== false,
    name: String(value.name),
    slug: String(value.slug),
    prompt: String(value.prompt),
    trigger: String(value.trigger || ''),
    toolNames: Array.isArray(value.toolNames) ? value.toolNames.map(String) : [],
    mcpIds: Array.isArray(value.mcpIds) ? value.mcpIds.map(String) : [],
    createdAt: Number(value.createdAt || Date.now()),
    updatedAt: Number(value.updatedAt || Date.now()),
  };
}

function normalizeMcp(value: Partial<CustomMcpExtension>): CustomMcpExtension | null {
  if (!value || typeof value !== 'object') return null;
  if (!value.id || !value.name || !value.url) return null;
  return {
    id: String(value.id),
    enabled: value.enabled !== false,
    name: String(value.name),
    url: String(value.url),
    tools: Array.isArray(value.tools) ? normalizeToolList(value.tools) : [],
    createdAt: Number(value.createdAt || Date.now()),
    updatedAt: Number(value.updatedAt || Date.now()),
  };
}

function normalizeSkill(value: Partial<InstalledSkillExtension>): InstalledSkillExtension | null {
  if (!value || typeof value !== 'object') return null;
  if (!value.id || !value.name || !value.fileName || !value.path) return null;
  const location = value.location === 'project' || value.location === 'ssh' ? value.location : 'app';
  return {
    id: String(value.id),
    name: String(value.name),
    fileName: String(value.fileName),
    location,
    locationLabel: String(value.locationLabel || location),
    path: String(value.path),
    installedAt: Number(value.installedAt || Date.now()),
  };
}

class ExtensionService {
  async getBuiltInTools(): Promise<ToolDefinition[]> {
    return createDefaultRegistry().getAll().map(tool => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      requiresConfirmation: tool.requiresConfirmation,
      parameters: tool.parameters,
    }));
  }

  async getBuiltInMcpConfigs(): Promise<MCPConfig[]> {
    return mcpService.getConfigs();
  }

  async getAgentExtensions(): Promise<CustomAgentExtension[]> {
    const json = await AsyncStorage.getItem(KEYS.AGENTS);
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed)
      ? parsed.map(normalizeAgent).filter((item): item is CustomAgentExtension => !!item)
      : [];
  }

  async saveAgentExtension(input: Omit<CustomAgentExtension, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomAgentExtension> {
    const agents = await this.getAgentExtensions();
    const timestamp = Date.now();
    const next: CustomAgentExtension = {
      ...input,
      enabled: input.enabled !== false,
      id: nowId('agent'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await AsyncStorage.setItem(KEYS.AGENTS, JSON.stringify([...agents, next]));
    return next;
  }

  async updateAgentExtension(
    id: string,
    input: Omit<CustomAgentExtension, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CustomAgentExtension> {
    const agents = await this.getAgentExtensions();
    const existing = agents.find(agent => agent.id === id);
    if (!existing) throw new Error('未找到要修改的 Agent。');
    const next: CustomAgentExtension = {
      ...existing,
      ...input,
      enabled: input.enabled !== false,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(KEYS.AGENTS, JSON.stringify(agents.map(agent => agent.id === id ? next : agent)));
    return next;
  }

  async setAgentExtensionEnabled(id: string, enabled: boolean): Promise<void> {
    const agents = await this.getAgentExtensions();
    await AsyncStorage.setItem(KEYS.AGENTS, JSON.stringify(agents.map(agent => (
      agent.id === id
        ? { ...agent, enabled, updatedAt: Date.now() }
        : agent
    ))));
  }

  async getMcpExtensions(): Promise<CustomMcpExtension[]> {
    const json = await AsyncStorage.getItem(KEYS.MCPS);
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed)
      ? parsed.map(normalizeMcp).filter((item): item is CustomMcpExtension => !!item)
      : [];
  }

  async saveMcpExtension(input: Omit<CustomMcpExtension, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomMcpExtension> {
    const mcps = await this.getMcpExtensions();
    const timestamp = Date.now();
    const next: CustomMcpExtension = {
      ...input,
      enabled: input.enabled !== false,
      id: nowId('mcp'),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await AsyncStorage.setItem(KEYS.MCPS, JSON.stringify([...mcps, next]));
    return next;
  }

  async updateMcpExtension(
    id: string,
    input: Omit<CustomMcpExtension, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CustomMcpExtension> {
    const mcps = await this.getMcpExtensions();
    const existing = mcps.find(mcp => mcp.id === id);
    if (!existing) throw new Error('未找到要修改的 MCP。');
    const next: CustomMcpExtension = {
      ...existing,
      ...input,
      enabled: input.enabled !== false,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: Date.now(),
    };
    await AsyncStorage.setItem(KEYS.MCPS, JSON.stringify(mcps.map(mcp => mcp.id === id ? next : mcp)));
    return next;
  }

  async setMcpExtensionEnabled(id: string, enabled: boolean): Promise<void> {
    const mcps = await this.getMcpExtensions();
    await AsyncStorage.setItem(KEYS.MCPS, JSON.stringify(mcps.map(mcp => (
      mcp.id === id
        ? { ...mcp, enabled, updatedAt: Date.now() }
        : mcp
    ))));
  }

  async getInstalledSkills(): Promise<InstalledSkillExtension[]> {
    const json = await AsyncStorage.getItem(KEYS.SKILLS);
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed)
      ? parsed.map(normalizeSkill).filter((item): item is InstalledSkillExtension => !!item)
      : [];
  }

  async buildExtensionPrompt(): Promise<string> {
    const [agents, mcps, skills] = await Promise.all([
      this.getAgentExtensions(),
      this.getMcpExtensions(),
      this.getInstalledSkills(),
    ]);

    const sections: string[] = [];
    const enabledAgents = agents.filter(agent => agent.enabled);
    if (enabledAgents.length > 0) {
      sections.push([
        '### 自定义 Agent',
        ...enabledAgents.map(agent => [
          `- ${agent.name} (${agent.slug})`,
          agent.trigger ? `  - 触发条件: ${agent.trigger}` : '',
          `  - 工具: ${agent.toolNames.join(', ') || '无'}`,
          `  - MCP: ${agent.mcpIds.join(', ') || '无'}`,
        ].filter(Boolean).join('\n')),
      ].join('\n'));
    }

    const enabledMcps = mcps.filter(mcp => mcp.enabled);
    if (enabledMcps.length > 0) {
      sections.push([
        '### 自定义 HTTP MCP',
        ...enabledMcps.map(mcp => `- ${mcp.name}: ${mcp.url} (${mcp.tools.map(tool => tool.name).join(', ') || '未查询 tools'})`),
      ].join('\n'));
    }

    if (skills.length > 0) {
      const skillBlocks: string[] = [];
      let usedChars = 0;
      for (const skill of skills) {
        const skillPrompt = await this.readLocalSkillPrompt(skill).catch(() => '');
        const header = `### Skill: ${skill.name}\n安装位置: ${skill.locationLabel}\n路径: ${skill.path}`;
        const block = skillPrompt ? `${header}\n\n${skillPrompt}` : header;
        if (usedChars + block.length > MAX_SKILL_PROMPT_CHARS) {
          skillBlocks.push('### Skills 提示词已截断\n已达到提示词长度上限，剩余 Skills 仅按工具描述处理。');
          break;
        }
        skillBlocks.push(block);
        usedChars += block.length;
      }
      sections.push(['### 已安装 Skills', ...skillBlocks].join('\n\n'));
    }

    if (sections.length === 0) return '';
    return [
      '## 扩展',
      '以下扩展来自设置里的“扩展”页面。自定义 Agent 和 MCP 已作为可调用工具提供；Skills 中的 SKILL.md 内容是附加行为指南。',
      ...sections,
    ].join('\n\n');
  }

  async getSkillInstallTargets(): Promise<SkillInstallTarget[]> {
    const executionMode = await mcpService.getExecutionMode();
    return [
      {
        id: executionMode === 'ssh' ? 'ssh' : 'app',
        label: executionMode === 'ssh' ? 'SSH ~/.linecode/skills' : '应用 .linecode/skills',
        desc: executionMode === 'ssh'
          ? '当前为 SSH 模式，ZIP 会推送到远端用户目录。'
          : '保存到 LineCode 应用私有扩展目录。',
      },
      {
        id: 'project',
        label: '当前工作区 .linecode/skills',
        desc: '保存到当前项目 home 下，便于随项目导出。',
      },
      {
        id: executionMode === 'ssh' ? 'app' : 'ssh',
        label: executionMode === 'ssh' ? '应用 .linecode/skills' : 'SSH ~/.linecode/skills',
        desc: executionMode === 'ssh'
          ? '只安装到本机应用目录，不推送远端。'
          : '仅在 SSH 模式下推荐使用；需要先配置 SSH 连接。',
        disabled: executionMode !== 'ssh',
      },
    ];
  }

  async queryMcpTools(url: string): Promise<McpToolSummary[]> {
    const endpoint = normalizeHttpUrl(url);
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: `linecode_${Date.now()}`,
      method: 'tools/list',
      params: {},
    });

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json, text/event-stream',
          'Content-Type': 'application/json',
        },
        body,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(`${res.status}: ${text || res.statusText}`);
      }
      const tools = parseMcpToolResponse(text);
      if (tools.length > 0) return tools;
    } catch (err) {
      const fallback = await fetch(endpoint, { headers: { Accept: 'application/json, text/event-stream' } });
      const fallbackText = await fallback.text();
      if (!fallback.ok) {
        throw err instanceof Error ? err : new Error(fallbackText || `请求失败: ${fallback.status}`);
      }
      const tools = parseMcpToolResponse(fallbackText);
      if (tools.length > 0) return tools;
    }

    throw new Error('没有在 MCP 响应中找到 tools 列表。');
  }

  async installSkillZip(document: PickedDocument, location: SkillInstallLocation): Promise<InstalledSkillExtension> {
    const fileName = ensureZipFileName(document.name || `skill_${Date.now()}.zip`);
    const timestamp = Date.now();
    let path: string;
    let locationLabel: string;

    if (location === 'ssh') {
      path = await this.uploadSkillZipToSsh(document, fileName);
      locationLabel = 'SSH ~/.linecode/skills';
    } else {
      const targetRoot = location === 'project'
        ? `${await projectService.getCurrentHomePath()}/.linecode/skills`
        : `${projectService.getLinecodeRoot()}/skills`;
      await RNFS.mkdir(targetRoot);
      const installDir = `${targetRoot}/${removeZipExtension(fileName)}_${timestamp}`;
      const archivePath = `${installDir}/${fileName}`;
      await RNFS.mkdir(installDir);
      await copyFile(document.uri, `file://${archivePath}`, { replaceIfDestinationExists: true });
      await unzip(archivePath, installDir);
      path = installDir;
      locationLabel = location === 'project' ? '当前工作区 .linecode/skills' : '应用 .linecode/skills';
    }

    const skills = await this.getInstalledSkills();
    const next: InstalledSkillExtension = {
      id: nowId('skill'),
      name: removeZipExtension(fileName),
      fileName,
      location,
      locationLabel,
      path,
      installedAt: timestamp,
    };
    await AsyncStorage.setItem(KEYS.SKILLS, JSON.stringify([next, ...skills]));
    return next;
  }

  private async uploadSkillZipToSsh(document: PickedDocument, fileName: string): Promise<string> {
    await RNFS.mkdir(SKILL_TMP_DIR);
    const localPath = `${SKILL_TMP_DIR}/${Date.now()}_${fileName}`;
    await copyFile(document.uri, `file://${localPath}`, { replaceIfDestinationExists: true });

    try {
      const base64 = await RNFS.readFile(localPath, 'base64');
      const remoteBase64 = `${SSH_TMP_DIR}/${Date.now()}_${fileName}.b64`;
      const skillName = removeZipExtension(fileName);
      const remoteZip = `${SSH_SKILL_DIR}/${fileName}`;
      const remoteDir = `${SSH_SKILL_DIR}/${skillName}`;
      await sshService.executeCommand(`mkdir -p "${SSH_TMP_DIR}" "${SSH_SKILL_DIR}" && : > "${remoteBase64}"`, 30000);

      for (let offset = 0; offset < base64.length; offset += SSH_UPLOAD_CHUNK_SIZE) {
        const chunk = base64.slice(offset, offset + SSH_UPLOAD_CHUNK_SIZE);
        await sshService.executeCommand(`printf %s ${shellSingleQuote(chunk)} >> "${remoteBase64}"`, 60000);
      }

      await sshService.executeCommand([
        `base64 -d "${remoteBase64}" > "${remoteZip}"`,
        `rm -f "${remoteBase64}"`,
        `if command -v unzip >/dev/null 2>&1; then rm -rf "${remoteDir}" && mkdir -p "${remoteDir}" && unzip -oq "${remoteZip}" -d "${remoteDir}"; fi`,
        `ls -ld "${remoteDir}" "${remoteZip}" 2>/dev/null || ls -l "${remoteZip}"`,
      ].join(' && '), 120000);
      return `~/.linecode/skills/${skillName}`;
    } finally {
      if (await RNFS.exists(localPath)) {
        await RNFS.unlink(localPath).catch(() => {});
      }
    }
  }

  private async readLocalSkillPrompt(skill: InstalledSkillExtension): Promise<string> {
    if (skill.location === 'ssh') return '';
    const exists = await RNFS.exists(skill.path);
    if (!exists) return '';
    const skillPath = await this.findSkillMd(skill.path, 0);
    if (!skillPath) return '';
    const content = await RNFS.readFile(skillPath, 'utf8');
    return content.slice(0, 6000);
  }

  private async findSkillMd(path: string, depth: number): Promise<string | null> {
    if (depth > 3) return null;
    const stat = await RNFS.stat(path);
    if (!stat.isDirectory()) {
      return path.toLowerCase().endsWith('/skill.md') ? path : null;
    }
    const items = await RNFS.readDir(path);
    const direct = items.find(item => !item.isDirectory() && item.name.toLowerCase() === 'skill.md');
    if (direct) return direct.path;
    for (const item of items.filter(entry => entry.isDirectory())) {
      const found = await this.findSkillMd(item.path, depth + 1);
      if (found) return found;
    }
    return null;
  }
}

export const extensionService = new ExtensionService();

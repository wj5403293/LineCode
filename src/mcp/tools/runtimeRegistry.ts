import { diffService } from '../../services/DiffService';
import {
  CustomAgentExtension,
  CustomMcpExtension,
  extensionService,
  McpToolSummary,
  requestHeadersToRecord,
} from '../../services/ExtensionService';
import { modelStorage } from '../../services/storage';
import { settingsService } from '../../services/settings';
import { toolAccessPolicyService } from '../../services/ToolAccessPolicyService';
import { workspaceFs } from '../../services/WorkspaceFileSystem';
import { AgentToolCall, ContentBlock, MCPConfig, ToolResult } from '../../types';
import { permissionService } from '../../services/PermissionService';
import type { ChatMessage } from '../../services/ai';
import { buildAgentWorkspacePrompt } from './builtins/agentWorkspacePrompt';
import { createDefaultRegistry } from './index';
import { BaseTool, ToolContext } from './BaseTool';
import { ToolRegistry } from './ToolRegistry';

const CUSTOM_AGENT_PREFIX = 'agentx_';
const CUSTOM_MCP_PREFIX = 'mcpx_';

export interface RuntimeRegistryOptions {
  includeCustomAgents?: boolean;
  includeCustomMcp?: boolean;
}

export function isCustomAgentToolName(name: string): boolean {
  return name.startsWith(CUSTOM_AGENT_PREFIX);
}

export function isCustomMcpToolName(name: string): boolean {
  return name.startsWith(CUSTOM_MCP_PREFIX);
}

export function isExtensionToolName(name: string): boolean {
  return isCustomAgentToolName(name) || isCustomMcpToolName(name);
}

function safeToolNamePart(value: string, fallback: string): string {
  const clean = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const next = clean || fallback;
  return /^[a-zA-Z]/.test(next) ? next : `${fallback}_${next}`;
}

function shortHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33 + value.charCodeAt(i)) % 2147483647;
  }
  return Math.abs(hash).toString(36).slice(0, 6);
}

export function customAgentToolName(agent: Pick<CustomAgentExtension, 'slug'>): string {
  return `${CUSTOM_AGENT_PREFIX}${safeToolNamePart(agent.slug, 'agent').slice(0, 55)}`;
}

export function customMcpToolName(mcp: Pick<CustomMcpExtension, 'id'>, tool: Pick<McpToolSummary, 'name'>): string {
  const toolPart = safeToolNamePart(tool.name, 'tool').slice(0, 42);
  return `${CUSTOM_MCP_PREFIX}${shortHash(mcp.id)}_${toolPart}`.slice(0, 64);
}

function summarizeToolResult(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(item => summarizeToolResult(item)).filter(Boolean).join('\n');
  }
  if (!value || typeof value !== 'object') return String(value ?? '');

  const record = value as Record<string, unknown>;
  if (typeof record.text === 'string') return record.text;
  if (typeof record.content === 'string') return record.content;
  if (Array.isArray(record.content)) return summarizeToolResult(record.content);
  if (typeof record.message === 'string') return record.message;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseMcpToolCallResponse(text: string): { content: string; isError?: boolean } {
  const jsonText = text
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).trim())
    .filter(line => line && line !== '[DONE]')[0] || text;
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  if (parsed.error) {
    return { content: summarizeToolResult(parsed.error), isError: true };
  }
  const result = parsed.result ?? parsed;
  return { content: summarizeToolResult(result) || 'MCP 工具执行完成' };
}

function normalizeParameters(schema?: Record<string, unknown>): Record<string, unknown> {
  if (schema && schema.type === 'object') return schema;
  return {
    type: 'object',
    properties: {},
    additionalProperties: true,
  };
}

async function executeToolWithDiff(
  registry: ToolRegistry,
  toolName: string,
  input: Record<string, unknown>,
  context: ToolContext,
): Promise<ToolResult> {
  const tool = registry.get(toolName);
  if (!tool) {
    return {
      toolCallId: '',
      content: `未知工具: ${toolName}`,
      isError: true,
    };
  }

  const permResult = permissionService.canExecuteTool(tool.name, tool.category);
  if (!permResult.allowed) {
    return {
      toolCallId: '',
      content: permResult.reason || '权限不足',
      isError: true,
    };
  }

  if (tool.category !== 'write' || tool.name === 'file_delete') {
    return tool.execute(input, context);
  }

  const filePath = String(input.file_path || '');
  const policy = await toolAccessPolicyService.buildPolicy(context.homePath);
  const fullPath = workspaceFs.resolveToolPath(filePath, policy, 'write');
  let oldContent = '';
  let existed = false;

  try {
    existed = await workspaceFs.exists(fullPath);
    if (existed) {
      const stat = await workspaceFs.stat(fullPath);
      if (stat.isDirectory()) {
        return {
          toolCallId: '',
          content: `路径是一个目录，无法写入文件: ${filePath}`,
          isError: true,
        };
      }
      oldContent = await workspaceFs.readFile(fullPath);
    }
  } catch {
    return {
      toolCallId: '',
      content: `无法读取原文件: ${filePath}`,
      isError: true,
    };
  }

  const result = await tool.execute(input, context);
  if (result.isError) return result;

  let newContent = '';
  try {
    newContent = await workspaceFs.readFile(fullPath);
  } catch {
    newContent = String(input.content || '');
  }
  if (oldContent !== newContent) {
    const diff = await diffService.recordDiff(fullPath, oldContent, newContent, existed);
    result.diffId = diff.id;
  }
  return result;
}

function buildAgentToolNames(
  agent: CustomAgentExtension,
  customMcps: CustomMcpExtension[],
  builtInMcps: MCPConfig[],
  registry: ToolRegistry,
): string[] {
  const selected = new Set(agent.toolNames);
  for (const mcpId of agent.mcpIds) {
    if (mcpId.startsWith('builtin:')) {
      const builtIn = builtInMcps.find(item => `builtin:${item.id}` === mcpId || item.id === mcpId);
      builtIn?.tools.forEach(toolName => selected.add(toolName));
      continue;
    }
    const customMcp = customMcps.find(item => `custom:${item.id}` === mcpId || item.id === mcpId);
    if (!customMcp) continue;
    customMcp.tools
      .filter(tool => tool.enabled !== false)
      .forEach(tool => selected.add(customMcpToolName(customMcp, tool)));
  }
  return Array.from(selected).filter(name => registry.get(name));
}

class CustomMcpHttpTool extends BaseTool<Record<string, unknown>> {
  readonly name: string;
  readonly description: string;
  readonly category = 'system' as const;
  readonly requiresConfirmation = false;
  readonly parameters: Record<string, unknown>;

  constructor(
    private readonly mcp: CustomMcpExtension,
    private readonly tool: McpToolSummary,
  ) {
    super();
    this.name = customMcpToolName(mcp, tool);
    this.description = [
      `调用自定义 HTTP MCP「${mcp.name}」的工具 ${tool.name}。`,
      tool.description || '',
      `MCP 地址: ${mcp.url}`,
    ].filter(Boolean).join('\n');
    this.parameters = normalizeParameters(tool.inputSchema);
  }

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const body = JSON.stringify({
      jsonrpc: '2.0',
      id: `linecode_${Date.now()}`,
      method: 'tools/call',
      params: {
        name: this.tool.name,
        arguments: input,
      },
    });
    const res = await fetch(this.mcp.url, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        ...requestHeadersToRecord(this.mcp.requestHeaders),
      },
      body,
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        toolCallId: '',
        content: `${res.status}: ${text || res.statusText}`,
        isError: true,
      };
    }
    const parsed = parseMcpToolCallResponse(text);
    return { toolCallId: '', ...parsed };
  }
}

class CustomAgentTool extends BaseTool<{ task: string; context?: string }> {
  readonly name: string;
  readonly description: string;
  readonly category = 'system' as const;
  readonly requiresConfirmation = false;
  readonly parameters = {
    type: 'object',
    properties: {
      task: { type: 'string', description: '交给此自定义 Agent 完成的具体任务' },
      context: { type: 'string', description: '可选补充上下文、文件路径、限制或验收方式' },
    },
    required: ['task'],
  };

  constructor(
    private readonly agent: CustomAgentExtension,
    private readonly customMcps: CustomMcpExtension[],
  ) {
    super();
    this.name = customAgentToolName(agent);
    this.description = [
      `调用自定义 Agent「${agent.name}」。`,
      agent.trigger ? `触发条件: ${agent.trigger}` : '',
      `能力说明: ${agent.prompt.slice(0, 900)}`,
    ].filter(Boolean).join('\n');
  }

  async execute(input: { task: string; context?: string }, context: ToolContext): Promise<ToolResult> {
    const task = String(input.task || '').trim();
    if (!task) {
      return { toolCallId: '', content: '自定义 Agent 任务不能为空', isError: true };
    }

    const [models, selectedId] = await Promise.all([
      modelStorage.getModels(),
      modelStorage.getSelectedModelId(),
    ]);
    const model = models.find(item => item.id === selectedId);
    if (!model) {
      return { toolCallId: '', content: '未找到可用模型，请先在设置中添加模型。', isError: true };
    }

    const [registry, builtInMcps] = await Promise.all([
      createRuntimeRegistry({ includeCustomAgents: false, includeCustomMcp: true }),
      extensionService.getBuiltInMcpConfigs(),
    ]);
    const allowedToolNames = buildAgentToolNames(this.agent, this.customMcps, builtInMcps, registry);
    const tools = registry.toJSONSchema(allowedToolNames);
    const toolCallRecords: AgentToolCall[] = [];
    let thinkingContent = '';
    let output = '';

    const progressUpdate = (update: Partial<ContentBlock>) => {
      context.onProgress?.({
        agentType: 'sub-coding',
        agentStatus: update.agentStatus || 'running',
        agentOutput: update.agentOutput ?? output,
        agentThinking: update.agentThinking ?? thinkingContent,
        agentToolCalls: update.agentToolCalls ?? [...toolCallRecords],
      });
    };

    const workspacePrompt = buildAgentWorkspacePrompt(context.homePath);
    const systemPrompt = [
      `你是自定义 Agent「${this.agent.name}」（${this.agent.slug}）。`,
      this.agent.prompt,
      this.agent.trigger ? `触发条件：${this.agent.trigger}` : '',
      workspacePrompt,
      allowedToolNames.length > 0 ? `你只能使用这些工具：${allowedToolNames.join(', ')}` : '你没有可用工具，只能基于上下文回答。',
      '完成后用中文给出简洁结果，说明关键操作和验证情况。',
    ].filter(Boolean).join('\n\n');

    const messages: ChatMessage[] = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: input.context ? `${task}\n\n补充上下文：\n${input.context}` : task,
      },
    ];
    const preserveReasoning = await settingsService.getPreserveReasoning();
    progressUpdate({ agentStatus: 'running', agentOutput: '' });

    try {
      const { aiService } = await import('../../services/ai');
      while (true) {
        const result = await aiService.sendMessage(
          model,
          messages,
          {
            onBlocks: blocks => {
              const textBlocks = blocks.filter(block => block.type === 'text');
              const thinkingBlocks = blocks.filter(block => block.type === 'thinking');
              output = textBlocks.map(block => block.content).join('');
              const nextThinking = thinkingBlocks.map(block => block.content).join('');
              if (nextThinking) thinkingContent = nextThinking;
              progressUpdate({
                agentStatus: 'running',
                agentOutput: output,
                agentThinking: thinkingContent,
              });
            },
          },
          'medium',
          tools,
          undefined,
          preserveReasoning,
        );

        if (result.reasoningContent) thinkingContent = result.reasoningContent;
        if (!result.toolCalls?.length) {
          output = result.text || output || '任务完成';
          progressUpdate({ agentStatus: 'done', agentOutput: output, agentThinking: thinkingContent });
          return { toolCallId: '', content: output };
        }

        messages.push({
          role: 'assistant' as const,
          content: result.text,
          toolCalls: result.toolCalls,
          reasoningContent: result.reasoningContent,
          reasoningDetails: result.reasoningDetails,
        });

        for (const tc of result.toolCalls) {
          let tcInput: Record<string, unknown> = {};
          try {
            tcInput = JSON.parse(tc.arguments || '{}');
          } catch {}

          if (!allowedToolNames.includes(tc.name)) {
            const denied = `自定义 Agent 未被授权使用工具: ${tc.name}`;
            toolCallRecords.push({ name: tc.name, input: tcInput, result: denied, isError: true });
            messages.push({ role: 'tool' as const, content: denied, toolCallId: tc.id, toolName: tc.name, isError: true });
            continue;
          }

          const toolResult = await executeToolWithDiff(registry, tc.name, tcInput, {
            ...context,
            toolCallId: tc.id,
          });
          toolCallRecords.push({
            name: tc.name,
            input: tcInput,
            result: toolResult.content,
            isError: toolResult.isError,
            diffId: toolResult.diffId,
          });
          progressUpdate({ agentToolCalls: [...toolCallRecords] });
          messages.push({
            role: 'tool' as const,
            content: toolResult.content,
            toolCallId: tc.id,
            toolName: tc.name,
            isError: toolResult.isError,
          });
        }
      }

    } catch (err: any) {
      const message = `自定义 Agent 执行失败: ${err?.message || String(err)}`;
      progressUpdate({ agentStatus: 'error', agentOutput: message, agentThinking: thinkingContent });
      return { toolCallId: '', content: message, isError: true };
    }
  }
}

export async function createRuntimeRegistry(options: RuntimeRegistryOptions = {}): Promise<ToolRegistry> {
  const {
    includeCustomAgents = true,
    includeCustomMcp = true,
  } = options;
  const registry = createDefaultRegistry();
  const [agents, mcps] = await Promise.all([
    includeCustomAgents ? extensionService.getAgentExtensions() : Promise.resolve([]),
    includeCustomMcp ? extensionService.getMcpExtensions() : Promise.resolve([]),
  ]);
  const enabledMcps = mcps.filter(mcp => mcp.enabled);

  if (includeCustomMcp) {
    for (const mcp of enabledMcps) {
      for (const tool of mcp.tools.filter(item => item.enabled !== false)) {
        registry.register(new CustomMcpHttpTool(mcp, tool));
      }
    }
  }

  if (includeCustomAgents) {
    for (const agent of agents.filter(item => item.enabled)) {
      registry.register(new CustomAgentTool(agent, enabledMcps));
    }
  }

  return registry;
}

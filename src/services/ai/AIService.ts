import { Model, ContentBlock, ToolCall, MessageRole, ReasoningDetail, InputAttachment } from '../../types';
import { SYSTEM_PROMPT } from '../../constants/prompt';
import { ToneMode, ReasoningEffort } from '../settings';
import { mcpService } from '../MCPService';
import { StreamProcessor, StreamCallbacks, ChatMessage } from './processors/StreamProcessor';
import { OpenAIStreamProcessor } from './processors/OpenAIProcessor';
import { AnthropicStreamProcessor } from './processors/AnthropicProcessor';
import { CodexStreamProcessor } from './processors/CodexProcessor';
import { LocalLlamaProcessor } from './processors/LocalLlamaProcessor';
import { TONE_PROMPTS } from './constants/tonePrompts';
import { projectService } from '../ProjectService';
import { workspaceFs } from '../WorkspaceFileSystem';
import { extensionService } from '../ExtensionService';
import { LOCAL_MODEL_ENABLED } from '../RuntimeConfig';
import { normalizeToolProtocolMessages } from './toolProtocol';

export { SYSTEM_PROMPT };
export type { ChatMessage };

class AIService {
  private processors: Record<string, StreamProcessor>;

  constructor() {
    this.processors = {
      openai: new OpenAIStreamProcessor(),
      anthropic: new AnthropicStreamProcessor(),
      codex: new CodexStreamProcessor(),
    };
    if (LOCAL_MODEL_ENABLED) {
      this.processors.local = new LocalLlamaProcessor();
    }
  }

  async buildMessages(
    systemPrompt: string,
    history: ChatMessage[],
    toneMode: ToneMode = 'coding',
    homePath?: string,
    learningContext?: string,
  ): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];
    const toolPrompt = await mcpService.buildToolPrompt();
    const executionMode = await mcpService.getExecutionMode();
    
    let fullSystemPrompt = systemPrompt + (TONE_PROMPTS[toneMode] || '');
    
    if (homePath) {
      if (executionMode === 'ssh') {
        const sshProjectPrompt = await this.buildSshProjectPrompt(homePath);
        if (sshProjectPrompt) {
          fullSystemPrompt += `\n\n${sshProjectPrompt}`;
        }
      } else {
        const displayPath = workspaceFs.toDisplayPath(homePath);
        fullSystemPrompt += `\n\n## 工作目录\n当前工作目录（home目录）: ${displayPath}\n所有文件操作都相对于此目录进行。`;
      }
    }

    const attachmentPrompt = this.buildAttachmentPrompt(history);
    if (attachmentPrompt) {
      fullSystemPrompt += `\n\n${attachmentPrompt}`;
    }
    
    if (toolPrompt) {
      fullSystemPrompt += `\n\n${toolPrompt}`;
    }

    const extensionPrompt = await extensionService.buildExtensionPrompt();
    if (extensionPrompt) {
      fullSystemPrompt += `\n\n${extensionPrompt}`;
    }

    if (learningContext) {
      fullSystemPrompt += `\n\n${learningContext}`;
    }

    if (fullSystemPrompt) {
      messages.push({ role: 'system', content: fullSystemPrompt });
    }

    for (const msg of history) {
      const legacy = msg.role === 'user' ? this.splitLegacyAttachmentBlock(msg.content) : null;
      const content = legacy?.content || (legacy?.attachmentsText ? '已附加文件' : msg.content);
      messages.push({
        role: msg.role,
        content,
        attachments: msg.attachments,
        toolCalls: msg.toolCalls,
        toolCallId: msg.toolCallId,
        toolName: msg.toolName,
        isError: msg.isError,
        reasoningContent: msg.reasoningContent,
        reasoningDetails: msg.reasoningDetails,
      });
    }

    return normalizeToolProtocolMessages(messages);
  }

  private async buildSshProjectPrompt(homePath: string): Promise<string> {
    const project = await projectService.getSelectedProject();
    if (project.path !== homePath) return '';

    const shellPath = projectService.getProjectShellPath(project);
    if (!shellPath) {
      return '';
    }

    return [
      '## SSH 项目目录',
      `当前已打开外部项目: ${project.label}`,
      `项目目录: ${shellPath}`,
      `执行读取、列目录、搜索或修改前，必须先在 SSH 环境中使用此目录，例如通过 shell_execute 的 cwd 参数设为 "${shellPath}"，或先执行 cd 后再操作。`,
      '不要在 SSH 登录目录或其他目录中猜测项目文件位置。',
    ].join('\n');
  }

  private buildAttachmentPrompt(history: ChatMessage[]): string {
    const userAttachments = history
      .filter(msg => msg.role === 'user' && msg.attachments?.length)
      .map((msg, index) => {
        const label = msg.content.trim() || `用户消息 ${index + 1}`;
        const paths = msg.attachments!
          .map(item => `- ${item.name} (${item.source}): ${item.path}`)
          .join('\n');
        return `### ${label}\n${paths}`;
      });
    const legacyAttachments = history
      .filter(msg => msg.role === 'user')
      .map(msg => {
        const legacy = this.splitLegacyAttachmentBlock(msg.content);
        if (!legacy.attachmentsText) return '';
        const label = legacy.content.trim() || '用户消息';
        return `### ${label}\n${legacy.attachmentsText}`;
      })
      .filter(Boolean);

    const sections = [...userAttachments, ...legacyAttachments];
    if (sections.length === 0) return '';
    return `## 附加文件位置\n这些路径来自用户在输入框左侧选择的文件，不要在回复中原样复述，除非用户明确要求。\n${sections.join('\n\n')}`;
  }

  private splitLegacyAttachmentBlock(content: string): { content: string; attachmentsText: string } {
    const marker = '\n\n附加文件位置:\n';
    const markerIndex = content.indexOf(marker);
    if (markerIndex === -1) {
      const startMarker = '附加文件位置:\n';
      if (content.startsWith(startMarker)) {
        return {
          content: '',
          attachmentsText: content.slice(startMarker.length).trim(),
        };
      }
      return { content, attachmentsText: '' };
    }
    return {
      content: content.slice(0, markerIndex).trim(),
      attachmentsText: content.slice(markerIndex + marker.length).trim(),
    };
  }

  async sendMessage(
    model: Model,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks,
    reasoningEffort?: ReasoningEffort,
    customTools?: Record<string, unknown>[],
    abortSignal?: AbortSignal,
    preserveReasoning = false,
  ): Promise<{ text: string; blocks: ContentBlock[]; toolCalls?: ToolCall[]; reasoningContent?: string; reasoningDetails?: ReasoningDetail[] }> {
    let tools: Record<string, unknown>[];
    
    if (customTools) {
      tools = customTools;
    } else {
      const { createRuntimeRegistry, isExtensionToolName } = await import('../../mcp/tools/runtimeRegistry');
      const registry = await createRuntimeRegistry();
      const enabledTools = await mcpService.getEnabledTools();
      const extensionTools = registry.getAll()
        .map(tool => tool.name)
        .filter(isExtensionToolName);
      tools = registry.toJSONSchema([...enabledTools, ...extensionTools]);
    }

    const protocolMessages = normalizeToolProtocolMessages(messages);
    console.log('[LineCode] Sending to', model.provider, model.modelId, 'messages:', protocolMessages.length, 'tools:', tools.length, 'reasoningEffort:', reasoningEffort, 'preserveReasoning:', preserveReasoning);
    try {
      if (model.provider === 'local' && !LOCAL_MODEL_ENABLED) {
        throw new Error('当前安装包未编译本地模型支持，请安装本地模型版。');
      }
      const processor = this.processors[model.provider];
      if (!processor) throw new Error(`Unsupported provider: ${model.provider}`);
      return await processor.process(model, protocolMessages, tools, callbacks, { reasoningEffort, preserveReasoning, abortSignal });
    } catch (err) {
      console.error('[LineCode] API error:', err);
      throw err;
    }
  }

  convertToChatMessages(messages: { role: MessageRole; content: string; attachments?: InputAttachment[]; toolCalls?: ToolCall[]; toolCallId?: string; toolName?: string; isError?: boolean; reasoningContent?: string; reasoningDetails?: ReasoningDetail[] }[]): ChatMessage[] {
    return normalizeToolProtocolMessages(messages.map(m => {
      const legacy = m.role === 'user' ? this.splitLegacyAttachmentBlock(m.content) : null;
      return {
        role: m.role,
        content: legacy?.content || (legacy?.attachmentsText ? '已附加文件' : m.content),
        attachments: m.attachments,
        toolCalls: m.toolCalls,
        toolCallId: m.toolCallId,
        toolName: m.toolName,
        isError: m.isError,
        reasoningContent: m.reasoningContent,
        reasoningDetails: m.reasoningDetails,
      };
    }));
  }
}

export const aiService = new AIService();

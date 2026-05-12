import { Model, ContentBlock, ToolCall, MessageRole, ReasoningDetail } from '../../types';
import { SYSTEM_PROMPT } from '../../constants/prompt';
import { ToneMode, ReasoningEffort } from '../settings';
import { mcpService } from '../MCPService';
import { StreamProcessor, StreamCallbacks, ChatMessage } from './processors/StreamProcessor';
import { OpenAIStreamProcessor } from './processors/OpenAIProcessor';
import { AnthropicStreamProcessor } from './processors/AnthropicProcessor';
import { CodexStreamProcessor } from './processors/CodexProcessor';
import { TONE_PROMPTS } from './constants/tonePrompts';

export { SYSTEM_PROMPT };
export type { ChatMessage };

class AIService {
  private processors: Record<string, StreamProcessor> = {
    openai: new OpenAIStreamProcessor(),
    anthropic: new AnthropicStreamProcessor(),
    codex: new CodexStreamProcessor(),
  };

  async buildMessages(
    systemPrompt: string,
    history: ChatMessage[],
    toneMode: ToneMode = 'coding',
    homePath?: string,
  ): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];
    const toolPrompt = await mcpService.buildToolPrompt();
    const executionMode = await mcpService.getExecutionMode();
    
    let fullSystemPrompt = systemPrompt + (TONE_PROMPTS[toneMode] || '');
    
    if (homePath && executionMode !== 'ssh') {
      fullSystemPrompt += `\n\n## 工作目录\n当前工作目录（home目录）: ${homePath}\n所有文件操作都相对于此目录进行。`;
    }
    
    if (toolPrompt) {
      fullSystemPrompt += `\n\n${toolPrompt}`;
    }

    if (fullSystemPrompt) {
      messages.push({ role: 'system', content: fullSystemPrompt });
    }

    for (const msg of history) {
      messages.push({
        role: msg.role,
        content: msg.content,
        toolCalls: msg.toolCalls,
        toolCallId: msg.toolCallId,
        reasoningContent: msg.reasoningContent,
        reasoningDetails: msg.reasoningDetails,
      });
    }

    return messages;
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
      const { createDefaultRegistry } = await import('../../mcp/tools');
      const registry = createDefaultRegistry();
      const enabledTools = await mcpService.getEnabledTools();
      tools = registry.toJSONSchema(enabledTools);
    }

    console.log('[LineCode] Sending to', model.provider, model.modelId, 'messages:', messages.length, 'tools:', tools.length, 'reasoningEffort:', reasoningEffort, 'preserveReasoning:', preserveReasoning);
    try {
      const processor = this.processors[model.provider];
      if (!processor) throw new Error(`Unsupported provider: ${model.provider}`);
      return await processor.process(model, messages, tools, callbacks, { reasoningEffort, preserveReasoning, abortSignal });
    } catch (err) {
      console.error('[LineCode] API error:', err);
      throw err;
    }
  }

  convertToChatMessages(messages: { role: MessageRole; content: string; toolCalls?: ToolCall[]; toolCallId?: string; reasoningContent?: string; reasoningDetails?: ReasoningDetail[] }[]): ChatMessage[] {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolCallId: m.toolCallId,
      reasoningContent: m.reasoningContent,
      reasoningDetails: m.reasoningDetails,
    }));
  }
}

export const aiService = new AIService();

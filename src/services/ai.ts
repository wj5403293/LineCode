import { Model, ContentBlock, MessageRole, ToolCall } from '../types';
import { SYSTEM_PROMPT } from '../constants/prompt';
import { ToneMode } from './settings';
import { mcpService } from './MCPService';

export { SYSTEM_PROMPT };

export interface ChatMessage {
  role: MessageRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ToolCall[];
  reasoningContent?: string;
}

interface StreamCallbacks {
  onBlocks?: (blocks: ContentBlock[]) => void;
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  onToolCallDetected?: (toolCall: { id: string; name: string }) => void;
}

const TONE_PROMPTS: Record<ToneMode, string> = {
  chat: `
## 交流语气：聊天模式
- 语气亲切温柔，像朋友聊天
- 可以适当使用 emoji 表达情感 😊
- 回复可以更口语化
- 先肯定用户的想法，再给出建议
- 适当使用语气词让对话更自然
`,
  coding: `
## 交流语气：编程模式
- 语气严谨专业，不要废话
- 不使用 emoji
- 直接给出代码和结论
- 不要说"好的"、"没问题"等客套话
- 代码优先，解释其次
- 错误直接指出，不要委婉
`,
};

abstract class StreamProcessor {
  abstract process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[]; toolCalls?: ToolCall[]; reasoningContent?: string }>;

  protected createReader(res: Response): ReadableStreamDefaultReader<Uint8Array> {
    const reader = (res as any).body?.getReader();
    if (!reader) throw new Error('No response body');
    return reader;
  }

  protected createDecoder(): TextDecoder {
    return new (globalThis as any).TextDecoder();
  }
}

class OpenAIStreamProcessor extends StreamProcessor {
  async process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[]; toolCalls?: ToolCall[]; reasoningContent?: string }> {
    const baseUrl = model.baseUrl || 'https://api.openai.com/v1';

    const body: any = {
      model: model.modelId,
      messages: this.formatMessages(messages),
      stream: true,
    };

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    console.log('[LineCode] OpenAI request messages:', body.messages.length);
    body.messages.forEach((msg: any, i: number) => {
      console.log(`[LineCode] Message ${i}:`, JSON.stringify(msg).substring(0, 200));
    });
    console.log('[LineCode] OpenAI HTTP response status:', res.status, res.statusText);

    if (!res.ok) {
      let errText = '';
      try {
        const errJson = await res.json();
        errText = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        errText = await res.text();
      }
      throw new Error(`OpenAI ${res.status}: ${errText}`);
    }

    return this.readStream(res, callbacks);
  }

  private formatMessages(messages: ChatMessage[]): any[] {
    return messages.map(m => {
      if (m.role === 'system') {
        return { role: 'system', content: m.content };
      }
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const msg: any = {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
        if (m.reasoningContent) {
          console.log('[LineCode] Adding reasoning_content to message:', m.reasoningContent.substring(0, 50));
          msg.reasoning_content = m.reasoningContent;
        }
        return msg;
      }
      if (m.role === 'assistant' && m.reasoningContent) {
        return { role: 'assistant', content: m.content, reasoning_content: m.reasoningContent };
      }
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content };
    });
  }

  private async readStream(
    res: Response,
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[]; toolCalls?: ToolCall[]; reasoningContent?: string }> {
    const reader = this.createReader(res);
    const decoder = this.createDecoder();
    let full = '';
    let reasoningFull = '';
    let buffer = '';
    const blocks: ContentBlock[] = [{ type: 'text', content: '' }];
    const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

    while (true) {
      const { done, value } = await reader.read();
      console.log('[LineCode] OpenAI Stream read - done:', done, 'value length:', value?.length || 0);
      if (done) {
        console.log('[LineCode] OpenAI Stream done');
        console.log('[LineCode] - blocks:', blocks.length);
        console.log('[LineCode] - toolCallsMap:', toolCallsMap.size);
        console.log('[LineCode] - full text:', full.substring(0, 100) || '(empty)');
        console.log('[LineCode] - reasoningFull:', reasoningFull.substring(0, 100) || '(empty)');
        break;
      }

      const decoded = decoder.decode(value, { stream: true });
      console.log('[LineCode] OpenAI Stream raw:', decoded.substring(0, 300));
      buffer += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      console.log('[LineCode] OpenAI Stream lines:', lines.length);

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const delta = json.choices?.[0]?.delta;
            console.log('[LineCode] delta:', JSON.stringify(delta).substring(0, 100));

            if (typeof delta?.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
              console.log('[LineCode] Captured reasoning_content:', delta.reasoning_content.substring(0, 20));
              reasoningFull += delta.reasoning_content;
            }

            if (delta?.content) {
              full += delta.content;
              blocks[blocks.length - 1].content = full;
              callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
            }

            if (delta?.tool_calls) {
              for (const tc of delta.tool_calls) {
                const idx = tc.index ?? 0;
                if (!toolCallsMap.has(idx)) {
                  toolCallsMap.set(idx, { id: tc.id || '', name: '', arguments: '' });
                }
                const existing = toolCallsMap.get(idx)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) {
                  existing.name = tc.function.name;
                  callbacks?.onToolCallDetected?.({ id: existing.id, name: existing.name });
                }
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
          } catch {}
        }
      }
    }

    const toolCalls = toolCallsMap.size > 0
      ? Array.from(toolCallsMap.values()).map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        }))
      : [];

    if (toolCalls.length > 0) {
      callbacks?.onToolCalls?.(toolCalls);
    }

    return { text: full, blocks, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, reasoningContent: reasoningFull || undefined };
  }
}

class AnthropicStreamProcessor extends StreamProcessor {
  async process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[]; toolCalls?: ToolCall[]; reasoningContent?: string }> {
    const baseUrl = model.baseUrl || 'https://api.anthropic.com';
    const { system, messages: userMessages } = this.formatMessages(messages);

    const body: any = {
      model: model.modelId,
      max_tokens: 4096,
      messages: userMessages,
      stream: true,
    };

    if (system) body.system = system;

    if (tools.length > 0) {
      body.tools = tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    console.log('[LineCode] Anthropic request body:', JSON.stringify(body, null, 2)?.substring(0, 500));
    body.messages.forEach((msg: any, i: number) => {
      console.log(`[LineCode] Message ${i}: role=${msg.role}`, msg.content);
    });

    console.log('[LineCode] HTTP response status:', res.status, res.statusText);

    if (!res.ok) {
      let errText = '';
      try {
        const errJson = await res.json();
        errText = errJson?.error?.message || JSON.stringify(errJson);
      } catch {
        errText = await res.text();
      }
      throw new Error(`Anthropic ${res.status}: ${errText}`);
    }

    return this.readStream(res, callbacks);
  }

  private formatMessages(messages: ChatMessage[]): {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: any }[];
  } {
    let system: string | undefined;
    const formatted: { role: 'user' | 'assistant'; content: any }[] = [];

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role === 'system') {
        system = msg.content;
      } else if (msg.role === 'tool') {
        const toolResults: { type: 'tool_result'; tool_use_id: string; content: string }[] = [{
          type: 'tool_result',
          tool_use_id: msg.toolCallId!,
          content: msg.content,
        }];
        while (i + 1 < messages.length && messages[i + 1].role === 'tool') {
          i++;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: messages[i].toolCallId!,
            content: messages[i].content,
          });
        }
        formatted.push({
          role: 'user',
          content: toolResults,
        });
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        const content: any[] = [];
        // DeepSeek Anthropic 格式要求：thinking 块必须在 tool_use 之前
        if (msg.reasoningContent) {
          console.log('[LineCode] Adding thinking block to Anthropic message:', msg.reasoningContent.substring(0, 50));
          content.push({ type: 'thinking', thinking: msg.reasoningContent });
        }
        if (msg.content) content.push({ type: 'text', text: msg.content });
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.arguments),
          });
        }
        console.log('[LineCode] Anthropic assistant message content blocks:', content.length);
        formatted.push({ role: 'assistant', content });
      } else if (msg.role === 'assistant' && msg.reasoningContent) {
        // 有 reasoningContent 但没有 toolCalls
        formatted.push({
          role: 'assistant',
          content: [
            { type: 'thinking', thinking: msg.reasoningContent },
            ...(msg.content ? [{ type: 'text', text: msg.content }] : []),
          ],
        });
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        formatted.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    return { system, messages: formatted };
  }

  private async readStream(
    res: Response,
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[]; toolCalls?: ToolCall[]; reasoningContent?: string }> {
    const reader = this.createReader(res);
    const decoder = this.createDecoder();
    let buffer = '';
    const blocks: ContentBlock[] = [];
    let currentBlockType: 'thinking' | 'text' | 'tool_use' | null = null;
    let currentBlockIndex = -1;
    const toolCalls: ToolCall[] = [];
    let currentToolCall: { id: string; name: string; input: string } | null = null;

    const ensureBlock = (type: 'thinking' | 'text' | 'tool_use'): number => {
      if (currentBlockType !== type) {
        blocks.push({ type: type === 'tool_use' ? 'tool_use' : type, content: '' });
        currentBlockType = type;
        currentBlockIndex = blocks.length - 1;
      }
      return currentBlockIndex;
    };

    while (true) {
      const { done, value } = await reader.read();
      console.log('[LineCode] Anthropic Stream read - done:', done, 'value length:', value?.length || 0);
      if (done) {
        console.log('[LineCode] Anthropic Stream done, blocks:', blocks.length, 'toolCalls:', toolCalls.length);
        break;
      }

      const decoded = decoder.decode(value, { stream: true });
      console.log('[LineCode] Anthropic Stream raw:', decoded.substring(0, 200));
      buffer += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      console.log('[LineCode] Anthropic Stream lines:', lines.length);

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);
          console.log('[LineCode] Stream event:', json.type, json);

          if (json.type === 'content_block_start') {
            const blockType = json.content_block?.type;
            if (blockType === 'thinking') {
              ensureBlock('thinking');
            } else if (blockType === 'text') {
              ensureBlock('text');
            } else if (blockType === 'tool_use') {
              currentToolCall = {
                id: json.content_block.id,
                name: json.content_block.name,
                input: '',
              };
              ensureBlock('tool_use');
              blocks[currentBlockIndex].id = json.content_block.id;
              blocks[currentBlockIndex].name = json.content_block.name;
              callbacks?.onToolCallDetected?.({ id: json.content_block.id, name: json.content_block.name });
            }
          } else if (json.type === 'content_block_delta') {
            if (json.delta?.type === 'thinking_delta') {
              const idx = ensureBlock('thinking');
              blocks[idx].content += json.delta.thinking || '';
              callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
            } else if (json.delta?.type === 'text_delta') {
              const idx = ensureBlock('text');
              blocks[idx].content += json.delta.text || '';
              callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
            } else if (json.delta?.type === 'input_json_delta') {
              if (currentToolCall) {
                currentToolCall.input += json.delta.partial_json || '';
              }
            }
          } else if (json.type === 'content_block_stop') {
            if (currentToolCall) {
              toolCalls.push({
                id: currentToolCall.id,
                name: currentToolCall.name,
                arguments: currentToolCall.input || '{}',
              });
              blocks[currentBlockIndex].content = currentToolCall.input || '{}';
              currentToolCall = null;
            }
            currentBlockType = null;
          }
        } catch {}
      }
    }

    if (toolCalls.length > 0) {
      callbacks?.onToolCalls?.(toolCalls);
    }

    const fullText = blocks.filter(b => b.type === 'text').map(b => b.content).join('');
    const reasoningContent = blocks.filter(b => b.type === 'thinking').map(b => b.content).join('');
    return { text: fullText, blocks, toolCalls: toolCalls.length > 0 ? toolCalls : undefined, reasoningContent: reasoningContent || undefined };
  }
}

class AIService {
  private processors: Record<string, StreamProcessor> = {
    openai: new OpenAIStreamProcessor(),
    anthropic: new AnthropicStreamProcessor(),
  };

  async buildMessages(
    systemPrompt: string,
    history: ChatMessage[],
    toneMode: ToneMode = 'coding',
    homePath?: string,
  ): Promise<ChatMessage[]> {
    const messages: ChatMessage[] = [];
    const toolPrompt = await mcpService.buildToolPrompt();
    
    let fullSystemPrompt = systemPrompt + (TONE_PROMPTS[toneMode] || '');
    
    if (homePath) {
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
      });
    }

    return messages;
  }

  async sendMessage(
    model: Model,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[]; toolCalls?: ToolCall[]; reasoningContent?: string }> {
    const { createDefaultRegistry } = await import('../mcp/tools');
    const registry = createDefaultRegistry();
    const enabledTools = await mcpService.getEnabledTools();
    const tools = registry.toJSONSchema(enabledTools);

    console.log('[LineCode] Sending to', model.provider, model.modelId, 'messages:', messages.length, 'tools:', tools.length);
    try {
      const processor = this.processors[model.provider];
      if (!processor) throw new Error(`Unsupported provider: ${model.provider}`);
      return await processor.process(model, messages, tools, callbacks);
    } catch (err) {
      console.error('[LineCode] API error:', err);
      throw err;
    }
  }

  convertToChatMessages(messages: { role: MessageRole; content: string; toolCalls?: ToolCall[]; toolCallId?: string }[]): ChatMessage[] {
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolCallId: m.toolCallId,
    }));
  }
}

export const aiService = new AIService();

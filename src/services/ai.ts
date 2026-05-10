import { Model, ContentBlock, MessageRole } from '../types';
import { SYSTEM_PROMPT } from '../constants/prompt';
import { ToneMode } from './settings';

export { SYSTEM_PROMPT };

export interface ChatMessage {
  role: MessageRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
}

interface StreamCallbacks {
  onBlocks?: (blocks: ContentBlock[]) => void;
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
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[] }>;

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
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[] }> {
    const baseUrl = model.baseUrl || 'https://api.openai.com/v1';

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: model.modelId,
        messages: this.formatMessages(messages),
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI ${res.status}: ${err}`);
    }

    return this.readStream(res, callbacks);
  }

  private formatMessages(messages: ChatMessage[]): { role: string; content: string }[] {
    return messages
      .filter(m => m.role !== 'tool')
      .map(m => ({
        role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));
  }

  private async readStream(
    res: Response,
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[] }> {
    const reader = this.createReader(res);
    const decoder = this.createDecoder();
    let full = '';
    let buffer = '';
    const blocks: ContentBlock[] = [{ type: 'text', content: '' }];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const json = JSON.parse(line.slice(6));
            const delta = json.choices?.[0]?.delta?.content || '';
            full += delta;
            blocks[blocks.length - 1].content = full;
            callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
          } catch {}
        }
      }
    }

    return { text: full, blocks };
  }
}

class AnthropicStreamProcessor extends StreamProcessor {
  async process(
    model: Model,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[] }> {
    const baseUrl = model.baseUrl || 'https://api.anthropic.com';
    const { system, messages: userMessages } = this.formatMessages(messages);

    const body: any = {
      model: model.modelId,
      max_tokens: 4096,
      messages: userMessages,
      stream: true,
    };

    if (system) {
      body.system = system;
    }

    console.log('[LineAI] Anthropic request:', { model: model.modelId, messageCount: userMessages.length, hasSystem: !!system });

    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': model.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Anthropic ${res.status}: ${err}`);
    }

    return this.readStream(res, callbacks);
  }

  private formatMessages(messages: ChatMessage[]): {
    system?: string;
    messages: { role: 'user' | 'assistant'; content: string }[];
  } {
    let system: string | undefined;
    const formatted: { role: 'user' | 'assistant'; content: string }[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content;
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        formatted.push({ role: msg.role, content: msg.content });
      }
    }

    return { system, messages: formatted };
  }

  private async readStream(
    res: Response,
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[] }> {
    const reader = this.createReader(res);
    const decoder = this.createDecoder();
    let buffer = '';
    const blocks: ContentBlock[] = [];
    let currentBlockType: 'thinking' | 'text' | null = null;
    let currentBlockIndex = -1;

    const ensureBlock = (type: 'thinking' | 'text'): number => {
      if (currentBlockType !== type) {
        blocks.push({ type, content: '' });
        currentBlockType = type;
        currentBlockIndex = blocks.length - 1;
      }
      return currentBlockIndex;
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;

        try {
          const json = JSON.parse(data);

          if (json.type === 'content_block_start') {
            const blockType = json.content_block?.type;
            if (blockType === 'thinking') ensureBlock('thinking');
            else if (blockType === 'text') ensureBlock('text');
          } else if (json.type === 'content_block_delta') {
            if (json.delta?.type === 'thinking_delta') {
              const idx = ensureBlock('thinking');
              blocks[idx].content += json.delta.thinking || '';
              callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
            } else if (json.delta?.type === 'text_delta') {
              const idx = ensureBlock('text');
              blocks[idx].content += json.delta.text || '';
              callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
            }
          } else if (json.type === 'content_block_stop') {
            currentBlockType = null;
          }
        } catch {}
      }
    }

    const fullText = blocks.filter(b => b.type === 'text').map(b => b.content).join('');
    console.log('[LineAI] Stream done. Blocks:', blocks.length, 'Text:', fullText.length);
    return { text: fullText, blocks };
  }
}

class AIService {
  private processors: Record<string, StreamProcessor> = {
    openai: new OpenAIStreamProcessor(),
    anthropic: new AnthropicStreamProcessor(),
  };

  buildMessages(
    systemPrompt: string,
    history: { role: MessageRole; content: string }[],
    toneMode: ToneMode = 'coding',
  ): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const fullSystemPrompt = systemPrompt + (TONE_PROMPTS[toneMode] || '');

    if (fullSystemPrompt) {
      messages.push({ role: 'system', content: fullSystemPrompt });
    }

    for (const msg of history) {
      messages.push({ role: msg.role, content: msg.content });
    }

    return messages;
  }

  async sendMessage(
    model: Model,
    messages: ChatMessage[],
    callbacks?: StreamCallbacks,
  ): Promise<{ text: string; blocks: ContentBlock[] }> {
    console.log('[LineAI] Sending to', model.provider, model.modelId, 'messages:', messages.length);
    try {
      const processor = this.processors[model.provider];
      if (!processor) throw new Error(`Unsupported provider: ${model.provider}`);
      return await processor.process(model, messages, callbacks);
    } catch (err) {
      console.error('[LineAI] API error:', err);
      throw err;
    }
  }
}

export const aiService = new AIService();

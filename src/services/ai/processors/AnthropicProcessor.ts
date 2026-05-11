import { Model, ContentBlock, ToolCall } from '../../../types';
import { StreamProcessor, StreamCallbacks, StreamOptions, StreamResult, ChatMessage } from './StreamProcessor';
import { ReasoningEffort } from '../../settings';

export class AnthropicStreamProcessor extends StreamProcessor {
  async process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
    options?: StreamOptions,
  ): Promise<StreamResult> {
    const baseUrl = model.baseUrl || 'https://api.anthropic.com';
    const reasoningEffort = options?.reasoningEffort || 'medium';
    const abortSignal = options?.abortSignal;
    const { system, messages: userMessages } = this.formatMessages(messages);

    const body: any = {
      model: model.modelId,
      max_tokens: 4096,
      messages: userMessages,
      stream: true,
    };

    if (system) body.system = system;

    if (reasoningEffort !== 'off') {
      const budgetMap: Record<Exclude<ReasoningEffort, 'off'>, number> = {
        low: 1024,
        medium: 4096,
        high: 8192,
        max: 16000,
      };
      body.thinking = {
        type: 'enabled',
        budget_tokens: budgetMap[reasoningEffort as Exclude<ReasoningEffort, 'off'>],
      };
    }

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
      signal: abortSignal,
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

    return this.readStream(res, callbacks, abortSignal);
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
    abortSignal?: AbortSignal,
  ): Promise<StreamResult> {
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

    try {
      while (true) {
        if (abortSignal?.aborted) {
          reader.cancel();
          break;
        }

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
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LineCode] Anthropic Stream aborted by user');
      } else {
        throw err;
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

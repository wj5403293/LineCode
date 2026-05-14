import { Model, ContentBlock, ToolCall, ReasoningDetail } from '../../../types';
import { StreamProcessor, StreamCallbacks, StreamOptions, StreamResult, ChatMessage } from './StreamProcessor';
import { ReasoningEffort } from '../../settings';
import { getApiModelId } from '../../../utils/modelContext';

export class AnthropicStreamProcessor extends StreamProcessor {
  async process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
    options?: StreamOptions,
  ): Promise<StreamResult> {
    const baseUrl = model.baseUrl || 'https://api.anthropic.com';
    const apiModelId = getApiModelId(model.modelId);
    const reasoningEffort = options?.reasoningEffort || 'medium';
    const preserveReasoning = options?.preserveReasoning || false;
    const abortSignal = options?.abortSignal;
    const requestedThinking = reasoningEffort !== 'off';
    const canReplayToolThinking = !this.hasUnreplayableToolThinking(messages);
    const enableThinking = requestedThinking && canReplayToolThinking;
    if (requestedThinking && !canReplayToolThinking) {
      console.warn('[LineCode] Anthropic thinking disabled for this request: missing signed thinking for a prior tool_use');
    }
    const budgetMap: Record<Exclude<ReasoningEffort, 'off'>, number> = {
      low: 1024,
      medium: 4096,
      high: 8192,
      max: 16000,
    };
    const thinkingBudget = enableThinking
      ? budgetMap[reasoningEffort as Exclude<ReasoningEffort, 'off'>]
      : 0;
    const { system, messages: userMessages } = this.formatMessages(messages, {
      includeThinking: enableThinking,
      preserveReasoning,
    });

    const body: any = {
      model: apiModelId,
      max_tokens: thinkingBudget > 0 ? Math.max(4096, thinkingBudget + 1024) : 4096,
      messages: userMessages,
      stream: true,
    };

    if (system) body.system = system;

    if (enableThinking) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: thinkingBudget,
      };
    }

    if (tools.length > 0) {
      body.tools = tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }));
    }

    const requestUrl = `${baseUrl}/v1/messages`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': model.apiKey,
      'anthropic-version': '2023-06-01',
    };

    if (
      enableThinking &&
      tools.length > 0 &&
      baseUrl.toLowerCase().includes('anthropic.com') &&
      /claude-(opus|sonnet)-4/i.test(apiModelId)
    ) {
      headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
    }

    const res = await this.fetchWithRetry({
      providerName: 'Anthropic',
      requestUrl,
      abortSignal,
      callbacks,
      networkHint: '请检查网络连接、Base URL 是否正确，以及是否需要配置代理/VPN',
      httpHint: '如果收到 404，请检查 Base URL 是否正确（如 https://api.anthropic.com）',
      init: {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      },
    });

    console.log('[LineCode] Anthropic request body:', JSON.stringify(body, null, 2)?.substring(0, 500));
    body.messages.forEach((msg: any, i: number) => {
      console.log(`[LineCode] Message ${i}: role=${msg.role}`, msg.content);
    });

    console.log('[LineCode] HTTP response status:', res.status, res.statusText);

    return this.readStream(res, callbacks, abortSignal);
  }

  private formatMessages(messages: ChatMessage[], options: { includeThinking: boolean; preserveReasoning: boolean }): {
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
        const toolResults: { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }[] = [{
          type: 'tool_result',
          tool_use_id: msg.toolCallId!,
          content: msg.content,
          ...(msg.isError ? { is_error: true } : {}),
        }];
        while (i + 1 < messages.length && messages[i + 1].role === 'tool') {
          i++;
          toolResults.push({
            type: 'tool_result',
            tool_use_id: messages[i].toolCallId!,
            content: messages[i].content,
            ...(messages[i].isError ? { is_error: true } : {}),
          });
        }
        formatted.push({
          role: 'user',
          content: toolResults,
        });
      } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        const content: any[] = [];
        if (options.includeThinking) {
          content.push(...this.getThinkingBlocksForReplay(msg, true));
        }
        if (msg.content) content.push({ type: 'text', text: msg.content });
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: this.safeParseToolInput(tc.arguments),
          });
        }
        console.log('[LineCode] Anthropic assistant message content blocks:', content.length);
        formatted.push({ role: 'assistant', content });
      } else if (msg.role === 'assistant' && options.includeThinking && options.preserveReasoning) {
        const thinkingBlocks = this.getThinkingBlocksForReplay(msg, true);
        formatted.push({
          role: 'assistant',
          content: thinkingBlocks.length > 0
            ? [
                ...thinkingBlocks,
                ...(msg.content ? [{ type: 'text', text: msg.content }] : []),
              ]
            : msg.content,
        });
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        formatted.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
      }
    }

    return { system, messages: formatted };
  }

  private safeParseToolInput(raw: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  private hasUnreplayableToolThinking(messages: ChatMessage[]): boolean {
    return messages.some(msg => {
      if (msg.role !== 'assistant' || !msg.toolCalls?.length) return false;
      if (!msg.reasoningContent && !msg.reasoningDetails?.length) return false;
      return this.getThinkingBlocksForReplay(msg, true).length === 0;
    });
  }

  private getThinkingBlocksForReplay(msg: ChatMessage, requireSignature: boolean): Record<string, unknown>[] {
    if (msg.reasoningDetails?.length) {
      return msg.reasoningDetails
        .filter(detail => {
          if (detail.type === 'redacted_thinking') return typeof detail.data === 'string';
          if (detail.type !== 'thinking') return false;
          if (typeof detail.thinking !== 'string') return false;
          return !requireSignature || typeof detail.signature === 'string';
        })
        .map(detail => ({ ...detail }));
    }

    if (!requireSignature && msg.reasoningContent) {
      return [{ type: 'thinking', thinking: msg.reasoningContent }];
    }

    return [];
  }

  private async readStream(
    res: Response,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<StreamResult> {
    const reader = this.createReader(res);
    abortSignal?.addEventListener('abort', () => reader.cancel(), { once: true });

    const decoder = this.createDecoder();
    let buffer = '';
    const blocks: ContentBlock[] = [];
    let currentBlockType: 'thinking' | 'text' | 'tool_use' | null = null;
    let currentBlockIndex = -1;
    const toolCalls: ToolCall[] = [];
    let currentToolCall: { id: string; name: string; input: string } | null = null;
    let currentThinkingDetail: ReasoningDetail | null = null;
    const reasoningDetails: ReasoningDetail[] = [];

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
        if (abortSignal?.aborted) break;

        const { done, value } = await this.readChunkWithTimeout(reader, 'Anthropic', abortSignal);
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

          let json: any;
          try {
            json = JSON.parse(data);
          } catch {
            console.warn('[LineCode] Anthropic Stream invalid JSON line:', data.substring(0, 200));
            continue;
          }
          console.log('[LineCode] Stream event:', json.type, json);

          if (json.type === 'error' || json.error) {
            throw new Error(`Anthropic 流式错误: ${this.describeErrorPayload(json.error || json)}`);
          }

          if (json.type === 'message_stop') {
              if (currentThinkingDetail) {
                reasoningDetails.push({ ...currentThinkingDetail });
                currentThinkingDetail = null;
              }
              if (currentToolCall) {
                toolCalls.push({
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: currentToolCall.input || '{}',
                });
                if (currentBlockIndex >= 0 && blocks[currentBlockIndex]?.type === 'tool_use') {
                  blocks[currentBlockIndex].content = currentToolCall.input || '{}';
                }
                currentToolCall = null;
              }
              currentBlockType = null;
            continue;
          }

          if (json.type === 'content_block_start') {
              const blockType = json.content_block?.type;
              if (blockType === 'thinking') {
                ensureBlock('thinking');
                currentThinkingDetail = {
                  type: 'thinking',
                  thinking: json.content_block.thinking || '',
                };
                if (json.content_block.signature) {
                  currentThinkingDetail.signature = json.content_block.signature;
                }
              } else if (blockType === 'redacted_thinking') {
                ensureBlock('thinking');
                blocks[currentBlockIndex].content += '[redacted thinking]';
                currentThinkingDetail = {
                  type: 'redacted_thinking',
                  data: json.content_block.data || '',
                };
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
                const thinking = json.delta.thinking || '';
                blocks[idx].content += thinking;
                if (currentThinkingDetail?.type === 'thinking') {
                  currentThinkingDetail.thinking = `${String(currentThinkingDetail.thinking || '')}${thinking}`;
                }
                callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
              } else if (json.delta?.type === 'signature_delta') {
                if (currentThinkingDetail?.type === 'thinking') {
                  const signature = json.delta.signature || '';
                  currentThinkingDetail.signature = `${String(currentThinkingDetail.signature || '')}${signature}`;
                }
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
              if (currentThinkingDetail) {
                reasoningDetails.push({ ...currentThinkingDetail });
                currentThinkingDetail = null;
              }
              if (currentToolCall) {
                toolCalls.push({
                  id: currentToolCall.id,
                  name: currentToolCall.name,
                  arguments: currentToolCall.input || '{}',
                });
                if (currentBlockIndex >= 0) {
                  blocks[currentBlockIndex].content = currentToolCall.input || '{}';
                }
                currentToolCall = null;
              }
              currentBlockType = null;
          }
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
    if (!abortSignal?.aborted && !fullText.trim() && !reasoningContent.trim() && toolCalls.length === 0) {
      throw new Error('Anthropic 响应结束但没有返回任何内容。请检查模型是否支持当前协议、流式输出是否被代理截断，或切换到正确的 Base URL。');
    }
    return {
      text: fullText,
      blocks,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      reasoningContent: reasoningContent || undefined,
      reasoningDetails: reasoningDetails.length > 0 ? reasoningDetails : undefined,
    };
  }
}

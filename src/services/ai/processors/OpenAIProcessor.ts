import { Model, ContentBlock } from '../../../types';
import { getApiModelId } from '../../../utils/modelContext';
import { StreamProcessor, StreamCallbacks, StreamOptions, StreamResult, ChatMessage } from './StreamProcessor';
import { OpenAICompatibilityDetector, OpenAIReasoningRequestAdapter } from './openai/OpenAICompatibility';
import { OpenAIMessageFormatter } from './openai/OpenAIMessageFormatter';

export class OpenAIStreamProcessor extends StreamProcessor {
  private compatibilityDetector = new OpenAICompatibilityDetector();
  private reasoningAdapter = new OpenAIReasoningRequestAdapter();
  private messageFormatter = new OpenAIMessageFormatter();

  async process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
    options?: StreamOptions,
  ): Promise<StreamResult> {
    const baseUrl = model.baseUrl || 'https://api.openai.com/v1';
    const reasoningEffort = options?.reasoningEffort || 'medium';
    const preserveReasoning = options?.preserveReasoning || false;
    const abortSignal = options?.abortSignal;
    const apiModelId = getApiModelId(model.modelId);

    const capabilities = this.compatibilityDetector.detect(baseUrl, apiModelId);
    const messageFormatOptions = this.reasoningAdapter.getMessageFormatOptions(
      capabilities,
      messages,
      reasoningEffort,
      preserveReasoning,
    );
    const body: any = {
      model: apiModelId,
      messages: this.messageFormatter.format(messages, messageFormatOptions),
      stream: true,
    };

    console.log(
      '[LineCode] OpenAI-compatible provider:',
      capabilities.provider,
      'reasoningEffort:',
      reasoningEffort,
      'preserveReasoning:',
      preserveReasoning,
      'includeReasoning:',
      messageFormatOptions.includeReasoning,
      'padMissingToolCallReasoning:',
      messageFormatOptions.padMissingToolCallReasoning,
    );

    this.reasoningAdapter.applyRequestReasoning(
      body,
      capabilities,
      reasoningEffort,
      messageFormatOptions.includeReasoning,
    );

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    console.log('[LineCode] OpenAI request body:', JSON.stringify(body, null, 2)?.substring(0, 500));

    const requestUrl = `${baseUrl}/chat/completions`;

    const res = await this.fetchWithRetry({
      providerName: 'OpenAI',
      requestUrl,
      abortSignal,
      callbacks,
      networkHint: '请检查网络连接、Base URL 是否正确，以及是否需要配置代理/VPN',
      httpHint: '如果收到 404，请检查 Base URL 是否包含完整路径（如 https://api.openai.com/v1）',
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify(body),
      },
    });

    console.log('[LineCode] OpenAI request messages:', body.messages.length);
    body.messages.forEach((msg: any, i: number) => {
      console.log(`[LineCode] Message ${i}:`, JSON.stringify(msg).substring(0, 200));
    });
    console.log('[LineCode] OpenAI HTTP response status:', res.status, res.statusText);

    return this.readStream(res, callbacks, abortSignal);
  }

  private async readStream(
    res: Response,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<StreamResult> {
    const reader = this.createReader(res);
    abortSignal?.addEventListener('abort', () => reader.cancel(), { once: true });

    const decoder = this.createDecoder();
    let full = '';
    let reasoningFull = '';
    let reasoningDetails: Record<string, unknown>[] | undefined;
    let buffer = '';
    const blocks: ContentBlock[] = [];
    const toolCallsMap = new Map<number, { id: string; name: string; arguments: string }>();

    const ensureThinkingBlock = (): ContentBlock => {
      let block = blocks.find(b => b.type === 'thinking');
      if (!block) {
        block = { type: 'thinking', content: '' };
        blocks.push(block);
      }
      return block;
    };

    const ensureTextBlock = (): ContentBlock => {
      let block = blocks.find(b => b.type === 'text');
      if (!block) {
        block = { type: 'text', content: '' };
        blocks.push(block);
      }
      return block;
    };

    try {
      while (true) {
        if (abortSignal?.aborted) break;

        const { done, value } = await this.readChunkWithTimeout(reader, 'OpenAI', abortSignal);
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
          if (line.startsWith('data: ') && line.trim() !== 'data: [DONE]') {
            let json: any;
            try {
              json = JSON.parse(line.slice(6));
            } catch {
              console.warn('[LineCode] OpenAI Stream invalid JSON line:', line.substring(0, 200));
              continue;
            }
            if (json.error) {
              throw new Error(`OpenAI 流式错误: ${this.describeErrorPayload(json.error)}`);
            }
            const delta = json.choices?.[0]?.delta;
            const finishReason = json.choices?.[0]?.finish_reason;
            if (finishReason === 'content_filter') {
              throw new Error('OpenAI 流式错误: 输出被内容安全策略拦截');
            }
            console.log('[LineCode] delta:', JSON.stringify(delta).substring(0, 100));

            const reasoningDelta = this.extractReasoningDelta(delta);
            if (reasoningDelta) {
              console.log('[LineCode] Captured reasoning delta:', reasoningDelta.substring(0, 20));
              reasoningFull += reasoningDelta;
              ensureThinkingBlock().content = reasoningFull;
              callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
            }

            const nextReasoningDetails = this.extractReasoningDetails(delta);
            if (nextReasoningDetails) {
              reasoningDetails = nextReasoningDetails;
              if (!reasoningFull) {
                const detailsText = this.reasoningDetailsToText(reasoningDetails);
                if (detailsText) {
                  reasoningFull = detailsText;
                  ensureThinkingBlock().content = reasoningFull;
                  callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));
                }
              }
            }

            if (delta?.content) {
              const contentDelta = String(delta.content);
              const parsedContent = this.parseThinkTags(contentDelta);
              if (parsedContent.thinking) {
                reasoningFull += parsedContent.thinking;
                ensureThinkingBlock().content = reasoningFull;
              }
              full += parsedContent.text;
              ensureTextBlock().content = full;
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
          }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LineCode] OpenAI Stream aborted by user');
      } else {
        throw err;
      }
    }

    const toolCalls = toolCallsMap.size > 0
      ? Array.from(toolCallsMap.values()).filter(tc => tc.id && tc.name).map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments,
        }))
      : [];

    if (toolCalls.length > 0) {
      callbacks?.onToolCalls?.(toolCalls);
      for (const tc of toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          content: tc.arguments,
        });
      }
    }

    if (!abortSignal?.aborted && !full.trim() && !reasoningFull.trim() && toolCalls.length === 0) {
      throw new Error('OpenAI 响应结束但没有返回任何内容。请检查模型是否支持当前协议、流式输出是否被代理截断，或切换到正确的 Base URL。');
    }

    return {
      text: full,
      blocks,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      reasoningContent: reasoningFull || undefined,
      reasoningDetails,
    };
  }

  private extractReasoningDelta(delta: any): string {
    if (typeof delta?.reasoning_content === 'string') return delta.reasoning_content;
    if (typeof delta?.reasoning === 'string') return delta.reasoning;
    if (typeof delta?.reasoning?.content === 'string') return delta.reasoning.content;
    if (typeof delta?.reasoning?.text === 'string') return delta.reasoning.text;
    if (typeof delta?.reasoning_details?.content === 'string') return delta.reasoning_details.content;
    if (Array.isArray(delta?.reasoning_details)) {
      return delta.reasoning_details
        .map((detail: any) => {
          if (typeof detail === 'string') return detail;
          if (typeof detail?.content === 'string') return detail.content;
          if (typeof detail?.text === 'string') return detail.text;
          if (typeof detail?.reasoning_content === 'string') return detail.reasoning_content;
          return '';
        })
        .join('');
    }
    return '';
  }

  private extractReasoningDetails(delta: any): Record<string, unknown>[] | undefined {
    if (Array.isArray(delta?.reasoning_details)) {
      return delta.reasoning_details.filter((detail: unknown) => detail && typeof detail === 'object');
    }
    if (delta?.reasoning_details && typeof delta.reasoning_details === 'object') {
      return [delta.reasoning_details];
    }
    return undefined;
  }

  private reasoningDetailsToText(details: Record<string, unknown>[]): string {
    return details
      .map(detail => {
        const content = detail.content || detail.text || detail.reasoning_content;
        return typeof content === 'string' ? content : '';
      })
      .join('');
  }

  private parseThinkTags(content: string): { text: string; thinking: string } {
    let text = '';
    let thinking = '';
    let remaining = content;

    while (remaining.length > 0) {
      const openIndex = remaining.indexOf('<think>');
      if (openIndex === -1) {
        text += remaining;
        break;
      }

      text += remaining.slice(0, openIndex);
      const afterOpen = remaining.slice(openIndex + '<think>'.length);
      const closeIndex = afterOpen.indexOf('</think>');
      if (closeIndex === -1) {
        thinking += afterOpen;
        break;
      }

      thinking += afterOpen.slice(0, closeIndex);
      remaining = afterOpen.slice(closeIndex + '</think>'.length);
    }

    return { text, thinking };
  }
}

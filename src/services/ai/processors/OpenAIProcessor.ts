import { Model, ContentBlock } from '../../../types';
import { StreamProcessor, StreamCallbacks, StreamOptions, StreamResult, ChatMessage } from './StreamProcessor';

type OpenAICompatibleThinkingProvider = 'deepseek' | 'kimi' | 'qwen' | 'glm' | 'minimax' | 'mimo' | 'unknown';

interface ProviderCapabilities {
  provider: OpenAICompatibleThinkingProvider;
  requestStyle: 'thinking' | 'enable_thinking' | 'reasoning_split' | 'openai';
  supportsPreserveReasoning: boolean;
}

export class OpenAIStreamProcessor extends StreamProcessor {
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

    const baseUrlLower = baseUrl.toLowerCase();
    const modelIdLower = model.modelId.toLowerCase();
    const capabilities = this.detectCapabilities(baseUrlLower, modelIdLower);
    const hasToolExchange = messages.some(m =>
      m.role === 'tool' || (m.role === 'assistant' && !!m.toolCalls?.length)
    );
    const shouldPreserveReasoning =
      reasoningEffort !== 'off' &&
      capabilities.supportsPreserveReasoning &&
      (
        (preserveReasoning && !hasToolExchange) ||
        capabilities.provider === 'deepseek'
      );
    const body: any = {
      model: model.modelId,
      messages: this.formatMessages(messages, shouldPreserveReasoning),
      stream: true,
    };

    console.log(
      '[LineCode] OpenAI-compatible provider:',
      capabilities.provider,
      'reasoningEffort:',
      reasoningEffort,
      'preserveReasoning:',
      preserveReasoning,
    );

    if (capabilities.requestStyle === 'thinking') {
      body.thinking = { type: reasoningEffort === 'off' ? 'disabled' : 'enabled' };
      this.applyReasoningEffort(body, capabilities.provider, reasoningEffort);
      if (shouldPreserveReasoning && capabilities.provider === 'kimi') {
        body.thinking.keep = 'all';
      }
      if (shouldPreserveReasoning && capabilities.provider === 'glm') {
        body.clear_thinking = false;
      }
    } else if (capabilities.requestStyle === 'enable_thinking') {
      body.enable_thinking = reasoningEffort !== 'off';
      this.applyReasoningEffort(body, capabilities.provider, reasoningEffort);
      if (shouldPreserveReasoning) {
        body.preserve_thinking = true;
      }
    } else if (capabilities.requestStyle === 'reasoning_split') {
      body.reasoning_split = reasoningEffort !== 'off';
    } else if (reasoningEffort !== 'off') {
      body.reasoning = { effort: reasoningEffort };
    }

    if (tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    console.log('[LineCode] OpenAI request body:', JSON.stringify(body, null, 2)?.substring(0, 500));

    const requestUrl = `${baseUrl}/chat/completions`;

    let res: Response;
    try {
      res = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${model.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: abortSignal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') throw err;
      throw new Error(
        `网络请求失败: ${err.message}\n\n` +
        `请求地址: ${requestUrl}\n` +
        `提示: 请检查网络连接、Base URL 是否正确，以及是否需要配置代理/VPN`
      );
    }

    console.log('[LineCode] OpenAI request messages:', body.messages.length);
    body.messages.forEach((msg: any, i: number) => {
      console.log(`[LineCode] Message ${i}:`, JSON.stringify(msg).substring(0, 200));
    });
    console.log('[LineCode] OpenAI HTTP response status:', res.status, res.statusText);

    if (!res.ok) {
      const rawText = await res.text();
      let errText = rawText;
      try {
        const errJson = JSON.parse(rawText);
        if (errJson?.error?.message) {
          errText = errJson.error.message;
        }
      } catch {}
      throw new Error(
        `OpenAI ${res.status}: ${errText}\n\n` +
        `请求地址: ${requestUrl}\n` +
        `提示: 如果收到 404，请检查 Base URL 是否包含完整路径（如 https://api.openai.com/v1）`
      );
    }

    return this.readStream(res, callbacks, abortSignal);
  }

  private detectCapabilities(baseUrlLower: string, modelIdLower: string): ProviderCapabilities {
    if (baseUrlLower.includes('deepseek') || modelIdLower.includes('deepseek')) {
      return { provider: 'deepseek', requestStyle: 'thinking', supportsPreserveReasoning: true };
    }
    if (baseUrlLower.includes('moonshot') || baseUrlLower.includes('kimi') || modelIdLower.includes('kimi')) {
      return { provider: 'kimi', requestStyle: 'thinking', supportsPreserveReasoning: true };
    }
    if (baseUrlLower.includes('dashscope') || baseUrlLower.includes('aliyuncs') || modelIdLower.includes('qwen')) {
      return { provider: 'qwen', requestStyle: 'enable_thinking', supportsPreserveReasoning: true };
    }
    if (baseUrlLower.includes('bigmodel') || baseUrlLower.includes('zhipu') || modelIdLower.includes('glm')) {
      return { provider: 'glm', requestStyle: 'thinking', supportsPreserveReasoning: true };
    }
    if (baseUrlLower.includes('minimax') || modelIdLower.includes('minimax') || modelIdLower.includes('abab') || modelIdLower.includes('m2')) {
      return { provider: 'minimax', requestStyle: 'reasoning_split', supportsPreserveReasoning: true };
    }
    if (baseUrlLower.includes('mimo') || baseUrlLower.includes('xiaomi') || modelIdLower.includes('mimo')) {
      return { provider: 'mimo', requestStyle: 'thinking', supportsPreserveReasoning: true };
    }
    return { provider: 'unknown', requestStyle: 'openai', supportsPreserveReasoning: false };
  }

  private applyReasoningEffort(
    body: Record<string, unknown>,
    provider: OpenAICompatibleThinkingProvider,
    reasoningEffort: string,
  ): void {
    if (reasoningEffort === 'off') return;

    if (provider === 'deepseek') {
      body.reasoning_effort = reasoningEffort === 'max' ? 'max' : 'high';
      return;
    }

    if (provider === 'qwen') {
      const budgetMap: Record<string, number> = {
        low: 1024,
        medium: 4096,
        high: 8192,
        max: 16000,
      };
      body.thinking_budget = budgetMap[reasoningEffort] || budgetMap.medium;
    }
  }

  private formatMessages(messages: ChatMessage[], preserveReasoning: boolean): any[] {
    return messages.map(m => {
      if (m.role === 'system') {
        return { role: 'system', content: m.content };
      }
      if (m.role === 'tool') {
        return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
      }
      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const validToolCalls = m.toolCalls.filter(tc => tc.id && tc.name);
        const msg: any = {
          role: 'assistant',
          content: m.content || '',
          tool_calls: validToolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
        if (preserveReasoning && m.reasoningContent) {
          console.log('[LineCode] Adding reasoning_content to message:', m.reasoningContent.substring(0, 50));
          msg.reasoning_content = m.reasoningContent;
        }
        if (preserveReasoning && m.reasoningDetails) {
          msg.reasoning_details = m.reasoningDetails;
        }
        return msg.tool_calls.length > 0 ? msg : { role: 'assistant', content: m.content || '' };
      }
      if (m.role === 'assistant') {
        const msg: any = { role: 'assistant', content: m.content };
        if (preserveReasoning && m.reasoningContent) {
          msg.reasoning_content = m.reasoningContent;
        }
        if (preserveReasoning && m.reasoningDetails) {
          msg.reasoning_details = m.reasoningDetails;
        }
        return msg;
      }
      return { role: 'user', content: m.content };
    });
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
            } catch {}
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

import { Model, ContentBlock, ToolCall, ReasoningDetail } from '../../../types';
import { getApiModelId } from '../../../utils/modelContext';
import { StreamProcessor, StreamCallbacks, StreamOptions, StreamResult, ChatMessage } from './StreamProcessor';

type CodexResponseItem = Record<string, any>;

interface FormattedCodexMessages {
  instructions: string;
  input: CodexResponseItem[];
}

interface SseEvent {
  event: string;
  data: string;
}

export class CodexStreamProcessor extends StreamProcessor {
  private turnState?: string;

  async process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
    options?: StreamOptions,
  ): Promise<StreamResult> {
    const baseUrl = model.baseUrl || 'https://api.openai.com/v1';
    const requestUrl = this.responsesUrl(baseUrl);
    const reasoningEffort = options?.reasoningEffort || 'medium';
    const abortSignal = options?.abortSignal;
    const apiModelId = getApiModelId(model.modelId);
    const formatted = this.formatMessages(messages);
    const formattedTools = this.formatTools(tools);
    const body: Record<string, any> = {
      model: apiModelId,
      input: formatted.input,
      tools: formattedTools,
      parallel_tool_calls: true,
      store: true,
      stream: true,
      include: [],
    };

    if (formattedTools.length > 0) {
      body.tool_choice = 'auto';
    }

    if (formatted.instructions) {
      body.instructions = formatted.instructions;
    }

    const reasoning = this.formatReasoning(reasoningEffort);
    if (reasoning) {
      body.reasoning = reasoning;
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${model.apiKey}`,
      'Accept': 'text/event-stream',
    };

    if (this.turnState) {
      headers['x-codex-turn-state'] = this.turnState;
    }

    console.log('[LineCode] Codex Responses request:', requestUrl, 'items:', formatted.input.length, 'tools:', tools.length);

    let res: Response;
    try {
      res = await this.fetchWithRetry({
        providerName: 'Codex',
        requestUrl,
        abortSignal,
        callbacks,
        networkHint: '请检查网络连接、Base URL 是否为 Responses API 地址，以及 API Key 是否正确',
        httpHint: 'Codex 协议需要 OpenAI Responses API，Base URL 通常为 https://api.openai.com/v1',
        init: {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        this.turnState = undefined;
        throw err;
      }
      this.turnState = undefined;
      throw err;
    }

    const nextTurnState = res.headers?.get?.('x-codex-turn-state');
    if (nextTurnState) {
      this.turnState = nextTurnState;
    }

    console.log('[LineCode] Codex HTTP response status:', res.status, res.statusText);

    try {
      return await this.readResponsesStream(res, callbacks, abortSignal);
    } catch (err: any) {
      this.turnState = undefined;
      throw err;
    }
  }

  private responsesUrl(baseUrl: string): string {
    const clean = baseUrl.trim().replace(/\/+$/, '');
    if (clean.endsWith('/responses')) return clean;
    if (clean.endsWith('/chat/completions')) {
      return `${clean.slice(0, -'/chat/completions'.length)}/responses`;
    }
    return `${clean}/responses`;
  }

  private formatMessages(messages: ChatMessage[]): FormattedCodexMessages {
    const instructions: string[] = [];
    const input: CodexResponseItem[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        if (msg.content.trim()) instructions.push(msg.content);
        continue;
      }

      if (msg.role === 'user') {
        input.push({
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: msg.content }],
        });
        continue;
      }

      if (msg.role === 'assistant') {
        if (msg.content.trim()) {
          input.push({
            type: 'message',
            role: 'assistant',
            content: [{ type: 'output_text', text: msg.content }],
          });
        }

        for (const tc of msg.toolCalls || []) {
          input.push({
            type: 'function_call',
            name: tc.name,
            arguments: tc.arguments || '{}',
            call_id: tc.id,
          });
        }
        continue;
      }

      if (msg.role === 'tool' && msg.toolCallId) {
        input.push({
          type: 'function_call_output',
          call_id: msg.toolCallId,
          output: msg.isError
            ? `Tool ${msg.toolName || msg.toolCallId} failed:\n${msg.content}`
            : msg.content,
        });
      }
    }

    return {
      instructions: instructions.join('\n\n'),
      input,
    };
  }

  private formatTools(tools: Record<string, unknown>[]): Record<string, unknown>[] {
    return tools.map(tool => {
      const maybeFunction = (tool as any).function;
      if ((tool as any).type === 'function' && maybeFunction) {
        return {
          type: 'function',
          name: maybeFunction.name,
          description: maybeFunction.description || '',
          strict: false,
          parameters: maybeFunction.parameters || { type: 'object', properties: {} },
        };
      }
      return tool;
    });
  }

  private formatReasoning(reasoningEffort: string): Record<string, string> | undefined {
    if (reasoningEffort === 'off') return undefined;
    return {
      effort: reasoningEffort === 'max' ? 'high' : reasoningEffort,
      summary: 'auto',
    };
  }

  private async readResponsesStream(
    res: Response,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<StreamResult> {
    const reader = this.createReader(res);
    abortSignal?.addEventListener('abort', () => reader.cancel(), { once: true });

    const decoder = this.createDecoder();
    let buffer = '';
    let full = '';
    let reasoningFull = '';
    const reasoningDetails: ReasoningDetail[] = [];
    const blocks: ContentBlock[] = [];
    const toolCallsMap = new Map<string, ToolCall>();
    const detectedToolIds = new Set<string>();
    const customToolInputs = new Map<string, string>();

    const emitBlocks = () => callbacks?.onBlocks?.(blocks.map(b => ({ ...b })));

    const ensureTextBlock = (): ContentBlock => {
      let block = blocks.find(b => b.type === 'text');
      if (!block) {
        block = { type: 'text', content: '' };
        blocks.push(block);
      }
      return block;
    };

    const ensureThinkingBlock = (): ContentBlock => {
      let block = blocks.find(b => b.type === 'thinking');
      if (!block) {
        block = { type: 'thinking', content: '' };
        blocks.push(block);
      }
      return block;
    };

    const upsertToolCall = (id: string, name?: string, args?: string) => {
      if (!id) return;
      const existing = toolCallsMap.get(id) || { id, name: '', arguments: '' };
      if (name) existing.name = name;
      if (args !== undefined) existing.arguments = args;
      toolCallsMap.set(id, existing);

      if (existing.name && !detectedToolIds.has(id)) {
        detectedToolIds.add(id);
        callbacks?.onToolCallDetected?.({ id, name: existing.name });
      }

      if (existing.name && !blocks.some(b => b.type === 'tool_use' && b.id === id)) {
        blocks.push({
          type: 'tool_use',
          id,
          name: existing.name,
          content: existing.arguments,
        });
        emitBlocks();
      } else {
        const toolBlock = blocks.find(b => b.type === 'tool_use' && b.id === id);
        if (toolBlock) {
          toolBlock.name = existing.name || toolBlock.name;
          toolBlock.content = existing.arguments;
          emitBlocks();
        }
      }
    };

    const processEvent = (event: SseEvent) => {
      if (!event.data || event.data === '[DONE]') return;

      let json: any;
      try {
        json = JSON.parse(event.data);
      } catch {
        console.warn('[LineCode] Codex SSE invalid JSON event:', this.previewForLog(event.data, 200));
        return;
      }

      const eventType = event.event || json.type;
      console.log('[LineCode] Codex SSE event:', eventType);

      if (json.error) {
        throw new Error(`Codex 流式错误: ${this.describeErrorPayload(json.error)}`);
      }

      if (eventType === 'response.output_text.delta' && typeof json.delta === 'string') {
        full += json.delta;
        ensureTextBlock().content = full;
        emitBlocks();
        return;
      }

      if (
        (eventType === 'response.reasoning_summary_text.delta' ||
          eventType === 'response.reasoning_text.delta') &&
        typeof json.delta === 'string'
      ) {
        reasoningFull += json.delta;
        ensureThinkingBlock().content = reasoningFull;
        emitBlocks();
        return;
      }

      if (eventType === 'response.reasoning_summary_part.added' && reasoningFull) {
        reasoningFull += '\n';
        ensureThinkingBlock().content = reasoningFull;
        emitBlocks();
        return;
      }

      if (eventType === 'response.custom_tool_call_input.delta' && typeof json.delta === 'string') {
        const ids = [json.item_id, json.call_id]
          .map(value => typeof value === 'string' ? value : '')
          .filter(Boolean);
        for (const id of ids) {
          customToolInputs.set(id, (customToolInputs.get(id) || '') + json.delta);
        }
        return;
      }

      if (eventType === 'response.output_item.added' && json.item) {
        this.handleOutputItem(json.item, full, reasoningFull, upsertToolCall, customToolInputs, reasoningDetails);
        return;
      }

      if (eventType === 'response.completed' && Array.isArray(json.response?.output)) {
        for (const item of json.response.output) {
          const update = this.handleOutputItem(item, full, reasoningFull, upsertToolCall, customToolInputs, reasoningDetails);
          if (update.text !== undefined) {
            full = this.mergeFinalText(full, update.text);
            if (full) {
              ensureTextBlock().content = full;
              emitBlocks();
            }
          }
          if (update.reasoning !== undefined) {
            reasoningFull = this.mergeFinalText(reasoningFull, update.reasoning);
            if (reasoningFull) {
              ensureThinkingBlock().content = reasoningFull;
              emitBlocks();
            }
          }
        }
        return;
      }

      if (eventType === 'response.output_item.done' && json.item) {
        const update = this.handleOutputItem(json.item, full, reasoningFull, upsertToolCall, customToolInputs, reasoningDetails);
        if (update.text !== undefined) {
          full = this.mergeFinalText(full, update.text);
          if (full) {
            ensureTextBlock().content = full;
            emitBlocks();
          }
        }
        if (update.reasoning !== undefined) {
          reasoningFull = this.mergeFinalText(reasoningFull, update.reasoning);
          if (reasoningFull) {
            ensureThinkingBlock().content = reasoningFull;
            emitBlocks();
          }
        }
        return;
      }

      if (eventType === 'response.failed') {
        throw new Error(this.extractResponseError(json, 'Codex response.failed'));
      }

      if (eventType === 'response.incomplete') {
        const reason = json.response?.incomplete_details?.reason || 'unknown';
        throw new Error(`Codex response.incomplete: ${reason}`);
      }
    };

    try {
      while (true) {
        if (abortSignal?.aborted) break;

        const { done, value } = await this.readChunkWithTimeout(reader, 'Codex', abortSignal);
        if (done) break;

        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
        const parsed = this.drainSseEvents(buffer);
        buffer = parsed.rest;

        for (const event of parsed.events) {
          processEvent(event);
        }
      }

      const tail = this.drainSseEvents(`${buffer}\n\n`);
      for (const event of tail.events) {
        processEvent(event);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LineCode] Codex Stream aborted by user');
      } else {
        throw err;
      }
    }

    const toolCalls = Array.from(toolCallsMap.values())
      .filter(tc => tc.id && tc.name)
      .map(tc => ({ ...tc }));

    if (toolCalls.length > 0) {
      callbacks?.onToolCalls?.(toolCalls);
    }

    if (!abortSignal?.aborted && !full.trim() && !reasoningFull.trim() && toolCalls.length === 0) {
      throw new Error('Codex 响应结束但没有返回任何内容。请检查模型是否支持 Responses API、流式输出是否被代理截断，或切换到正确的 Base URL。');
    }

    return {
      text: full,
      blocks,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      reasoningContent: reasoningFull || undefined,
      reasoningDetails: reasoningDetails.length > 0 ? reasoningDetails : undefined,
    };
  }

  private drainSseEvents(buffer: string): { events: SseEvent[]; rest: string } {
    const events: SseEvent[] = [];
    let rest = buffer;
    let index = rest.indexOf('\n\n');

    while (index !== -1) {
      const raw = rest.slice(0, index);
      rest = rest.slice(index + 2);
      const event = this.parseSseEvent(raw);
      if (event) events.push(event);
      index = rest.indexOf('\n\n');
    }

    return { events, rest };
  }

  private parseSseEvent(raw: string): SseEvent | null {
    const lines = raw.split('\n');
    let event = '';
    const data: string[] = [];

    for (const line of lines) {
      if (line.startsWith('event:')) {
        event = line.slice('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        data.push(line.slice('data:'.length).replace(/^ /, ''));
      }
    }

    if (!event && data.length === 0) return null;
    return { event, data: data.join('\n') };
  }

  private handleOutputItem(
    item: any,
    currentText: string,
    currentReasoning: string,
    upsertToolCall: (id: string, name?: string, args?: string) => void,
    customToolInputs: Map<string, string>,
    reasoningDetails: ReasoningDetail[],
  ): { text?: string; reasoning?: string } {
    if (!item || typeof item !== 'object') return {};

    if (item.type === 'function_call') {
      upsertToolCall(
        String(item.call_id || item.id || ''),
        String(item.name || ''),
        typeof item.arguments === 'string' ? item.arguments : JSON.stringify(item.arguments || {}),
      );
      return {};
    }

    if (item.type === 'custom_tool_call') {
      const callId = String(item.call_id || item.id || '');
      const input = typeof item.input === 'string'
        ? item.input
        : customToolInputs.get(callId) || '';
      upsertToolCall(callId, String(item.name || ''), input);
      return {};
    }

    if (item.type === 'message') {
      const text = this.extractTextFromContent(item.content);
      return text && !currentText ? { text } : {};
    }

    if (item.type === 'reasoning') {
      reasoningDetails.push(item);
      const reasoning = this.extractReasoningText(item);
      return reasoning && !currentReasoning ? { reasoning } : {};
    }

    return {};
  }

  private extractTextFromContent(content: any): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
      .map(part => {
        if (typeof part === 'string') return part;
        if (typeof part?.text === 'string') return part.text;
        return '';
      })
      .join('');
  }

  private extractReasoningText(item: any): string {
    const rawContent = Array.isArray(item.content)
      ? item.content.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('\n')
      : '';
    if (rawContent.trim()) return rawContent;

    return Array.isArray(item.summary)
      ? item.summary.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('\n')
      : '';
  }

  private mergeFinalText(current: string, next: string): string {
    if (!next) return current;
    if (!current) return next;
    if (current === next) return current;
    if (next.startsWith(current)) return next;
    if (current.endsWith(next)) return current;
    return `${current}${next}`;
  }

  private extractResponseError(json: any, fallback: string): string {
    return json?.response?.error?.message ||
      json?.error?.message ||
      json?.error ||
      fallback;
  }
}

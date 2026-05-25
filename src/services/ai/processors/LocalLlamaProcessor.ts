import { Platform } from 'react-native';
import {
  getBackendDevicesInfo,
  initLlama,
  LlamaContext,
  NativeCompletionResult,
  RNLlamaOAICompatibleMessage,
  TokenData,
} from 'llama.rn';
import { Model, ContentBlock, ToolCall } from '../../../types';
import { ChatMessage, StreamCallbacks, StreamOptions, StreamProcessor, StreamResult } from './StreamProcessor';

const DEFAULT_N_CTX = 4096;
const DEFAULT_N_PREDICT = 2048;
const STOP_WORDS = [
  '</s>',
  '<|end|>',
  '<|eot_id|>',
  '<|end_of_text|>',
  '<|im_end|>',
  '<|EOT|>',
  '<|END_OF_TURN_TOKEN|>',
  '<|end_of_turn|>',
  '<|endoftext|>',
];
const THINK_START_TAG = '<think>';
const THINK_END_TAG = '</think>';

type LocalAcceleration = NonNullable<Model['localModel']>['acceleration'];

interface LoadedContext {
  key: string;
  context: LlamaContext;
  acceleration: 'cpu' | 'npu';
}

interface ThinkTagParseState {
  inThinking: boolean;
  pending: string;
  lastCumulativeContent: string;
}

interface ThinkTagParseResult {
  text: string;
  thinking: string;
  thinkingStarted: boolean;
  thinkingEnded: boolean;
}

export class LocalLlamaProcessor extends StreamProcessor {
  private loaded?: LoadedContext;

  async process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
    options?: StreamOptions,
  ): Promise<StreamResult> {
    const abortSignal = options?.abortSignal;
    if (abortSignal?.aborted) throw this.createLocalAbortError();

    const context = await this.getContext(model, callbacks, abortSignal);
    await context.clearCache(false).catch(() => {});

    const blocks: ContentBlock[] = [];
    const seenToolCalls = new Set<string>();
    const thinkState = this.createThinkTagParseState();
    let full = '';
    let reasoningFull = '';

    const removeAbortListener = this.bindAbort(abortSignal, () => {
      context.stopCompletion().catch(() => {});
    });

    try {
      const result = await context.completion({
        messages: this.formatMessages(messages) as RNLlamaOAICompatibleMessage[],
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        n_predict: DEFAULT_N_PREDICT,
        temperature: 0.7,
        top_p: 0.9,
        stop: STOP_WORDS,
        jinja: true,
      } as any, (data) => {
        if (abortSignal?.aborted) return;
        const partial = this.applyPartial(data, blocks, full, reasoningFull, thinkState);
        full = partial.full;
        reasoningFull = partial.reasoningFull;

        this.normalizeToolCalls(data.tool_calls).forEach(tc => {
          if (seenToolCalls.has(tc.id)) return;
          seenToolCalls.add(tc.id);
          callbacks?.onToolCallDetected?.({ id: tc.id, name: tc.name });
        });
        callbacks?.onBlocks?.(blocks.map(block => ({ ...block })));
      });

      if (abortSignal?.aborted || result.interrupted) throw this.createLocalAbortError();

      const flushed = this.flushThinkTagState(thinkState);
      if (flushed.thinking) {
        reasoningFull += flushed.thinking;
        const thinkingBlock = this.ensureBlock(blocks, 'thinking');
        thinkingBlock.content = reasoningFull;
      }
      if (flushed.text) {
        full += flushed.text;
        this.ensureBlock(blocks, 'text').content = full;
      }
      this.markThinkingDone(blocks);

      const final = this.resultToStreamResult(result, blocks, full, reasoningFull);
      return final;
    } finally {
      removeAbortListener();
    }
  }

  private async getContext(
    model: Model,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<LlamaContext> {
    const localModel = model.localModel;
    if (!localModel?.localPath) {
      throw new Error('本地模型缺少文件路径，请重新通过 SAF 选择 GGUF 模型文件。');
    }

    const nCtx = Math.max(512, localModel.nCtx || DEFAULT_N_CTX);
    const key = [
      localModel.localPath,
      localModel.acceleration,
      nCtx,
    ].join('|');

    if (this.loaded?.key === key) return this.loaded.context;

    if (this.loaded) {
      await this.loaded.context.release().catch(() => {});
      this.loaded = undefined;
    }

    callbacks?.onStatus?.('正在加载本地模型...');
    const loaded = await this.initContext(localModel.localPath, localModel.acceleration, nCtx, callbacks, abortSignal);
    this.loaded = { key, ...loaded };

    if (loaded.acceleration === 'npu') {
      callbacks?.onStatus?.(`本地模型已启用 NPU${loaded.context.devices?.length ? `: ${loaded.context.devices.join(', ')}` : ''}`);
    } else {
      callbacks?.onStatus?.('本地模型使用 CPU 推理');
    }

    return loaded.context;
  }

  private async initContext(
    localPath: string,
    acceleration: LocalAcceleration,
    nCtx: number,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<{ context: LlamaContext; acceleration: 'cpu' | 'npu' }> {
    const htpDevices = acceleration === 'cpu' ? [] : await this.getHtpDevices();
    const wantsNpu = Platform.OS === 'android' && acceleration !== 'cpu';

    if (wantsNpu && htpDevices.length > 0) {
      try {
        const context = await this.createContext(localPath, nCtx, htpDevices, callbacks, abortSignal);
        return { context, acceleration: 'npu' };
      } catch (err: any) {
        if (acceleration === 'npu') {
          throw new Error(`NPU 加载失败: ${err?.message || String(err)}`);
        }
        callbacks?.onStatus?.('NPU 不可用，正在回退 CPU...');
      }
    } else if (acceleration === 'npu') {
      throw new Error('当前设备没有可用的 Hexagon HTP NPU 后端。请切换为自动或 CPU。');
    }

    const context = await this.createContext(localPath, nCtx, undefined, callbacks, abortSignal);
    return { context, acceleration: 'cpu' };
  }

  private async createContext(
    localPath: string,
    nCtx: number,
    devices: string[] | undefined,
    callbacks?: StreamCallbacks,
    abortSignal?: AbortSignal,
  ): Promise<LlamaContext> {
    if (abortSignal?.aborted) throw this.createLocalAbortError();
    const useNpu = !!devices?.length;
    return initLlama({
      model: localPath,
      n_ctx: nCtx,
      n_batch: 512,
      n_ubatch: 128,
      n_gpu_layers: useNpu ? 99 : 0,
      devices,
      use_mlock: true,
      ctx_shift: true,
      flash_attn_type: useNpu ? 'auto' : 'off',
    }, progress => {
      if (abortSignal?.aborted) return;
      const percent = Math.max(0, Math.min(100, Math.round(progress)));
      callbacks?.onStatus?.(`正在加载本地模型 ${percent}%...`);
    });
  }

  private async getHtpDevices(): Promise<string[]> {
    if (Platform.OS !== 'android') return [];
    const devices = await getBackendDevicesInfo();
    return devices
      .map(device => device.deviceName)
      .filter(name => /^HTP/i.test(name));
  }

  private formatMessages(messages: ChatMessage[]): Record<string, unknown>[] {
    return messages.map(message => {
      if (message.role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: message.toolCallId,
          name: message.toolName,
          content: message.isError
            ? `Tool ${message.toolName || message.toolCallId || ''} failed:\n${message.content}`
            : message.content,
        };
      }
      if (message.role === 'assistant' && message.toolCalls?.length) {
        return {
          role: 'assistant',
          content: message.content || '',
          tool_calls: message.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: tc.arguments,
            },
          })),
          reasoning_content: message.reasoningContent,
        };
      }
      return {
        role: message.role,
        content: message.content,
        reasoning_content: message.role === 'assistant' ? message.reasoningContent : undefined,
      };
    });
  }

  private applyPartial(
    data: TokenData,
    blocks: ContentBlock[],
    full: string,
    reasoningFull: string,
    thinkState: ThinkTagParseState,
  ): { full: string; reasoningFull: string } {
    if (typeof data.reasoning_content === 'string') {
      reasoningFull = data.reasoning_content;
      const thinkingBlock = this.ensureBlock(blocks, 'thinking');
      thinkingBlock.content = reasoningFull;
      thinkingBlock.thinkingStatus = blocks.some(block => block.type === 'text') ? 'done' : 'running';
    }

    const delta = this.extractTextDelta(data, thinkState);
    if (delta) {
      const parsed = this.consumeThinkTaggedDelta(delta, thinkState);
      if (parsed.thinkingStarted) {
        this.ensureBlock(blocks, 'thinking').thinkingStatus = 'running';
      }
      if (parsed.thinking) {
        reasoningFull += parsed.thinking;
        const thinkingBlock = this.ensureBlock(blocks, 'thinking');
        thinkingBlock.content = reasoningFull;
        thinkingBlock.thinkingStatus = thinkState.inThinking ? 'running' : 'done';
      }
      if (parsed.thinkingEnded) {
        this.markThinkingDone(blocks);
      }
      if (parsed.text) {
        full += parsed.text;
        this.ensureBlock(blocks, 'text').content = full;
        if (!thinkState.inThinking) this.markThinkingDone(blocks);
      }
    }

    if (full) {
      this.ensureBlock(blocks, 'text').content = full;
    }

    return { full, reasoningFull };
  }

  private resultToStreamResult(
    result: NativeCompletionResult,
    blocks: ContentBlock[],
    partialText: string,
    partialReasoning: string,
  ): StreamResult {
    const rawText = result.content || result.text || '';
    const parsedResult = rawText ? this.parseCompleteThinkTaggedText(rawText) : { text: '', thinking: '' };
    const reasoningContent = result.reasoning_content || partialReasoning || parsedResult.thinking || undefined;
    const text = partialText || parsedResult.text || rawText;
    const finalBlocks: ContentBlock[] = [];

    if (reasoningContent) finalBlocks.push({ type: 'thinking', content: reasoningContent, thinkingStatus: 'done' });
    if (text) finalBlocks.push({ type: 'text', content: text });
    if (finalBlocks.length === 0) {
      finalBlocks.push(...blocks.map(block => block.type === 'thinking'
        ? { ...block, thinkingStatus: 'done' as const }
        : block));
    }

    const toolCalls = this.normalizeToolCalls(result.tool_calls);
    return {
      text,
      blocks: finalBlocks,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      reasoningContent,
    };
  }

  private normalizeToolCalls(toolCalls?: Array<{ id?: string; function: { name: string; arguments: string } }>): ToolCall[] {
    if (!toolCalls?.length) return [];
    return toolCalls
      .filter(tc => tc.function?.name)
      .map((tc, index) => ({
        id: tc.id || `local_tool_${Date.now()}_${index}`,
        name: tc.function.name,
        arguments: tc.function.arguments || '{}',
      }));
  }

  private ensureBlock(blocks: ContentBlock[], type: 'text' | 'thinking'): ContentBlock {
    let block = blocks.find(item => item.type === type);
    if (!block) {
      block = { type, content: '' };
      blocks.push(block);
    }
    return block;
  }

  private markThinkingDone(blocks: ContentBlock[]): void {
    blocks.forEach(block => {
      if (block.type === 'thinking') block.thinkingStatus = 'done';
    });
  }

  private createThinkTagParseState(): ThinkTagParseState {
    return {
      inThinking: false,
      pending: '',
      lastCumulativeContent: '',
    };
  }

  private extractTextDelta(data: TokenData, state: ThinkTagParseState): string {
    const token = typeof data.token === 'string' ? data.token : '';
    if (typeof data.content === 'string') {
      const previous = state.lastCumulativeContent;
      state.lastCumulativeContent = data.content;
      if (previous && data.content.startsWith(previous)) {
        return data.content.slice(previous.length);
      }
      return data.content === previous ? '' : data.content;
    }
    return token;
  }

  private consumeThinkTaggedDelta(delta: string, state: ThinkTagParseState): ThinkTagParseResult {
    let input = state.pending + delta;
    let text = '';
    let thinking = '';
    let thinkingStarted = false;
    let thinkingEnded = false;
    state.pending = '';

    while (input.length > 0) {
      const tag = state.inThinking ? THINK_END_TAG : THINK_START_TAG;
      const tagIndex = input.indexOf(tag);

      if (tagIndex >= 0) {
        const beforeTag = input.slice(0, tagIndex);
        if (state.inThinking) {
          thinking += beforeTag;
          state.inThinking = false;
          thinkingEnded = true;
        } else {
          text += beforeTag;
          state.inThinking = true;
          thinkingStarted = true;
        }
        input = input.slice(tagIndex + tag.length);
        continue;
      }

      const keepLength = this.longestTagPrefixSuffix(input, [tag]);
      const completeContent = keepLength > 0 ? input.slice(0, -keepLength) : input;
      state.pending = keepLength > 0 ? input.slice(-keepLength) : '';

      if (state.inThinking) {
        thinking += completeContent;
      } else {
        text += completeContent;
      }
      break;
    }

    return { text, thinking, thinkingStarted, thinkingEnded };
  }

  private flushThinkTagState(state: ThinkTagParseState): { text: string; thinking: string } {
    const pending = state.pending;
    state.pending = '';
    return state.inThinking
      ? { text: '', thinking: pending }
      : { text: pending, thinking: '' };
  }

  private parseCompleteThinkTaggedText(content: string): { text: string; thinking: string } {
    const state = this.createThinkTagParseState();
    const parsed = this.consumeThinkTaggedDelta(content, state);
    const flushed = this.flushThinkTagState(state);
    return {
      text: parsed.text + flushed.text,
      thinking: parsed.thinking + flushed.thinking,
    };
  }

  private longestTagPrefixSuffix(value: string, tags: string[]): number {
    const maxLength = Math.min(value.length, Math.max(...tags.map(tag => tag.length - 1)));
    for (let length = maxLength; length > 0; length -= 1) {
      const suffix = value.slice(-length);
      if (tags.some(tag => tag.startsWith(suffix))) return length;
    }
    return 0;
  }

  private bindAbort(abortSignal: AbortSignal | undefined, onAbort: () => void): () => void {
    if (!abortSignal) return () => {};
    abortSignal.addEventListener('abort', onAbort, { once: true });
    return () => abortSignal.removeEventListener('abort', onAbort);
  }

  private createLocalAbortError(): Error {
    const err = new Error('请求已取消');
    err.name = 'AbortError';
    return err;
  }
}

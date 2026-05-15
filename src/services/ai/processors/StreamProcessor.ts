import { Model, ContentBlock, ToolCall, ReasoningDetail, InputAttachment } from '../../../types';
import { ReasoningEffort } from '../../settings';

export interface StreamCallbacks {
  onBlocks?: (blocks: ContentBlock[]) => void;
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  onToolCallDetected?: (toolCall: { id: string; name: string }) => void;
  onStatus?: (status: string) => void;
}

export interface StreamOptions {
  reasoningEffort?: ReasoningEffort;
  preserveReasoning?: boolean;
  abortSignal?: AbortSignal;
}

export interface StreamResult {
  text: string;
  blocks: ContentBlock[];
  toolCalls?: ToolCall[];
  reasoningContent?: string;
  reasoningDetails?: ReasoningDetail[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  attachments?: InputAttachment[];
  toolCallId?: string;
  toolName?: string;
  isError?: boolean;
  toolCalls?: ToolCall[];
  reasoningContent?: string;
  reasoningDetails?: ReasoningDetail[];
}

interface FetchWithRetryOptions {
  providerName: string;
  requestUrl: string;
  init: RequestInit;
  abortSignal?: AbortSignal;
  callbacks?: StreamCallbacks;
  maxAttempts?: number;
  timeoutMs?: number;
  retryDelayMs?: number;
  networkHint: string;
  httpHint: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_FETCH_TIMEOUT_MS = 45_000;
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 90_000;
const RETRYABLE_HTTP_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

class ApiHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiHttpError';
  }
}

export abstract class StreamProcessor {
  abstract process(
    model: Model,
    messages: ChatMessage[],
    tools: Record<string, unknown>[],
    callbacks?: StreamCallbacks,
    options?: StreamOptions,
  ): Promise<StreamResult>;

  protected createReader(res: Response): ReadableStreamDefaultReader<Uint8Array> {
    const reader = (res as any).body?.getReader();
    if (!reader) throw new Error('No response body');
    return reader;
  }

  protected createDecoder(): TextDecoder {
    return new (globalThis as any).TextDecoder();
  }

  protected async fetchWithRetry({
    providerName,
    requestUrl,
    init,
    abortSignal,
    callbacks,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    retryDelayMs,
    networkHint,
    httpHint,
  }: FetchWithRetryOptions): Promise<Response> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let timedOut = false;
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      if (abortSignal) {
        if (abortSignal.aborted) {
          clearTimeout(timeout);
          throw this.createAbortError();
        }
        abortSignal.addEventListener('abort', onAbort, { once: true });
      }

      try {
        const res = await fetch(requestUrl, {
          ...init,
          signal: controller.signal,
        });

        clearTimeout(timeout);
        abortSignal?.removeEventListener('abort', onAbort);

        if (res.ok) return res;

        const rawText = await this.safeReadText(res);
        const retryable = RETRYABLE_HTTP_STATUSES.has(res.status);
        if (retryable && attempt < maxAttempts && !abortSignal?.aborted) {
          callbacks?.onStatus?.(`${providerName} HTTP ${res.status}，正在重试 ${attempt + 1}/${maxAttempts}...`);
          await this.sleep(retryDelayMs ?? this.retryDelayMs(attempt, res), abortSignal);
          continue;
        }

        throw new ApiHttpError(
          `${providerName} ${res.status}: ${this.extractApiErrorText(rawText) || res.statusText || '请求失败'}\n\n` +
          `请求地址: ${requestUrl}\n` +
          `已尝试: ${attempt}/${maxAttempts}\n` +
          `提示: ${httpHint}`
        );
      } catch (err: any) {
        clearTimeout(timeout);
        abortSignal?.removeEventListener('abort', onAbort);

        if (abortSignal?.aborted || err?.name === 'AbortError' && !timedOut) {
          throw this.createAbortError();
        }
        if (err instanceof ApiHttpError) throw err;

        lastError = timedOut
          ? new Error(`${providerName} 请求超时: ${Math.round(timeoutMs / 1000)} 秒内没有收到响应头`)
          : err;

        if (attempt < maxAttempts) {
          callbacks?.onStatus?.(`${providerName} 网络请求失败，正在重试 ${attempt + 1}/${maxAttempts}...`);
          await this.sleep(retryDelayMs ?? this.retryDelayMs(attempt), abortSignal);
          continue;
        }

        const message = lastError instanceof Error ? lastError.message : String(lastError);
        throw new Error(
          `${providerName} 网络请求失败（已尝试 ${attempt}/${maxAttempts}）: ${message}\n\n` +
          `请求地址: ${requestUrl}\n` +
          `提示: ${networkHint}`
        );
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError || '请求失败'));
  }

  protected async readChunkWithTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    providerName: string,
    abortSignal?: AbortSignal,
    timeoutMs = DEFAULT_STREAM_IDLE_TIMEOUT_MS,
  ): Promise<ReadableStreamReadResult<Uint8Array>> {
    if (abortSignal?.aborted) throw this.createAbortError();

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        abortSignal?.removeEventListener('abort', onAbort);
        fn();
      };
      const onAbort = () => {
        reader.cancel().catch(() => {});
        finish(() => reject(this.createAbortError()));
      };
      const timeout = setTimeout(() => {
        reader.cancel().catch(() => {});
        finish(() => reject(new Error(
          `${providerName} 流式响应超时: ${Math.round(timeoutMs / 1000)} 秒内没有收到新数据，请检查网络或服务端是否卡住。`
        )));
      }, timeoutMs);

      abortSignal?.addEventListener('abort', onAbort, { once: true });
      reader.read().then(
        value => finish(() => resolve(value)),
        error => finish(() => reject(error)),
      );
    });
  }

  protected describeErrorPayload(payload: any): string {
    if (!payload) return '未知错误';
    if (typeof payload === 'string') return payload;
    if (typeof payload.message === 'string') return payload.message;
    if (typeof payload.error?.message === 'string') return payload.error.message;
    if (typeof payload.error === 'string') return payload.error;
    try {
      return JSON.stringify(payload);
    } catch {
      return String(payload);
    }
  }

  protected previewForLog(value: unknown, maxLength: number, space?: number): string {
    if (typeof value === 'string') return value.slice(0, maxLength);
    try {
      const serialized = JSON.stringify(value, null, space);
      if (typeof serialized === 'string') return serialized.slice(0, maxLength);
    } catch {
      // Fall through to String() for circular or otherwise unserializable values.
    }
    return String(value).slice(0, maxLength);
  }

  private extractApiErrorText(rawText: string): string {
    if (!rawText) return '';
    try {
      const json = JSON.parse(rawText);
      return this.describeErrorPayload(json);
    } catch {
      return rawText;
    }
  }

  private async safeReadText(res: Response): Promise<string> {
    try {
      return await res.text();
    } catch {
      return '';
    }
  }

  private retryDelayMs(attempt: number, res?: Response): number {
    const retryAfter = res?.headers?.get?.('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.min(30_000, Math.max(0, seconds * 1000));
      const dateMs = Date.parse(retryAfter);
      if (Number.isFinite(dateMs)) return Math.min(30_000, Math.max(0, dateMs - Date.now()));
    }
    return Math.min(10_000, 800 * (2 ** (attempt - 1))) + Math.floor(Math.random() * 250);
  }

  private sleep(ms: number, abortSignal?: AbortSignal): Promise<void> {
    if (abortSignal?.aborted) return Promise.reject(this.createAbortError());
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        abortSignal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timeout);
        reject(this.createAbortError());
      };
      abortSignal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  private createAbortError(): Error {
    const err = new Error('请求已取消');
    err.name = 'AbortError';
    return err;
  }
}

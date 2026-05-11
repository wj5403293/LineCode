import { Model, ContentBlock, ToolCall } from '../../../types';
import { ReasoningEffort } from '../../settings';

export interface StreamCallbacks {
  onBlocks?: (blocks: ContentBlock[]) => void;
  onToolCalls?: (toolCalls: ToolCall[]) => void;
  onToolCallDetected?: (toolCall: { id: string; name: string }) => void;
}

export interface StreamOptions {
  reasoningEffort?: ReasoningEffort;
  abortSignal?: AbortSignal;
}

export interface StreamResult {
  text: string;
  blocks: ContentBlock[];
  toolCalls?: ToolCall[];
  reasoningContent?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolCalls?: ToolCall[];
  reasoningContent?: string;
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
}

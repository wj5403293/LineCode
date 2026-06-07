import { Message } from '../types';
import { estimateMessageTokens } from '../services/contextCompaction';

type TokenMessage = Pick<Message, 'id' | 'content' | 'attachments' | 'reasoningContent' | 'toolCalls' | 'toolResults' | 'blocks' | 'excludeFromContext'>;
const SIGNATURE_DEPTH_LIMIT = 8;

function structuredLength(value: unknown, depth = 0): number {
  if (value == null) return 0;
  if (typeof value === 'string') return value.length;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).length;
  if (depth >= SIGNATURE_DEPTH_LIMIT) return 0;

  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + structuredLength(item, depth + 1), 0);
  }

  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).reduce(
      (total, [key, item]) => total + key.length + structuredLength(item, depth + 1),
      0,
    );
  }

  return 0;
}

function messageSignature(message: TokenMessage): string {
  return [
    message.id,
    message.content?.length || 0,
    message.reasoningContent?.length || 0,
    structuredLength(message.attachments),
    structuredLength(message.toolCalls),
    structuredLength(message.toolResults),
    structuredLength(message.blocks),
    message.excludeFromContext ? 1 : 0,
  ].join(':');
}

export class ContextMetricsService {
  private cache = new Map<string, { signature: string; tokens: number }>();

  estimateContextTokens(messages: TokenMessage[]): number {
    let total = 0;
    const seen = new Set<string>();

    for (const message of messages) {
      seen.add(message.id);
      if (message.excludeFromContext) continue;

      const signature = messageSignature(message);
      const cached = this.cache.get(message.id);
      if (cached?.signature === signature) {
        total += cached.tokens;
        continue;
      }

      const tokens = estimateMessageTokens([message]);
      this.cache.set(message.id, { signature, tokens });
      total += tokens;
    }

    for (const id of this.cache.keys()) {
      if (!seen.has(id)) {
        this.cache.delete(id);
      }
    }

    return total;
  }

  shouldCompact(messages: Message[], contextTokens: number, triggerRatio: number): boolean {
    return this.estimateContextTokens(messages) >= contextTokens * triggerRatio;
  }

  clear() {
    this.cache.clear();
  }
}

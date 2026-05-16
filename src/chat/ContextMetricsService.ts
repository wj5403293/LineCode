import { Message } from '../types';
import { estimateMessageTokens } from '../services/contextCompaction';

type TokenMessage = Pick<Message, 'id' | 'content' | 'attachments' | 'reasoningContent' | 'toolCalls' | 'toolResults' | 'blocks' | 'excludeFromContext'>;

function messageSignature(message: TokenMessage): string {
  return [
    message.id,
    message.content?.length || 0,
    message.reasoningContent?.length || 0,
    message.attachments?.reduce((total, item) => total + item.name.length + item.path.length + item.source.length, 0) || 0,
    message.toolCalls?.reduce((total, item) => total + item.id.length + item.name.length + item.arguments.length, 0) || 0,
    message.toolResults?.reduce((total, item) => total + item.toolCallId.length + item.content.length + (item.diffId?.length || 0), 0) || 0,
    message.blocks?.reduce((total, item) => total + item.type.length + item.content.length + (item.id?.length || 0) + (item.name?.length || 0), 0) || 0,
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
    if (messages.length < 4) return false;
    return this.estimateContextTokens(messages) >= contextTokens * triggerRatio;
  }
}

import { MessageRole } from '../../types';
import { EvolutionDatabase } from './EvolutionDatabase';
import { ConversationIndexEntry, ConversationIndexMessage } from './types';

const INDEXABLE_ROLES = new Set<MessageRole>(['user', 'assistant']);
const MAX_INDEX_TEXT_LENGTH = 4000;

function entryId(conversationId: string, messageId: string | undefined, role: MessageRole, index: number): string {
  return `${conversationId}:${messageId || `${role}_${index}`}`;
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_INDEX_TEXT_LENGTH);
}

export class ConversationIndexer {
  constructor(private readonly database: EvolutionDatabase) {}

  async indexConversation(options: {
    projectId?: string;
    conversationId: string;
    title?: string;
    messages: ConversationIndexMessage[];
  }): Promise<void> {
    const entries: ConversationIndexEntry[] = [];
    const now = Date.now();
    options.messages.forEach((message, index) => {
      if (!INDEXABLE_ROLES.has(message.role)) return;
      const text = normalizeText(message.content);
      if (!text) return;
      const timestamp = message.timestamp || now;
      entries.push({
        id: entryId(options.conversationId, message.id, message.role, index),
        projectId: options.projectId,
        conversationId: options.conversationId,
        messageId: message.id,
        role: message.role,
        text,
        title: options.title,
        createdAt: timestamp,
        updatedAt: now,
      });
    });
    await this.database.upsertConversationEntries(entries);
  }
}

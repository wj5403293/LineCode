import { Message } from '../../types';
import { conversationStore } from '../../services/conversation';
import { sanitizeMessagesForStorage } from '../../utils/toolPayload';

const DEFAULT_DEBOUNCE_MS = 1200;

function sameMessageSnapshot(first?: Message[], second?: Message[]): boolean {
  if (!first || !second || first.length !== second.length) return false;
  return first.every((message, index) => message === second[index]);
}

export class ConversationPersistenceScheduler {
  private conversationId: string | null = null;
  private pendingMessages: Message[] | null = null;
  private lastPersistedMessagesByConversation = new Map<string, Message[]>();
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private flushPromise: Promise<void> = Promise.resolve();

  constructor(private readonly debounceMs = DEFAULT_DEBOUNCE_MS) {}

  setConversationId(conversationId: string | null) {
    if (this.conversationId === conversationId) return;
    this.clearTimer();
    this.conversationId = conversationId;
    this.pendingMessages = null;
  }

  markPersisted(messages: Message[], conversationId = this.conversationId) {
    if (!conversationId) return;
    this.pendingMessages = null;
    this.lastPersistedMessagesByConversation.set(conversationId, messages);
  }

  schedule(messages: Message[], conversationId = this.conversationId) {
    if (!conversationId || messages.length === 0) return;
    this.conversationId = conversationId;
    this.pendingMessages = messages;
    this.clearTimer();
    this.timeout = setTimeout(() => {
      this.flush().catch(() => {});
    }, this.debounceMs);
  }

  async flush(conversationId = this.conversationId): Promise<void> {
    this.clearTimer();
    const messages = this.pendingMessages;
    if (!conversationId || !messages || messages.length === 0) return this.flushPromise;

    this.pendingMessages = null;
    if (sameMessageSnapshot(this.lastPersistedMessagesByConversation.get(conversationId), messages)) {
      return this.flushPromise;
    }

    this.flushPromise = this.flushPromise
      .catch(() => {})
      .then(async () => {
        const sanitizedMessages = sanitizeMessagesForStorage(messages);
        await conversationStore.updateConversation(conversationId, { messages: sanitizedMessages });
        this.lastPersistedMessagesByConversation.set(conversationId, messages);
      });

    return this.flushPromise;
  }

  cancel() {
    this.clearTimer();
    this.pendingMessages = null;
  }

  private clearTimer() {
    if (!this.timeout) return;
    clearTimeout(this.timeout);
    this.timeout = null;
  }
}

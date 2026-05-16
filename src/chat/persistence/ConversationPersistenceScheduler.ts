import { Message } from '../../types';
import { conversationStore } from '../../services/conversation';

const DEFAULT_DEBOUNCE_MS = 1200;

export class ConversationPersistenceScheduler {
  private conversationId: string | null = null;
  private pendingMessages: Message[] | null = null;
  private lastPersistedJsonByConversation = new Map<string, string>();
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
    this.lastPersistedJsonByConversation.set(conversationId, JSON.stringify(messages));
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
    this.flushPromise = this.flushPromise
      .catch(() => {})
      .then(async () => {
        const json = JSON.stringify(messages);
        if (this.lastPersistedJsonByConversation.get(conversationId) === json) return;
        await conversationStore.updateConversation(conversationId, { messages });
        this.lastPersistedJsonByConversation.set(conversationId, json);
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

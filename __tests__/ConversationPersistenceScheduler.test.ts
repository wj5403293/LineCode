import { conversationStore } from '../src/services/conversation';
import { ConversationPersistenceScheduler } from '../src/chat/persistence/ConversationPersistenceScheduler';
import { Message } from '../src/types';

jest.mock('../src/services/conversation', () => ({
  conversationStore: {
    updateConversation: jest.fn(() => Promise.resolve()),
  },
}));

function messages(content: string): Message[] {
  return [{
    id: content,
    role: 'assistant',
    content,
    timestamp: 1,
  }];
}

describe('ConversationPersistenceScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces repeated schedules into the latest write', async () => {
    const scheduler = new ConversationPersistenceScheduler(100);
    scheduler.setConversationId('conv');

    scheduler.schedule(messages('first'));
    scheduler.schedule(messages('second'));
    jest.advanceTimersByTime(100);
    await scheduler.flush();

    expect(conversationStore.updateConversation).toHaveBeenCalledTimes(1);
    expect(conversationStore.updateConversation).toHaveBeenCalledWith('conv', {
      messages: messages('second'),
    });
  });

  it('skips unchanged flushed payloads', async () => {
    const scheduler = new ConversationPersistenceScheduler(100);
    scheduler.setConversationId('conv');
    const payload = messages('same');

    scheduler.schedule(payload);
    await scheduler.flush();
    scheduler.schedule(payload);
    await scheduler.flush();

    expect(conversationStore.updateConversation).toHaveBeenCalledTimes(1);
  });

  it('tracks persisted snapshots per conversation', async () => {
    const scheduler = new ConversationPersistenceScheduler(100);
    const firstPayload = messages('same');
    const secondPayload = messages('same');

    scheduler.setConversationId('first');
    scheduler.schedule(firstPayload);
    await scheduler.flush();

    scheduler.setConversationId('second');
    scheduler.schedule(secondPayload);
    await scheduler.flush();

    expect(conversationStore.updateConversation).toHaveBeenCalledTimes(2);
    expect(conversationStore.updateConversation).toHaveBeenNthCalledWith(1, 'first', { messages: firstPayload });
    expect(conversationStore.updateConversation).toHaveBeenNthCalledWith(2, 'second', { messages: secondPayload });
  });
});

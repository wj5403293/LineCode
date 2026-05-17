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

function longText(length: number): string {
  return 'x'.repeat(length);
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

  it('summarizes oversized tool and shell payloads before persistence', async () => {
    const scheduler = new ConversationPersistenceScheduler(100);
    scheduler.setConversationId('conv');
    const payload: Message[] = [{
      id: 'assistant',
      role: 'assistant',
      content: '',
      timestamp: 1,
      toolResults: [{
        toolCallId: 'tool-1',
        content: longText(160 * 1024),
      }],
      blocks: [{
        type: 'tool_use',
        id: 'shell-1',
        name: 'shell_execute',
        content: '{}',
        shellStatus: 'running',
        shellOutput: longText(160 * 1024),
      }],
    }];

    scheduler.schedule(payload);
    await scheduler.flush();

    const [, saved] = (conversationStore.updateConversation as jest.Mock).mock.calls[0];
    const json = JSON.stringify(saved.messages);
    expect(json).not.toContain(longText(32 * 1024));
    expect(json).toContain('完整内容未写入会话存储');
    expect(json).toContain('shell 输出');
  });
});

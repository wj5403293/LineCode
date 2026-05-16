import { MessageListStore } from '../src/chat/MessageListStore';
import { Message } from '../src/types';

function message(id: string, hidden = false): Message {
  return {
    id,
    role: 'assistant',
    content: id,
    timestamp: Number(id) || 1,
    hidden,
  };
}

describe('MessageListStore', () => {
  it('updates only targeted messages by id', () => {
    const first = message('1');
    const second = message('2');
    const store = new MessageListStore([first, second]);

    const next = store.updateById('2', item => ({ ...item, content: 'updated' }));

    expect(next[0]).toBe(first);
    expect(next[1]).not.toBe(second);
    expect(next[1].content).toBe('updated');
  });

  it('memoizes visible message snapshots until messages change', () => {
    const store = new MessageListStore([message('1'), message('2', true)]);

    const firstVisible = store.getVisibleMessages();
    const secondVisible = store.getVisibleMessages();
    expect(secondVisible).toBe(firstVisible);
    expect(firstVisible.map(item => item.id)).toEqual(['1']);

    store.append(message('3'));
    const nextVisible = store.getVisibleMessages();
    expect(nextVisible).not.toBe(firstVisible);
    expect(nextVisible.map(item => item.id)).toEqual(['1', '3']);
  });
});

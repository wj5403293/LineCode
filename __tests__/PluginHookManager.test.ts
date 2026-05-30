import { chatHookManager, createHookManager } from '../src/plugins';

describe('Host plugin hook manager', () => {
  beforeEach(() => {
    chatHookManager.clear();
  });

  it('runs chat.send hooks before original send and supports super chaining', async () => {
    const manager = createHookManager();
    manager.register('chat.send', async event => {
      event.text = `[prefix] ${event.text}`;
      return event.super();
    });

    const result = await manager.invoke(
      'chat.send',
      { text: 'hello', attachments: [] },
      async event => `sent:${event.text}`,
    );

    expect(result).toBe('sent:[prefix] hello');
  });

  it('allows hooks to cancel chat.send by not calling super', async () => {
    const manager = createHookManager();
    manager.register('chat.send', async () => ({ cancelled: true }));

    const original = jest.fn(async () => ({ cancelled: false }));
    const result = await manager.invoke('chat.send', { text: 'hello' }, original);

    expect(result).toEqual({ cancelled: true });
    expect(original).not.toHaveBeenCalled();
  });

  it('orders multiple hooks as an around chain', async () => {
    const manager = createHookManager();
    const calls: string[] = [];

    manager.register('chat.send', async event => {
      calls.push('a:before');
      event.text += 'A';
      const result = await event.super();
      calls.push('a:after');
      return `${result}:A`;
    });
    manager.register('chat.send', async event => {
      calls.push('b:before');
      event.text += 'B';
      const result = await event.super();
      calls.push('b:after');
      return `${result}:B`;
    });

    const result = await manager.invoke(
      'chat.send',
      { text: '' },
      async event => {
        calls.push('original');
        return event.text;
      },
    );

    expect(result).toBe('AB:B:A');
    expect(calls).toEqual(['a:before', 'b:before', 'original', 'b:after', 'a:after']);
  });
});

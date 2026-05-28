import {
  buildRequestFailedText,
  markMessageRequestFailed,
  markMessagesTerminated,
} from '../src/chat/messageLifecycle';
import { Message } from '../src/types';

describe('chat message lifecycle helpers', () => {
  it('marks streaming messages and pending tool calls as terminated', () => {
    const messages: Message[] = [{
      id: 'assistant',
      role: 'assistant',
      content: '',
      timestamp: 1,
      streaming: true,
      toolCalls: [{ id: 'tool-1', name: 'file_read', arguments: '{}' }],
      blocks: [{
        type: 'tool_use',
        id: 'agent-1',
        name: 'agent',
        content: '{}',
        agentStatus: 'running',
        agentItems: [{
          id: 'agent-item',
          name: 'Explore',
          type: 'explore',
          status: 'running',
        }],
      }],
    }];

    const [terminated] = markMessagesTerminated(messages);

    expect(terminated.streaming).toBe(false);
    expect(terminated.toolResults).toEqual(expect.arrayContaining([
      expect.objectContaining({ toolCallId: 'tool-1', content: '已终止', isError: true }),
    ]));
    expect(terminated.blocks?.[0]).toEqual(expect.objectContaining({
      agentStatus: 'error',
      agentOutput: '已终止',
      waitingForUnlock: undefined,
    }));
  });

  it('appends request errors to block-backed assistant messages', () => {
    const message: Message = {
      id: 'assistant',
      role: 'assistant',
      content: 'partial',
      timestamp: 1,
      streaming: true,
      blocks: [{ type: 'text', content: 'partial' }],
    };

    const next = markMessageRequestFailed(message, buildRequestFailedText(new Error('network down')));

    expect(next.streaming).toBe(false);
    expect(next.isError).toBe(true);
    expect(next.content).toContain('partial');
    expect(next.content).toContain('network down');
    expect(next.blocks?.at(-1)?.content).toContain('network down');
  });
});

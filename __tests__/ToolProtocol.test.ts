import { normalizeToolProtocolMessages } from '../src/services/ai/toolProtocol';
import { ChatMessage } from '../src/services/ai/processors/StreamProcessor';

describe('normalizeToolProtocolMessages', () => {
  it('keeps one adjacent tool result for each assistant tool call', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'inspect files' },
      { role: 'tool', toolCallId: 'orphan', content: 'orphan result' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call_a', name: 'file_read', arguments: '{"file_path":"a"}' },
          { id: 'call_b', name: 'file_read', arguments: '{"file_path":"b"}' },
          { id: 'call_a', name: 'file_read', arguments: '{"file_path":"a"}' },
        ],
      },
      { role: 'tool', toolCallId: 'call_a', toolName: 'file_read', content: 'A' },
      { role: 'tool', toolCallId: 'call_a', toolName: 'file_read', content: 'A duplicate' },
      { role: 'tool', toolCallId: 'call_b', toolName: 'file_read', content: 'B' },
    ];

    expect(normalizeToolProtocolMessages(messages)).toEqual([
      { role: 'user', content: 'inspect files' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call_a', name: 'file_read', arguments: '{"file_path":"a"}' },
          { id: 'call_b', name: 'file_read', arguments: '{"file_path":"b"}' },
        ],
      },
      { role: 'tool', toolCallId: 'call_a', toolName: 'file_read', content: 'A' },
      { role: 'tool', toolCallId: 'call_b', toolName: 'file_read', content: 'B' },
    ]);
  });

  it('drops incomplete tool-call exchanges before provider formatting', () => {
    const messages: ChatMessage[] = [
      { role: 'user', content: 'inspect files' },
      {
        role: 'assistant',
        content: 'I will inspect the file.',
        toolCalls: [{ id: 'call_a', name: 'file_read', arguments: '{}' }],
      },
    ];

    expect(normalizeToolProtocolMessages(messages)).toEqual([
      { role: 'user', content: 'inspect files' },
      { role: 'assistant', content: 'I will inspect the file.', toolCalls: undefined },
    ]);
  });
});

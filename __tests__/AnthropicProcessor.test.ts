import { AnthropicStreamProcessor } from '../src/services/ai/processors/AnthropicProcessor';

describe('AnthropicStreamProcessor message formatting', () => {
  const processor = new AnthropicStreamProcessor() as any;

  it('replays signed thinking before tool_use and groups tool results', () => {
    const formatted = processor.formatMessages([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'list files' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'toolu_1', name: 'file_read', arguments: '{"file_path":"README.md"}' }],
        reasoningDetails: [
          { type: 'thinking', thinking: 'Need to inspect the file.', signature: 'sig-1' },
        ],
      },
      { role: 'tool', toolCallId: 'toolu_1', content: 'README content' },
    ], { includeThinking: true, preserveReasoning: false });

    expect(formatted.system).toBe('system prompt');
    expect(formatted.messages).toEqual([
      { role: 'user', content: 'list files' },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'Need to inspect the file.', signature: 'sig-1' },
          {
            type: 'tool_use',
            id: 'toolu_1',
            name: 'file_read',
            input: { file_path: 'README.md' },
          },
        ],
      },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'toolu_1', content: 'README content' },
        ],
      },
    ]);
  });

  it('detects old unsigned tool-use thinking as unsafe to replay', () => {
    expect(processor.hasUnreplayableToolThinking([
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'toolu_1', name: 'file_read', arguments: '{}' }],
        reasoningContent: 'Unsigned thinking from older app versions.',
      },
    ])).toBe(true);

    expect(processor.hasUnreplayableToolThinking([
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'toolu_1', name: 'file_read', arguments: '{}' }],
        reasoningDetails: [{ type: 'thinking', thinking: 'Signed thinking.', signature: 'sig-1' }],
      },
    ])).toBe(false);
  });
});

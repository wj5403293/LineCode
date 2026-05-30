import { CodexStreamProcessor } from '../src/services/ai/processors/CodexProcessor';
import { ChatMessage } from '../src/services/ai/processors/StreamProcessor';

describe('CodexStreamProcessor message formatting', () => {
  const processor = new CodexStreamProcessor() as any;

  const toolExchange: ChatMessage[] = [
    { role: 'system', content: 'system prompt' },
    { role: 'user', content: 'read a file' },
    {
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call_1', name: 'file_read', arguments: '{"file_path":"README.md"}' }],
    },
    { role: 'tool', toolCallId: 'call_1', toolName: 'file_read', content: 'README content' },
  ];

  it('formats full Responses item history without chat role tool messages', () => {
    const formatted = processor.formatMessages(toolExchange);

    expect(formatted.instructions).toBe('system prompt');
    expect(formatted.input).toEqual([
      {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: 'read a file' }],
      },
      {
        type: 'function_call',
        name: 'file_read',
        arguments: '{"file_path":"README.md"}',
        call_id: 'call_1',
      },
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: 'README content',
      },
    ]);
  });

  it('uses only trailing tool outputs for turn-state continuation', () => {
    expect(processor.getToolContinuationOutputs(toolExchange)).toEqual([
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: 'README content',
      },
    ]);
  });

  it('does not continue turn-state when tool outputs are incomplete', () => {
    expect(processor.getToolContinuationOutputs(toolExchange.slice(0, -1))).toEqual([]);
  });
});

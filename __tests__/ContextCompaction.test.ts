import { estimateMessageTokens } from '../src/services/contextCompaction';

describe('context compaction token estimation', () => {
  it('estimates structured message fields without JSON serialization', () => {
    const stringifySpy = jest.spyOn(JSON, 'stringify');
    const tokens = estimateMessageTokens([{
      content: 'hello',
      reasoningContent: 'thinking',
      attachments: [{ name: 'file.ts', path: '/tmp/file.ts', source: 'local' }],
      toolCalls: [{ id: 'call-1', name: 'file_write', arguments: '{"content":"large"}' }],
      toolResults: [{ toolCallId: 'call-1', content: 'result'.repeat(1024) }],
      blocks: [{
        type: 'tool_use',
        id: 'call-1',
        name: 'shell_execute',
        content: '{}',
        shellOutput: 'output'.repeat(1024),
      }],
    }]);

    expect(tokens).toBeGreaterThan(0);
    expect(stringifySpy).not.toHaveBeenCalled();
    stringifySpy.mockRestore();
  });
});

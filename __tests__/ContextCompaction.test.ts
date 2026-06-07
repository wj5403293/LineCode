import {
  COMPACT_TRIGGER_RATIO,
  estimateMessageTokens,
  shouldCompactContext,
} from '../src/services/contextCompaction';

describe('context compaction token estimation', () => {
  it('triggers automatic compaction at 80% context usage', () => {
    expect(COMPACT_TRIGGER_RATIO).toBe(0.8);
  });

  it('allows compaction for a small number of oversized messages', () => {
    expect(shouldCompactContext([{
      id: 'large',
      role: 'assistant',
      content: 'x'.repeat(321),
      timestamp: 1,
    }], 100)).toBe(true);
  });

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

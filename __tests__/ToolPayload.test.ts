import { sanitizeMessagesForStorage, sanitizeToolCallForStorage } from '../src/utils/toolPayload';
import { Message, ToolCall } from '../src/types';

describe('tool payload sanitization', () => {
  it('summarizes large file_write content in tool call arguments', () => {
    const largeContent = 'x'.repeat(80 * 1024);
    const toolCall: ToolCall = {
      id: 'tc_1',
      name: 'file_write',
      arguments: JSON.stringify({ file_path: 'big.txt', content: largeContent }),
    };

    const sanitized = sanitizeToolCallForStorage(toolCall);
    const input = JSON.parse(sanitized.arguments);

    expect(input.file_path).toBe('big.txt');
    expect(input.contentOmitted).toBe(true);
    expect(input.originalContentLength).toBe(largeContent.length);
    expect(sanitized.arguments.length).toBeLessThan(4096);
  });

  it('sanitizes tool calls inside messages before persistence', () => {
    const largeContent = 'x'.repeat(80 * 1024);
    const message: Message = {
      id: 'assistant',
      role: 'assistant',
      content: '',
      timestamp: 1,
      toolCalls: [{
        id: 'tc_1',
        name: 'file_write',
        arguments: JSON.stringify({ file_path: 'big.txt', content: largeContent }),
      }],
      blocks: [{
        type: 'tool_use',
        id: 'tc_1',
        name: 'file_write',
        content: JSON.stringify({ file_path: 'big.txt', content: largeContent }),
      }],
    };

    const [sanitized] = sanitizeMessagesForStorage([message]);
    const storedJson = JSON.stringify(sanitized);

    expect(storedJson).toContain('contentOmitted');
    expect(storedJson.length).toBeLessThan(9000);
    expect(storedJson).not.toContain(largeContent.slice(0, 4096));
  });
});

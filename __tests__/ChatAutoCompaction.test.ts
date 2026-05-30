import { isContextLimitError } from '../src/chat/useChatController';

describe('chat auto compaction guards', () => {
  it('detects provider context limit errors', () => {
    expect(isContextLimitError(new Error('context_length_exceeded: maximum context length exceeded'))).toBe(true);
    expect(isContextLimitError(new Error('prompt is too long, reduce the input'))).toBe(true);
    expect(isContextLimitError(new Error('network timeout'))).toBe(false);
  });
});

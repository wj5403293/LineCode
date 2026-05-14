import {
  OpenAICompatibilityDetector,
  OpenAIReasoningRequestAdapter,
} from '../src/services/ai/processors/openai/OpenAICompatibility';
import { OpenAIMessageFormatter } from '../src/services/ai/processors/openai/OpenAIMessageFormatter';
import { ChatMessage } from '../src/services/ai/processors/StreamProcessor';

describe('OpenAI compatible MiMo reasoning_content handling', () => {
  const detector = new OpenAICompatibilityDetector();
  const adapter = new OpenAIReasoningRequestAdapter();
  const formatter = new OpenAIMessageFormatter();

  const toolCall = {
    id: 'call_1',
    name: 'diagnostic_tool',
    arguments: '{"query":"test"}',
  };

  it('detects MiMo endpoints as requiring reasoning_content on tool-call history', () => {
    const capabilities = detector.detect('https://token-plan-cn.xiaomimimo.com/v1', 'mimo-v2.5-pro');

    expect(capabilities.provider).toBe('mimo');
    expect(capabilities.requiresToolCallReasoningContent).toBe(true);
  });

  it('pads MiMo assistant tool-call messages with a single space when reasoning is missing', () => {
    const capabilities = detector.detect('https://token-plan-cn.xiaomimimo.com/v1', 'mimo-v2.5-pro');
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Call diagnostic_tool' },
      { role: 'assistant', content: '', toolCalls: [toolCall] },
      { role: 'tool', toolCallId: 'call_1', content: 'result' },
    ];

    const options = adapter.getMessageFormatOptions(capabilities, messages, 'off', false);
    const formatted = formatter.format(messages, options);

    expect(options.includeReasoning).toBe(true);
    expect(formatted[1]).toMatchObject({
      role: 'assistant',
      reasoning_content: ' ',
    });
  });

  it('preserves MiMo reasoning_content when it was captured from the API response', () => {
    const capabilities = detector.detect('https://token-plan-cn.xiaomimimo.com/v1', 'mimo-v2.5-pro');
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Call diagnostic_tool' },
      {
        role: 'assistant',
        content: '',
        toolCalls: [toolCall],
        reasoningContent: 'Need to call the diagnostic tool.',
      },
    ];

    const options = adapter.getMessageFormatOptions(capabilities, messages, 'medium', false);
    const formatted = formatter.format(messages, options);

    expect(formatted[1]).toMatchObject({
      role: 'assistant',
      reasoning_content: 'Need to call the diagnostic tool.',
    });
  });

  it('does not add reasoning_content to unknown OpenAI-compatible providers by default', () => {
    const capabilities = detector.detect('https://api.openai.com/v1', 'gpt-4.1');
    const messages: ChatMessage[] = [
      { role: 'user', content: 'Call diagnostic_tool' },
      { role: 'assistant', content: '', toolCalls: [toolCall] },
    ];

    const options = adapter.getMessageFormatOptions(capabilities, messages, 'medium', false);
    const formatted = formatter.format(messages, options);

    expect(formatted[1]).not.toHaveProperty('reasoning_content');
  });
});

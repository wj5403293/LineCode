import { ContextMetricsService } from '../src/chat/ContextMetricsService';
import { Message } from '../src/types';

function shellMessage(shellOutput: string): Message {
  return {
    id: 'assistant',
    role: 'assistant',
    content: '',
    timestamp: 1,
    blocks: [{
      type: 'tool_use',
      id: 'shell',
      name: 'shell_execute',
      content: '{}',
      shellOutput,
    }],
  };
}

describe('ContextMetricsService', () => {
  it('invalidates cached token counts when nested block output changes', () => {
    const service = new ContextMetricsService();

    const first = service.estimateContextTokens([shellMessage('short')]);
    const second = service.estimateContextTokens([shellMessage('long'.repeat(1024))]);

    expect(second).toBeGreaterThan(first);
  });
});

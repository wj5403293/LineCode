import { AnthropicStreamProcessor } from '../src/services/ai/processors/AnthropicProcessor';

class TestAnthropicStreamProcessor extends AnthropicStreamProcessor {
  private reads: ReadableStreamReadResult<Uint8Array>[];
  private response: Response | null = null;

  constructor(chunks: string[]) {
    super();
    this.reads = [
      ...chunks.map(value => ({ done: false, value } as unknown as ReadableStreamReadResult<Uint8Array>)),
      { done: true, value: undefined } as unknown as ReadableStreamReadResult<Uint8Array>,
    ];
  }

  protected createReader(_res: Response): ReadableStreamDefaultReader<Uint8Array> {
    return { cancel: jest.fn(() => Promise.resolve()) } as unknown as ReadableStreamDefaultReader<Uint8Array>;
  }

  protected createDecoder(): TextDecoder {
    return { decode: jest.fn((value: string) => value) } as unknown as TextDecoder;
  }

  protected readChunkWithTimeout(
    _reader: ReadableStreamDefaultReader<Uint8Array>,
    _providerName: string,
    _abortSignal?: AbortSignal,
    _timeoutMs?: number,
  ): Promise<ReadableStreamReadResult<Uint8Array>> {
    return Promise.resolve(this.reads.shift()!);
  }

  protected fetchWithRetry(): Promise<Response> {
    return Promise.resolve(this.response!);
  }

  setResponse(response: Response): void {
    this.response = response;
  }
}

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

  it('streams normally when the response content-type header is missing', async () => {
    const streamingProcessor = new TestAnthropicStreamProcessor([
      'data: {"type":"content_block_start","content_block":{"type":"text"}}\n' +
      'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hi"}}\n' +
      'data: {"type":"message_stop"}\n',
    ]);
    streamingProcessor.setResponse({
      status: 200,
      statusText: 'OK',
      headers: { get: () => '' },
    } as unknown as Response);

    const result = await streamingProcessor.process({
      id: 'model-1',
      name: 'Anthropic',
      provider: 'anthropic',
      modelId: 'claude-test',
      apiKey: 'key',
    }, [{ role: 'user', content: 'hi' }], [], undefined, { reasoningEffort: 'off' });

    expect(result.text).toBe('hi');
  });
});

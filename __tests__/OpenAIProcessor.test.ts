import { OpenAIStreamProcessor } from '../src/services/ai/processors/OpenAIProcessor';

class TestOpenAIStreamProcessor extends OpenAIStreamProcessor {
  private reads: ReadableStreamReadResult<Uint8Array>[];

  constructor(chunks: string[]) {
    super();
    this.reads = [
      ...chunks.map(value => ({ done: false, value } as unknown as ReadableStreamReadResult<Uint8Array>)),
      { done: true, value: undefined } as ReadableStreamReadResult<Uint8Array>,
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
}

describe('OpenAIStreamProcessor stream parsing', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('handles finish chunks without delta', async () => {
    const processor = new TestOpenAIStreamProcessor([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n' +
      'data: {"choices":[{"finish_reason":"stop"}]}\n',
    ]);

    const result = await (processor as any).readStream({} as Response);

    expect(result.text).toBe('hi');
  });
});

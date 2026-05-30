import { OpenAIStreamProcessor } from '../src/services/ai/processors/OpenAIProcessor';

class TestOpenAIStreamProcessor extends OpenAIStreamProcessor {
  private reads: ReadableStreamReadResult<Uint8Array>[];
  private response: Response | null = null;

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

  protected fetchWithRetry(): Promise<Response> {
    return Promise.resolve(this.response!);
  }

  setResponse(response: Response): void {
    this.response = response;
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

  it('streams normally when the response content-type header is missing', async () => {
    const processor = new TestOpenAIStreamProcessor([
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n' +
      'data: {"choices":[{"finish_reason":"stop"}]}\n',
    ]);
    processor.setResponse({
      status: 200,
      statusText: 'OK',
      headers: { get: () => '' },
    } as unknown as Response);

    const result = await processor.process({
      id: 'model-1',
      name: 'OpenAI',
      provider: 'openai',
      modelId: 'gpt-test',
      apiKey: 'key',
    }, [{ role: 'user', content: 'hi' }], []);

    expect(result.text).toBe('hi');
  });

  it('returns plain non-SSE response body instead of treating it as empty stream', async () => {
    const processor = new TestOpenAIStreamProcessor([]);
    processor.setResponse({
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/json' },
      text: () => Promise.resolve('{"answer":"plain result"}'),
    } as unknown as Response);

    const result = await processor.process({
      id: 'model-1',
      name: 'OpenAI',
      provider: 'openai',
      modelId: 'gpt-test',
      apiKey: 'key',
    }, [{ role: 'user', content: 'hi' }], []);

    expect(result.text).toBe('{"answer":"plain result"}');
    expect(result.blocks).toEqual([{ type: 'text', content: '{"answer":"plain result"}' }]);
  });

  it('rejects non-SSE HTML redirect bodies instead of showing them as model text', async () => {
    const processor = new TestOpenAIStreamProcessor([]);
    const html = [
      '<html>',
      '<head><title>301 Moved Permanently</title></head>',
      '<body><center><h1>301 Moved Permanently</h1></center><hr><center>cloudflare</center></body>',
      '</html>',
    ].join('');
    processor.setResponse({
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'text/html' },
      text: () => Promise.resolve(html),
    } as unknown as Response);

    await expect(processor.process({
      id: 'model-1',
      name: 'OpenAI',
      provider: 'openai',
      modelId: 'gpt-test',
      apiKey: 'key',
    }, [{ role: 'user', content: 'hi' }], [])).rejects.toThrow(/301 Moved Permanently/);
  });

  it('parses raw HTTP chunked SSE bodies when the fetch content-type header is non-SSE', async () => {
    const processor = new TestOpenAIStreamProcessor([]);
    const rawHttpSse = [
      'HTTP/1.1 200 OK',
      'Server: openresty',
      'Content-Type: text/event-stream; charset=utf-8',
      'Transfer-Encoding: chunked',
      '',
      '13b',
      'data: {"choices":[{"delta":{"reasoning_content":"思考"}}]}',
      '',
      '3ab',
      'data: {"choices":[{"delta":{"content":"你好"}}]}',
      'data: {"choices":[{"delta":{"content":"，"}}]}',
      '',
      '3ae',
      'data: {"choices":[{"delta":{"content":"瞄。"}}]}',
      '',
      '233',
      'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}]}',
      'data: [DONE]',
      '',
      '0',
      '',
    ].join('\n');
    processor.setResponse({
      status: 200,
      statusText: 'OK',
      headers: { get: () => 'application/octet-stream' },
      text: () => Promise.resolve(rawHttpSse),
    } as unknown as Response);

    const result = await processor.process({
      id: 'model-1',
      name: 'OpenAI',
      provider: 'openai',
      modelId: 'gpt-test',
      apiKey: 'key',
    }, [{ role: 'user', content: 'hi' }], []);

    expect(result.text).toBe('你好，瞄。');
    expect(result.reasoningContent).toBe('思考');
    expect(result.blocks).toEqual([
      { type: 'thinking', content: '思考' },
      { type: 'text', content: '你好，瞄。' },
    ]);
  });

  it('parses raw HTTP chunked SSE bodies on the event-stream reader path', async () => {
    const processor = new TestOpenAIStreamProcessor([
      [
        'HTTP/1.1 200 OK',
        'Content-Type: text/event-stream; charset=utf-8',
        'Transfer-Encoding: chunked',
        '',
        '3ab',
        'data: {"choices":[{"delta":{"content":"你好"}}]}',
        'data: {"choices":[{"delta":{"content":"，瞄。"}}]}',
        '',
        '0',
        'data: [DONE]',
        '',
      ].join('\n'),
    ]);

    const result = await (processor as any).readStream({
      headers: { get: () => 'text/event-stream; charset=utf-8' },
    } as unknown as Response);

    expect(result.text).toBe('你好，瞄。');
  });

  it('rejects raw HTTP HTML bodies on the event-stream reader path', async () => {
    const processor = new TestOpenAIStreamProcessor([
      [
        'HTTP/1.1 301 Moved Permanently',
        'Content-Type: text/html',
        '',
        '<html><head><title>301 Moved Permanently</title></head>',
        '<body><center><h1>301 Moved Permanently</h1></center></body></html>',
      ].join('\n'),
    ]);

    await expect((processor as any).readStream({
      headers: { get: () => 'text/event-stream; charset=utf-8' },
    } as unknown as Response)).rejects.toThrow(/301 Moved Permanently/);
  });
});

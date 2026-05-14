import { StreamProcessor, StreamCallbacks, StreamResult } from '../src/services/ai/processors/StreamProcessor';

class TestProcessor extends StreamProcessor {
  process(): Promise<StreamResult> {
    throw new Error('not implemented');
  }

  request(callbacks?: StreamCallbacks): Promise<Response> {
    return this.fetchWithRetry({
      providerName: 'TestProvider',
      requestUrl: 'https://example.test/v1/chat/completions',
      init: { method: 'POST', body: '{}' },
      callbacks,
      maxAttempts: 3,
      retryDelayMs: 0,
      networkHint: 'network hint',
      httpHint: 'http hint',
    });
  }
}

function response(status: number, body: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { get: jest.fn(() => null) },
    text: jest.fn(() => Promise.resolve(body)),
  } as any;
}

describe('StreamProcessor fetchWithRetry', () => {
  const processor = new TestProcessor();
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('retries retryable HTTP responses and reports status', async () => {
    const onStatus = jest.fn();
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(500, '{"error":{"message":"server busy"}}'))
      .mockResolvedValueOnce(response(200, '{}')) as any;

    const res = await processor.request({ onStatus });

    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenCalledWith('TestProvider HTTP 500，正在重试 2/3...');
  });

  it('retries network failures before giving up', async () => {
    const onStatus = jest.fn();
    globalThis.fetch = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network request failed'))
      .mockResolvedValueOnce(response(200, '{}')) as any;

    const res = await processor.request({ onStatus });

    expect(res.status).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(onStatus).toHaveBeenCalledWith('TestProvider 网络请求失败，正在重试 2/3...');
  });

  it('does not retry non-retryable HTTP errors and preserves provider error text', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(response(401, '{"error":{"message":"bad api key"}}')) as any;

    await expect(processor.request()).rejects.toThrow(/bad api key/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { extensionService } from '../src/services/ExtensionService';

const fetchMock = jest.fn();

describe('ExtensionService MCP headers', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    global.fetch = fetchMock as any;
  });

  it('sends custom request headers when querying MCP tools', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: jest.fn(() => Promise.resolve(JSON.stringify({ result: { tools: [{ name: 'echo' }] } }))),
      status: 200,
      statusText: 'OK',
    });

    const tools = await extensionService.queryMcpTools('https://example.com/mcp', [
      { name: 'Authorization', value: 'Bearer token' },
      { name: 'X-Team', value: 'mobile' },
    ]);

    expect(tools).toEqual([{ name: 'echo', description: undefined, inputSchema: undefined }]);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/mcp', expect.objectContaining({
      headers: expect.objectContaining({
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
        'X-Team': 'mobile',
      }),
    }));
  });

  it('persists normalized MCP request headers', async () => {
    const saved = await extensionService.saveMcpExtension({
      enabled: true,
      name: 'Private MCP',
      url: 'https://example.com/mcp',
      requestHeaders: [
        { name: ' Authorization ', value: ' Bearer token ' },
        { name: '', value: 'ignored' },
      ],
      tools: [],
    });

    const mcps = await extensionService.getMcpExtensions();
    expect(saved.requestHeaders).toEqual([{ name: 'Authorization', value: 'Bearer token' }]);
    expect(mcps[0].requestHeaders).toEqual([{ name: 'Authorization', value: 'Bearer token' }]);
  });
});

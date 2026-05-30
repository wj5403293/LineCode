import AsyncStorage from '@react-native-async-storage/async-storage';
import { extensionService } from '../src/services/ExtensionService';
import { createRuntimeRegistry, customMcpToolName } from '../src/mcp/tools/runtimeRegistry';

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

    expect(tools).toEqual([{ name: 'echo', enabled: true, description: undefined, inputSchema: undefined }]);
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
      tools: [
        { name: 'enabled_tool' },
        { name: 'disabled_tool', enabled: false },
      ],
    });

    const mcps = await extensionService.getMcpExtensions();
    expect(saved.requestHeaders).toEqual([{ name: 'Authorization', value: 'Bearer token' }]);
    expect(mcps[0].requestHeaders).toEqual([{ name: 'Authorization', value: 'Bearer token' }]);
    expect(mcps[0].tools).toEqual([
      { name: 'enabled_tool', enabled: true, description: undefined, inputSchema: undefined },
      { name: 'disabled_tool', enabled: false, description: undefined, inputSchema: undefined },
    ]);
  });

  it('registers only enabled custom MCP tools at runtime', async () => {
    const saved = await extensionService.saveMcpExtension({
      enabled: true,
      name: 'Private MCP',
      url: 'https://example.com/mcp',
      requestHeaders: [],
      tools: [
        { name: 'enabled_tool', enabled: true },
        { name: 'disabled_tool', enabled: false },
      ],
    });

    const registry = await createRuntimeRegistry({ includeCustomAgents: false, includeCustomMcp: true });

    expect(registry.get(customMcpToolName(saved, { name: 'enabled_tool' }))).toBeTruthy();
    expect(registry.get(customMcpToolName(saved, { name: 'disabled_tool' }))).toBeUndefined();
  });
});

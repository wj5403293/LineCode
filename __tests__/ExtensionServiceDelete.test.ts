import AsyncStorage from '@react-native-async-storage/async-storage';
import { extensionService } from '../src/services/ExtensionService';

const RNFS = require('react-native-fs');

describe('ExtensionService delete extensions', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    RNFS.exists.mockResolvedValue(true);
    RNFS.unlink.mockResolvedValue(undefined);
  });

  it('deletes custom agent extensions by id', async () => {
    const first = await extensionService.saveAgentExtension({
      enabled: true,
      name: 'Agent A',
      slug: 'agent-a',
      prompt: 'Do A',
      trigger: '',
      toolNames: [],
      mcpIds: [],
    });
    const second = await extensionService.saveAgentExtension({
      enabled: true,
      name: 'Agent B',
      slug: 'agent-b',
      prompt: 'Do B',
      trigger: '',
      toolNames: [],
      mcpIds: [],
    });

    await extensionService.deleteAgentExtension(first.id);

    const agents = await extensionService.getAgentExtensions();
    expect(agents.map(agent => agent.id)).toEqual([second.id]);
  });

  it('deletes custom MCP extensions by id', async () => {
    const first = await extensionService.saveMcpExtension({
      enabled: true,
      name: 'MCP A',
      url: 'https://a.example/mcp',
      requestHeaders: [],
      tools: [],
    });
    const second = await extensionService.saveMcpExtension({
      enabled: true,
      name: 'MCP B',
      url: 'https://b.example/mcp',
      requestHeaders: [],
      tools: [],
    });

    await extensionService.deleteMcpExtension(first.id);

    const mcps = await extensionService.getMcpExtensions();
    expect(mcps.map(mcp => mcp.id)).toEqual([second.id]);
  });

  it('deletes installed skills from storage and local filesystem when present', async () => {
    await AsyncStorage.setItem('@linecode_extension_skills', JSON.stringify([
      {
        id: 'skill_keep',
        name: 'keep',
        fileName: 'keep.zip',
        location: 'app',
        locationLabel: '应用 .linecode/skills',
        path: '/tmp/lineai-test/.linecode/skills/keep',
        installedAt: 1,
      },
      {
        id: 'skill_delete',
        name: 'delete',
        fileName: 'delete.zip',
        location: 'app',
        locationLabel: '应用 .linecode/skills',
        path: '/tmp/lineai-test/.linecode/skills/delete',
        installedAt: 2,
      },
    ]));

    await extensionService.deleteInstalledSkill('skill_delete');

    const skills = await extensionService.getInstalledSkills();
    expect(skills.map(skill => skill.id)).toEqual(['skill_keep']);
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/lineai-test/.linecode/skills/delete');
  });
});

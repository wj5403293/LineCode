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

  it('imports LineCode .lip extensions into app extension storage', async () => {
    const copyFile = require('react-native-saf-x').copyFile;

    const installed = await extensionService.installLineCodeLip({
      uri: 'content://picked/plugin.lip',
      name: 'plugin.lip',
    });

    expect(installed.fileName).toBe('plugin.lip');
    expect(installed.name).toBe('plugin');
    expect(installed.path).toContain('/tmp/lineai-test/.linecode/extensions/');
    expect(copyFile).toHaveBeenCalledWith(
      'content://picked/plugin.lip',
      expect.stringMatching(/^file:\/\/\/tmp\/lineai-test\/\.linecode\/extensions\/\d+_plugin\.lip$/),
      { replaceIfDestinationExists: true },
    );
    expect((await extensionService.getLineCodeExtensions()).map(item => item.id)).toEqual([installed.id]);
  });

  it('deletes LineCode extensions from storage and local filesystem', async () => {
    await AsyncStorage.setItem('@linecode_extension_linecode', JSON.stringify([
      {
        id: 'linecode_keep',
        name: 'keep',
        fileName: 'keep.lip',
        path: '/tmp/lineai-test/.linecode/extensions/keep.lip',
        installedAt: 1,
      },
      {
        id: 'linecode_delete',
        name: 'delete',
        fileName: 'delete.lip',
        path: '/tmp/lineai-test/.linecode/extensions/delete.lip',
        installedAt: 2,
      },
    ]));

    await extensionService.deleteLineCodeExtension('linecode_delete');

    const extensions = await extensionService.getLineCodeExtensions();
    expect(extensions.map(item => item.id)).toEqual(['linecode_keep']);
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/lineai-test/.linecode/extensions/delete.lip');
  });
});

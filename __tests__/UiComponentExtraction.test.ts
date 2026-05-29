import fs from 'fs';
import path from 'path';

const root = path.join(__dirname, '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('shared UI component extraction foundation', () => {
  it('provides reusable layout primitives for plugin-ready screens', () => {
    expect(fs.existsSync(path.join(root, 'src/components/ui/ScreenScaffold.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/ui/SettingsSection.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/ui/FormTextField.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/ui/ActionRow.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/ui/HeaderActionButton.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/ui/FormSection.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/ui/SelectableRow.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/components/ui/index.ts'))).toBe(true);

    const barrel = read('src/components/ui/index.ts');
    expect(barrel).toContain("export { default as ScreenScaffold }");
    expect(barrel).toContain("export { default as SettingsSection }");
    expect(barrel).toContain("export { default as FormTextField }");
    expect(barrel).toContain("export { default as ActionRow }");
    expect(barrel).toContain("export { default as HeaderActionButton }");
    expect(barrel).toContain("export { default as FormSection }");
    expect(barrel).toContain("export { default as SelectableRow }");
  });

  it('migrates simple settings screens away from duplicated section/group layout styles', () => {
    const screens = [
      'src/screens/OutputSettingsScreen.tsx',
      'src/screens/LLMSettingsScreen.tsx',
      'src/screens/ExperimentalSettingsScreen.tsx',
      'src/screens/KeepAliveSettingsScreen.tsx',
    ];

    for (const screenPath of screens) {
      const source = read(screenPath);
      expect(source).toContain("from '../components/ui'");
      expect(source).toContain('<ScreenScaffold');
      expect(source).toContain('<SettingsSection');
      expect(source).not.toContain('optionGroup:');
      expect(source).not.toContain('group: {');
      expect(source).not.toContain('section: { paddingTop: spacing.xl }');
    }
  });

  it('migrates repeated local labeled inputs to the shared form field primitive', () => {
    const screens = [
      'src/screens/McpExtensionEditScreen.tsx',
      'src/screens/AgentExtensionEditScreen.tsx',
      'src/screens/MCPSettingsScreen.tsx',
    ];

    for (const screenPath of screens) {
      const source = read(screenPath);
      expect(source).toContain('FormTextField');
      expect(source).not.toContain('function LabeledInput');
    }
  });

  it('migrates repeated local action rows to the shared action row primitive', () => {
    const screens = [
      'src/screens/DataSettingsScreen.tsx',
      'src/screens/DebugSettingsScreen.tsx',
      'src/screens/McpExtensionEditScreen.tsx',
    ];

    for (const screenPath of screens) {
      const source = read(screenPath);
      expect(source).toContain('ActionRow');
      expect(source).not.toContain('function DebugActionRow');
      expect(source).not.toContain('interface ActionRowProps');
    }
  });
});

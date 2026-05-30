import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text, TextInput, View } from 'react-native';
import { createPluginRuntime, LineMLRenderer, parsePluginLineMl } from '../src/plugins';

function createRuntimeWithDocument(source: string) {
  const runtime = createPluginRuntime({
    manifest: {
      id: 'com.lineai.renderer-test',
      name: 'Renderer Test',
      version: '1.0.0',
      permissions: ['storage.plugin'],
      pages: [],
      hooks: [],
      contributes: { menus: [], settingsPages: [] },
    },
  });
  const document = runtime.createDocument(parsePluginLineMl(source));
  return { runtime, document };
}

async function renderWithAct(element: React.ReactElement): Promise<TestRenderer.ReactTestRenderer> {
  let tree: TestRenderer.ReactTestRenderer | undefined;
  await act(async () => {
    tree = TestRenderer.create(element, { unstable_isConcurrent: false } as never);
    await new Promise(resolve => setTimeout(resolve, 20));
  });
  return tree!;
}

describe('LineMLRenderer', () => {
  it('renders LineML document nodes with stable plugin element test ids and text content', async () => {
    const { document } = createRuntimeWithDocument(`
      <Page id="settings" title="Renderer Test">
        <Stack id="root" padding="lg" spacing="md">
          <Text id="title" variant="title">发送前缀</Text>
          <Card id="card" tone="info">
            <Text id="body">说明文本</Text>
          </Card>
        </Stack>
      </Page>
    `);

    const tree = await renderWithAct(<LineMLRenderer document={document} />);

    expect(tree.root.findByProps({ testID: 'plugin-element-settings' }).type).toBe(View);
    expect(tree.root.findByProps({ testID: 'plugin-element-root' }).type).toBe(View);
    expect(tree.root.findByProps({ testID: 'plugin-element-card' }).type).toBe(View);
    expect(tree.root.findByProps({ testID: 'plugin-element-title' }).findByType(Text).props.children).toBe('发送前缀');
    expect(tree.root.findByProps({ testID: 'plugin-element-body' }).findByType(Text).props.children).toBe('说明文本');
  });

  it('keeps virtual document values in sync when users edit inputs and switches', async () => {
    const { document } = createRuntimeWithDocument(`
      <Page id="settings">
        <Input id="name" label="名称" placeholder="输入名称" />
        <TextArea id="prompt" label="提示词" minLines="4" />
        <Switch id="enabled" label="启用" />
      </Page>
    `);

    const tree = await renderWithAct(<LineMLRenderer document={document} />);
    const inputs = tree.root.findAllByType(TextInput);
    const switchButton = tree.root.findByProps({ testID: 'plugin-element-enabled-toggle' });

    await act(async () => {
      await inputs[0].props.onChangeText('Alice');
      await inputs[1].props.onChangeText('Prompt body');
      await switchButton.props.onPress();
    });

    expect(document.getElementById('name')!.value).toBe('Alice');
    expect(document.getElementById('prompt')!.value).toBe('Prompt body');
    expect(document.getElementById('enabled')!.checked).toBe(true);
  });

  it('dispatches registered virtual DOM click handlers from Button elements', async () => {
    const { document } = createRuntimeWithDocument(`
      <Page id="settings">
        <Button id="save" variant="primary">保存</Button>
      </Page>
    `);
    const save = document.getElementById('save')!;
    const clicks: string[] = [];
    save.addEventListener('click', event => {
      clicks.push(event.source.elementId ?? 'missing');
    });

    const tree = await renderWithAct(<LineMLRenderer document={document} />);
    const button = tree.root.findByProps({ testID: 'plugin-element-save-button' });

    await act(async () => {
      await button.props.onPress();
    });

    expect(clicks).toEqual(['save']);
  });

  it('bridges DOM-style event properties and change events from native controls', async () => {
    const { document } = createRuntimeWithDocument(`
      <Page id="settings">
        <Input id="name" />
        <Switch id="enabled" label="启用" />
      </Page>
    `);
    const events: string[] = [];
    const name = document.getElementById('name')!;
    const enabled = document.getElementById('enabled')!;

    name.oninput = event => {
      events.push(`input:${event.source.elementId}`);
    };
    name.addEventListener('change', event => {
      events.push(`change:${event.source.elementId}`);
    });
    enabled.onclick = event => {
      events.push(`click:${event.source.elementId}`);
    };
    enabled.addEventListener('change', event => {
      events.push(`change:${event.source.elementId}`);
    });

    const tree = await renderWithAct(<LineMLRenderer document={document} />);
    const input = tree.root.findByType(TextInput);
    const switchButton = tree.root.findByProps({ testID: 'plugin-element-enabled-toggle' });

    await act(async () => {
      await input.props.onChangeText('Alice');
      await switchButton.props.onPress();
    });

    expect(events).toEqual(['input:name', 'change:name', 'click:enabled', 'change:enabled']);
  });

  it('does not render hidden elements', async () => {
    const { document } = createRuntimeWithDocument(`
      <Page id="settings">
        <Text id="visible">可见</Text>
        <Text id="hidden">隐藏</Text>
      </Page>
    `);
    document.getElementById('hidden')!.hidden = true;

    const tree = await renderWithAct(<LineMLRenderer document={document} />);

    expect(tree.root.findByProps({ testID: 'plugin-element-visible' })).toBeTruthy();
    expect(() => tree.root.findByProps({ testID: 'plugin-element-hidden' })).toThrow();
  });
});

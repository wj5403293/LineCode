import {
  createPluginRuntime,
  parsePluginManifestXml,
  parsePluginLineMl,
} from '../src/plugins';

describe('LineML + JS plugin runtime MVP', () => {
  it('parses plugin xml permissions, pages, hooks, menu and settings contributions', () => {
    const manifest = parsePluginManifestXml(`
      <Plugin id="com.lineai.send-prefix" name="发送前缀" version="1.0.0">
        <Permissions>
          <Permission name="storage.plugin" />
          <Permission name="hook.chat.send.around" />
          <Permission name="ui.registerSettingsPage" />
        </Permissions>
        <Pages>
          <Page id="settings" title="发送前缀设置" view="views/settings.lineml" script="scripts/settings.js" />
        </Pages>
        <Hooks>
          <Hook name="chat.send" mode="around" script="scripts/hooks.js" allowSkipSuper="false" />
        </Hooks>
        <Contributes>
          <Menu target="chat.more">
            <Item id="openSettings" title="发送前缀设置" icon="sparkles" page="settings" />
          </Menu>
          <Settings>
            <PageRef id="settings" />
          </Settings>
        </Contributes>
      </Plugin>
    `);

    expect(manifest).toEqual({
      id: 'com.lineai.send-prefix',
      name: '发送前缀',
      version: '1.0.0',
      permissions: [
        'storage.plugin',
        'hook.chat.send.around',
        'ui.registerSettingsPage',
      ],
      pages: [{ id: 'settings', title: '发送前缀设置', view: 'views/settings.lineml', script: 'scripts/settings.js' }],
      hooks: [{ name: 'chat.send', mode: 'around', script: 'scripts/hooks.js', allowSkipSuper: false }],
      contributes: {
        menus: [{ target: 'chat.more', items: [{ id: 'openSettings', title: '发送前缀设置', icon: 'sparkles', page: 'settings' }] }],
        settingsPages: ['settings'],
      },
    });
  });

  it('builds a scoped virtual document from LineML ids and updates only that page instance', () => {
    const first = parsePluginLineMl(`
      <Page id="settings">
        <Stack id="root" padding="lg">
          <TextArea id="prefix" label="发送前追加内容" />
          <Button id="save" variant="primary">保存</Button>
        </Stack>
      </Page>
    `);
    const second = parsePluginLineMl(`
      <Page id="settings">
        <TextArea id="prefix" />
      </Page>
    `);

    const runtime = createPluginRuntime({
      manifest: {
        id: 'com.lineai.send-prefix',
        name: '发送前缀',
        version: '1.0.0',
        permissions: ['storage.plugin'],
        pages: [],
        hooks: [],
        contributes: { menus: [], settingsPages: [] },
      },
    });

    const firstDocument = runtime.createDocument(first);
    const secondDocument = runtime.createDocument(second);

    firstDocument.getElementById('prefix')!.value = 'first';
    secondDocument.getElementById('prefix')!.value = 'second';
    firstDocument.getElementById('root')!.hidden = true;

    expect(firstDocument.getElementById('prefix')!.value).toBe('first');
    expect(secondDocument.getElementById('prefix')!.value).toBe('second');
    expect(firstDocument.getElementById('root')!.hidden).toBe(true);
    expect(secondDocument.getElementById('root')).toBeNull();
  });

  it('runs page setup scripts with current virtual document and registered element handlers', async () => {
    const runtime = createPluginRuntime({
      manifest: {
        id: 'com.lineai.send-prefix',
        name: '发送前缀',
        version: '1.0.0',
        permissions: ['storage.plugin'],
        pages: [],
        hooks: [],
        contributes: { menus: [], settingsPages: [] },
      },
    });
    await runtime.settings.set('prefix', 'old');

    const document = runtime.createDocument(parsePluginLineMl(`
      <Page id="settings">
        <TextArea id="prefix" />
        <Button id="save">保存</Button>
      </Page>
    `));

    const toastMessages: string[] = [];

    await runtime.runPageScript(document, async ctx => {
      const prefix = ctx.document.getElementById('prefix')!;
      const save = ctx.document.getElementById('save')!;

      prefix.value = await ctx.settings.get('prefix') || '';

      save.addEventListener('click', async () => {
        await ctx.settings.set('prefix', prefix.value);
        await ctx.toast.show('已保存');
      });
    }, {
      toast: { show: async message => { toastMessages.push(message); } },
    });

    expect(document.getElementById('prefix')!.value).toBe('old');

    document.getElementById('prefix')!.value = 'new';
    await document.getElementById('save')!.dispatchEvent('click');

    expect(await runtime.settings.get('prefix')).toBe('new');
    expect(toastMessages).toEqual(['已保存']);
  });

  it('requires manifest permissions before registering hooks and supports super chaining', async () => {
    const runtime = createPluginRuntime({
      manifest: {
        id: 'com.lineai.send-prefix',
        name: '发送前缀',
        version: '1.0.0',
        permissions: ['hook.chat.send.around', 'storage.plugin'],
        pages: [],
        hooks: [{ name: 'chat.send', mode: 'around', script: 'scripts/hooks.js', allowSkipSuper: false }],
        contributes: { menus: [], settingsPages: [] },
      },
    });
    await runtime.settings.set('prefix', 'PREFIX');

    await runtime.runHookScript(ctx => {
      ctx.hooks.on<{ message: { text: string } }, string>('chat.send', async event => {
        const prefix = await ctx.settings.get('prefix');
        event.message.text = `${prefix}: ${event.message.text}`;
        return event.super();
      });
    });

    const result = await runtime.invokeHook(
      'chat.send',
      { message: { text: 'hello' } },
      async event => `sent:${event.message.text}`,
    );

    expect(result).toBe('sent:PREFIX: hello');

    const deniedRuntime = createPluginRuntime({
      manifest: {
        id: 'com.lineai.denied',
        name: 'Denied',
        version: '1.0.0',
        permissions: [],
        pages: [],
        hooks: [],
        contributes: { menus: [], settingsPages: [] },
      },
    });

    expect(() => {
      deniedRuntime.runHookScript(ctx => {
        ctx.hooks.on('chat.send', async event => event.super());
      });
    }).toThrow('Missing plugin permission: hook.chat.send.around');
  });

  it('rejects forbidden permissions and hook declarations from plugin manifests', () => {
    expect(() => parsePluginManifestXml(`
      <Plugin id="com.lineai.bad" name="Bad" version="1.0.0">
        <Permissions>
          <Permission name="secrets.readAll" />
        </Permissions>
      </Plugin>
    `)).toThrow('Forbidden plugin permission: secrets.readAll');

    expect(() => parsePluginManifestXml(`
      <Plugin id="com.lineai.bad-hook" name="Bad Hook" version="1.0.0">
        <Permissions>
          <Permission name="hook.chat.send.around" />
        </Permissions>
        <Hooks>
          <Hook name="security.decryptSecrets" mode="around" script="scripts/hooks.js" />
        </Hooks>
      </Plugin>
    `)).toThrow('Forbidden plugin hook: security.decryptSecrets');
  });

  it('rejects LineML tags and attributes outside the unified UI whitelist', () => {
    expect(() => parsePluginLineMl('<Page id="settings"><WebView id="web" /></Page>'))
      .toThrow('Unsupported plugin LineML component: WebView');

    expect(() => parsePluginLineMl('<Page id="settings"><Text id="title" style="color:red" /></Page>'))
      .toThrow('Unsupported plugin LineML attribute on Text: style');

    expect(() => parsePluginLineMl('<Page id="settings"><Button id="save" variant="neon">保存</Button></Page>'))
      .toThrow('Invalid token for Button.variant: neon');
  });

  it('scopes injected settings storage by plugin id', async () => {
    const backingStore = new Map<string, unknown>();
    const first = createPluginRuntime({
      manifest: {
        id: 'com.lineai.first',
        name: 'First',
        version: '1.0.0',
        permissions: ['storage.plugin'],
        pages: [],
        hooks: [],
        contributes: { menus: [], settingsPages: [] },
      },
      storage: backingStore,
    });
    const second = createPluginRuntime({
      manifest: {
        id: 'com.lineai.second',
        name: 'Second',
        version: '1.0.0',
        permissions: ['storage.plugin'],
        pages: [],
        hooks: [],
        contributes: { menus: [], settingsPages: [] },
      },
      storage: backingStore,
    });

    await first.settings.set('prefix', 'first');
    await second.settings.set('prefix', 'second');

    expect(await first.settings.get('prefix')).toBe('first');
    expect(await second.settings.get('prefix')).toBe('second');
    expect(backingStore.get('plugin:com.lineai.first:settings:prefix')).toBe('first');
    expect(backingStore.get('plugin:com.lineai.second:settings:prefix')).toBe('second');
  });
});

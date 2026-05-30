import {
  activatePlugin,
  createHookManager,
  parsePluginManifestXml,
} from '../src/plugins';

describe('Plugin activation', () => {
  it('activates hook scripts into the host hook manager and disposes registrations', async () => {
    const manifest = parsePluginManifestXml(`
      <Plugin id="com.lineai.prefix" name="Prefix" version="1.0.0">
        <Permissions>
          <Permission name="hook.chat.send.around" />
          <Permission name="storage.plugin" />
        </Permissions>
        <Hooks>
          <Hook name="chat.send" mode="around" script="scripts/hooks.js" allowSkipSuper="false" />
        </Hooks>
      </Plugin>
    `);
    const hostHooks = createHookManager();

    const activation = await activatePlugin({
      manifest,
      hostHooks,
      scripts: {
        'scripts/hooks.js': async ctx => {
          ctx.hooks.on<{ text: string }, string>('chat.send', async event => {
            const prefix = await ctx.settings.get('prefix') || 'P';
            event.text = `${prefix}:${event.text}`;
            return event.super();
          });
        },
      },
      storage: new Map([['plugin:com.lineai.prefix:settings:prefix', 'PLUGIN']]),
    });

    const hooked = await hostHooks.invoke('chat.send', { text: 'hello' }, async event => event.text);
    expect(hooked).toBe('PLUGIN:hello');

    activation.dispose();

    const disposed = await hostHooks.invoke('chat.send', { text: 'hello' }, async event => event.text);
    expect(disposed).toBe('hello');
  });

  it('creates plugin page documents and runs page setup against the page document', async () => {
    const manifest = parsePluginManifestXml(`
      <Plugin id="com.lineai.page" name="Page" version="1.0.0">
        <Permissions>
          <Permission name="storage.plugin" />
        </Permissions>
        <Pages>
          <Page id="settings" title="Settings" view="views/settings.lineml" script="scripts/settings.js" />
        </Pages>
      </Plugin>
    `);

    const activation = await activatePlugin({
      manifest,
      views: {
        'views/settings.lineml': `
          <Page id="settings">
            <Input id="prefix" label="Prefix" />
            <Button id="save">Save</Button>
          </Page>
        `,
      },
      scripts: {
        'scripts/settings.js': async ctx => {
          const prefix = ctx.document.getElementById('prefix')!;
          const save = ctx.document.getElementById('save')!;
          prefix.value = await ctx.settings.get('prefix') || '';
          save.addEventListener('click', async () => {
            await ctx.settings.set('prefix', prefix.value);
            await ctx.toast.show('saved');
          });
        },
      },
      storage: new Map([['plugin:com.lineai.page:settings:prefix', 'old']]),
    });

    const toastMessages: string[] = [];
    const page = await activation.createPage('settings', {
      toast: {
        show: async message => {
          toastMessages.push(message);
        },
      },
    });
    expect(page.document.getElementById('prefix')!.value).toBe('old');

    page.document.getElementById('prefix')!.value = 'new';
    await page.document.getElementById('save')!.dispatchEvent('click');

    expect(await activation.runtime.settings.get('prefix')).toBe('new');
    expect(toastMessages).toEqual(['saved']);
  });

  it('refuses to activate missing hook scripts or missing page assets', async () => {
    const manifest = parsePluginManifestXml(`
      <Plugin id="com.lineai.missing" name="Missing" version="1.0.0">
        <Permissions>
          <Permission name="hook.chat.send.around" />
        </Permissions>
        <Hooks>
          <Hook name="chat.send" mode="around" script="scripts/missing.js" />
        </Hooks>
        <Pages>
          <Page id="settings" view="views/missing.lineml" script="scripts/page.js" />
        </Pages>
      </Plugin>
    `);

    await expect(activatePlugin({ manifest, scripts: {}, views: {} }))
      .rejects.toThrow('Missing plugin hook script: scripts/missing.js');
  });
});

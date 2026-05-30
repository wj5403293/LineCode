import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import {
  ActivatedPlugin,
  activatePlugin,
  chatHookManager,
  CreatePluginPageOptions,
  parsePluginManifestXml,
  PluginManifest,
  PluginToastApi,
  PluginSetupFunction,
} from '../plugins';
import { InstalledLineCodeExtension, extensionService } from './ExtensionService';

const ACTIVE_LINECODE_PLUGIN_IDS_KEY = '@linecode_active_linecode_plugin_ids';

type MenuTarget = 'chat.more' | 'app.drawer';

export interface LineCodePluginContributionItem {
  pluginId: string;
  itemId: string;
  title: string;
  icon?: string;
  page?: string;
  target: MenuTarget;
}

export interface LineCodePluginPageInstance {
  pluginId: string;
  pageId: string;
  title?: string;
  document: import('../plugins').PluginDocument;
}

export interface OpenLineCodePluginPageOptions {
  toast?: PluginToastApi;
}

interface LoadedLineCodePlugin {
  extension: InstalledLineCodeExtension;
  manifest: PluginManifest;
  activation: ActivatedPlugin;
}

class LineCodePluginService {
  private loaded = new Map<string, LoadedLineCodePlugin>();

  async reloadActivePlugins(): Promise<void> {
    this.disposeAll();
    const activeIds = await this.getActivePluginIds();
    const extensions = await extensionService.getLineCodeExtensions();
    for (const extension of extensions) {
      if (activeIds.length > 0 && !activeIds.includes(extension.id)) continue;
      await this.loadExtension(extension).catch(err => {
        console.warn('[LineCodePluginService] failed to load plugin', extension.path, err);
      });
    }
  }

  async activateExtension(extensionId: string): Promise<void> {
    const extensions = await extensionService.getLineCodeExtensions();
    const extension = extensions.find(item => item.id === extensionId);
    if (!extension) throw new Error('未找到 LineCode 扩展。');
    const ids = await this.getActivePluginIds();
    if (!ids.includes(extensionId)) {
      await AsyncStorage.setItem(ACTIVE_LINECODE_PLUGIN_IDS_KEY, JSON.stringify([...ids, extensionId]));
    }
    await this.loadExtension(extension);
  }

  async deactivateExtension(extensionId: string): Promise<void> {
    const loaded = this.loaded.get(extensionId);
    loaded?.activation.dispose();
    this.loaded.delete(extensionId);
    const ids = await this.getActivePluginIds();
    await AsyncStorage.setItem(ACTIVE_LINECODE_PLUGIN_IDS_KEY, JSON.stringify(ids.filter(id => id !== extensionId)));
  }

  getMenuItems(target: MenuTarget): LineCodePluginContributionItem[] {
    const items: LineCodePluginContributionItem[] = [];
    for (const loaded of this.loaded.values()) {
      loaded.manifest.contributes.menus
        .filter(menu => menu.target === target)
        .forEach(menu => {
          menu.items.forEach(item => {
            items.push({
              pluginId: loaded.extension.id,
              itemId: item.id,
              title: item.title,
              icon: item.icon,
              page: item.page,
              target,
            });
          });
        });
    }
    return items;
  }

  async openPluginPage(
    pluginId: string,
    pageId: string,
    options?: OpenLineCodePluginPageOptions,
  ): Promise<LineCodePluginPageInstance> {
    const loaded = this.loaded.get(pluginId);
    if (!loaded) throw new Error('插件未启用或未加载。');
    const page = loaded.manifest.pages.find(item => item.id === pageId);
    if (!page) throw new Error('插件页面不存在。');
    const pageOptions: CreatePluginPageOptions = { toast: options?.toast };
    const instance = await loaded.activation.createPage(pageId, pageOptions);
    return {
      pluginId,
      pageId,
      title: page.title,
      document: instance.document,
    };
  }

  disposeAll(): void {
    for (const loaded of this.loaded.values()) {
      loaded.activation.dispose();
    }
    this.loaded.clear();
  }

  private async loadExtension(extension: InstalledLineCodeExtension): Promise<void> {
    if (this.loaded.has(extension.id)) return;
    const sourceDir = await this.ensureUnpacked(extension);
    const pluginXml = await RNFS.readFile(`${sourceDir}/plugin.xml`, 'utf8');
    const manifest = parsePluginManifestXml(pluginXml);
    const views = await this.readAssets(sourceDir, 'views', '.lineml');
    const scriptSources = await this.readAssets(sourceDir, 'scripts', '.js');
    const scripts = this.compileScripts(scriptSources);
    const activation = await activatePlugin({
      manifest,
      views,
      scripts,
      hostHooks: chatHookManager,
      storage: {
        get: key => AsyncStorage.getItem(String(key)).then(value => value ? JSON.parse(value) : undefined),
        set: (key, value) => AsyncStorage.setItem(String(key), JSON.stringify(value)),
      },
    });
    this.loaded.set(extension.id, { extension, manifest, activation });
  }

  private async ensureUnpacked(extension: InstalledLineCodeExtension): Promise<string> {
    const sourceDir = `${extension.path}.unpacked`;
    const exists = await RNFS.exists(`${sourceDir}/plugin.xml`);
    if (!exists) {
      await RNFS.mkdir(sourceDir);
      await unzip(extension.path, sourceDir);
    }
    return sourceDir;
  }

  private async readAssets(root: string, folder: string, extension: string): Promise<Record<string, string>> {
    const dir = `${root}/${folder}`;
    const exists = await RNFS.exists(dir);
    if (!exists) return {};
    const result: Record<string, string> = {};
    await this.readAssetsRecursive(root, dir, extension, result);
    return result;
  }

  private async readAssetsRecursive(root: string, dir: string, extension: string, result: Record<string, string>): Promise<void> {
    const entries = await RNFS.readDir(dir);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await this.readAssetsRecursive(root, entry.path, extension, result);
        continue;
      }
      if (!entry.name.toLowerCase().endsWith(extension)) continue;
      const relativePath = entry.path.slice(root.length + 1).replace(/\\/g, '/');
      result[relativePath] = await RNFS.readFile(entry.path, 'utf8');
    }
  }

  private compileScripts(sources: Record<string, string>): Record<string, PluginSetupFunction> {
    const scripts: Record<string, PluginSetupFunction> = {};
    Object.entries(sources).forEach(([path, source]) => {
      scripts[path] = this.compileScript(source, path);
    });
    return scripts;
  }

  private compileScript(source: string, path: string): PluginSetupFunction {
    const normalized = source
      .replace(/export\s+default\s+async\s+function\s+setup\s*\(/, 'async function setup(')
      .replace(/export\s+default\s+function\s+setup\s*\(/, 'function setup(')
      .replace(/export\s+default\s+async\s+function\s*\(/, 'async function setup(')
      .replace(/export\s+default\s+function\s*\(/, 'function setup(');
    if (!/function\s+setup\s*\(/.test(normalized)) {
      throw new Error(`插件脚本缺少 default setup 函数: ${path}`);
    }
    // eslint-disable-next-line no-new-func
    const factory = new Function(`${normalized}\nreturn setup;`);
    return factory() as PluginSetupFunction;
  }

  private async getActivePluginIds(): Promise<string[]> {
    const json = await AsyncStorage.getItem(ACTIVE_LINECODE_PLUGIN_IDS_KEY);
    const parsed = json ? JSON.parse(json) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  }
}

export const lineCodePluginService = new LineCodePluginService();

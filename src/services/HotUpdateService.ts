import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { APP_HOT_UPDATE_VERSION_CODE, APP_VERSION } from '../constants/appInfo';
import {
  fetchLanzouTextFile,
  resolveLanzouDownloadUrl,
  resolveLanzouHotUpdateFiles,
} from './LanzouShareResolver';
import { settingsService } from './settings';

const UPDATE_ROOT = `${RNFS.DocumentDirectoryPath}/.linecode/updates`;
const CURRENT_DIR = `${UPDATE_ROOT}/current`;
const TEMP_DIR = `${UPDATE_ROOT}/tmp`;
const STATE_KEY = '@linecode_hot_update_state';

export interface HotUpdateInfo {
  versionCode: number;
  versionName: string;
  changelog: string;
  zipUrl: string;
}

export interface HotUpdateState {
  installedVersionCode: number;
  installedVersionName: string;
  installedAt: number;
  failedVersionCode?: number;
  failedAt?: number;
  failedReason?: string;
}

interface ManifestFile {
  path: string;
  sha256: string;
  size?: number;
  url?: string;
}

interface HotUpdateManifest {
  versionCode?: number;
  version_code?: number;
  versionName?: string;
  version_name?: string;
  bundle?: ManifestFile;
  bundlePath?: string;
  bundle_path?: string;
  bundleSha256?: string;
  bundle_sha256?: string;
  files?: ManifestFile[];
}

function normalizeSha(value: string): string {
  return value.trim().toLowerCase();
}

function assertSafeRelativePath(filePath: string): void {
  if (!filePath || filePath.startsWith('/') || filePath.includes('\\') || filePath.split('/').includes('..')) {
    throw new Error(`manifest 包含非法文件路径: ${filePath}`);
  }
}

async function ensureCleanDir(path: string): Promise<void> {
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
  await RNFS.mkdir(path);
}

async function ensureParentDir(path: string): Promise<void> {
  const parent = path.slice(0, path.lastIndexOf('/'));
  if (parent) {
    await RNFS.mkdir(parent);
  }
}

async function copyDir(source: string, target: string): Promise<void> {
  await RNFS.mkdir(target);
  const items = await RNFS.readDir(source);
  for (const item of items) {
    const nextTarget = `${target}/${item.name}`;
    if (item.isDirectory()) {
      await copyDir(item.path, nextTarget);
    } else {
      await RNFS.copyFile(item.path, nextTarget);
    }
  }
}

class HotUpdateService {
  get currentBundlePath(): string {
    return `${CURRENT_DIR}/index.android.bundle`;
  }

  async getState(): Promise<HotUpdateState | null> {
    const json = await AsyncStorage.getItem(STATE_KEY);
    if (!json) return null;
    try {
      return JSON.parse(json) as HotUpdateState;
    } catch {
      return null;
    }
  }

  async isAutoUpdateEnabled(): Promise<boolean> {
    return settingsService.getAutoUpdateEnabled();
  }

  async setAutoUpdateEnabled(enabled: boolean): Promise<void> {
    await settingsService.setAutoUpdateEnabled(enabled);
  }

  async checkForUpdate(): Promise<HotUpdateInfo | null> {
    const files = await resolveLanzouHotUpdateFiles();
    const text = await fetchLanzouTextFile(files.detail.shareUrl);
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const firstLine = lines[0]?.trim();
    const secondLine = lines[1]?.trim();
    const versionCode = Number(firstLine);
    if (!Number.isFinite(versionCode) || versionCode <= 0) {
      throw new Error('更新详情第一行必须是有效版本号');
    }

    const info: HotUpdateInfo = {
      versionCode,
      versionName: secondLine || `v${versionCode}`,
      changelog: lines.slice(2).join('\n').trim(),
      zipUrl: files.zip.shareUrl,
    };

    const state = await this.getState();
    const localVersionCode = state?.installedVersionCode ?? APP_HOT_UPDATE_VERSION_CODE;
    return info.versionCode > localVersionCode ? info : null;
  }

  async install(info: HotUpdateInfo): Promise<void> {
    await RNFS.mkdir(UPDATE_ROOT);
    await ensureCleanDir(TEMP_DIR);

    const zipPath = `${TEMP_DIR}/base.zip`;
    const extractDir = `${TEMP_DIR}/extract`;
    await RNFS.mkdir(extractDir);

    try {
      const zipUrl = await resolveLanzouDownloadUrl(info.zipUrl);
      if (!zipUrl.startsWith('https://')) {
        throw new Error(`更新包必须使用 HTTPS: ${zipUrl}`);
      }
      const download = RNFS.downloadFile({
        fromUrl: zipUrl,
        toFile: zipPath,
        background: false,
        discretionary: false,
        connectionTimeout: 15_000,
        readTimeout: 60_000,
      });
      const result = await download.promise;
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(`下载更新包失败: HTTP ${result.statusCode}`);
      }

      await unzip(zipPath, extractDir);
      const manifestPath = `${extractDir}/manifest.json`;
      if (!(await RNFS.exists(manifestPath))) {
        throw new Error('更新包缺少 manifest.json');
      }

      const manifest = JSON.parse(await RNFS.readFile(manifestPath, 'utf8')) as HotUpdateManifest;
      this.assertManifestMatchesInfo(manifest, info);
      const bundlePath = this.resolveBundlePath(manifest);
      const files = this.resolveManifestFiles(manifest, bundlePath);

      for (const file of files) {
        assertSafeRelativePath(file.path);
        const localPath = `${extractDir}/${file.path}`;
        if (!(await RNFS.exists(localPath)) && file.url) {
          await ensureParentDir(localPath);
          await this.downloadFile(file.url, localPath);
        }
        if (!(await RNFS.exists(localPath))) {
          throw new Error(`更新包缺少文件: ${file.path}`);
        }
        const actual = normalizeSha(await RNFS.hash(localPath, 'sha256'));
        if (actual !== normalizeSha(file.sha256)) {
          throw new Error(`文件校验失败: ${file.path}`);
        }
      }

      const extractedBundle = `${extractDir}/${bundlePath}`;
      if (!(await RNFS.exists(extractedBundle))) {
        throw new Error(`更新包缺少 bundle: ${bundlePath}`);
      }

      await ensureCleanDir(CURRENT_DIR);
      await copyDir(extractDir, CURRENT_DIR);
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify({
        installedVersionCode: info.versionCode,
        installedVersionName: info.versionName,
        installedAt: Date.now(),
      } satisfies HotUpdateState));
    } catch (err) {
      await this.markFailed(info, err);
      throw err;
    } finally {
      if (await RNFS.exists(TEMP_DIR)) {
        await RNFS.unlink(TEMP_DIR);
      }
    }
  }

  private assertManifestMatchesInfo(manifest: HotUpdateManifest, info: HotUpdateInfo): void {
    const manifestVersionCode = Number(manifest.versionCode ?? manifest.version_code ?? info.versionCode);
    if (manifestVersionCode !== info.versionCode) {
      throw new Error(`manifest 版本号不匹配: ${manifestVersionCode}`);
    }
  }

  private resolveBundlePath(manifest: HotUpdateManifest): string {
    const path = manifest.bundle?.path ?? manifest.bundlePath ?? manifest.bundle_path ?? 'index.android.bundle';
    assertSafeRelativePath(path);
    return path;
  }

  private resolveManifestFiles(manifest: HotUpdateManifest, bundlePath: string): ManifestFile[] {
    const byPath = new Map<string, ManifestFile>();
    for (const file of manifest.files ?? []) {
      if (file.path && file.sha256) byPath.set(file.path, file);
    }

    const bundleSha = manifest.bundle?.sha256 ?? manifest.bundleSha256 ?? manifest.bundle_sha256;
    if (bundleSha) {
      byPath.set(bundlePath, {
        path: bundlePath,
        sha256: bundleSha,
        size: manifest.bundle?.size,
        url: manifest.bundle?.url,
      });
    }

    const files = [...byPath.values()];
    if (!files.some(file => file.path === bundlePath && file.sha256)) {
      throw new Error('manifest 必须包含 bundle 文件的 sha256');
    }
    return files;
  }

  private async downloadFile(url: string, targetPath: string): Promise<void> {
    if (!url.startsWith('https://')) {
      throw new Error(`更新文件必须使用 HTTPS: ${url}`);
    }
    const result = await RNFS.downloadFile({
      fromUrl: url,
      toFile: targetPath,
      background: false,
      discretionary: false,
      connectionTimeout: 15_000,
      readTimeout: 60_000,
    }).promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new Error(`下载更新文件失败: HTTP ${result.statusCode}`);
    }
  }

  private async markFailed(info: HotUpdateInfo, err: unknown): Promise<void> {
    const previous = await this.getState();
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify({
      installedVersionCode: previous?.installedVersionCode ?? APP_HOT_UPDATE_VERSION_CODE,
      installedVersionName: previous?.installedVersionName ?? APP_VERSION,
      installedAt: previous?.installedAt ?? 0,
      failedVersionCode: info.versionCode,
      failedAt: Date.now(),
      failedReason: err instanceof Error ? err.message : String(err),
    } satisfies HotUpdateState));
  }
}

export const hotUpdateService = new HotUpdateService();

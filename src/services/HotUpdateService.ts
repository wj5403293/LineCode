import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { APP_ANDROID_VERSION_CODE, APP_HOT_UPDATE_VERSION_CODE, APP_VERSION } from '../constants/appInfo';
import {
  fetchLanzouTextFile,
  resolveLanzouDownloadUrl,
  resolveLanzouHotUpdateFiles,
} from './LanzouShareResolver';
import { settingsService } from './settings';

const UPDATE_ROOT = `${RNFS.DocumentDirectoryPath}/.linecode/updates`;
const CURRENT_DIR = `${UPDATE_ROOT}/current`;
const TEMP_DIR = `${UPDATE_ROOT}/tmp`;
const CURRENT_STATE_PATH = `${CURRENT_DIR}/hot-update-state.json`;
const STATE_KEY = '@linecode_hot_update_state';
const HERMES_BYTECODE_MAGIC_BASE64 = 'xh+8A8EDGR8=';

export interface HotUpdateInfo {
  versionCode: number;
  versionName: string;
  changelog: string;
  updateChain: HotUpdateChainItem[];
  requiresApk: boolean;
  apkUrl?: string;
  zipUrl: string;
  zipSha256?: string;
  detailUrl?: string;
}

export interface HotUpdateChainItem {
  versionCode: number;
  versionName: string;
  changelog: string;
  requiresApk: boolean;
  apkUrl?: string;
  createdAt?: string;
  detailUrl?: string;
}

export interface HotUpdateState {
  installedVersionCode: number;
  installedVersionName: string;
  installedApkVersionName?: string;
  installedApkVersionCode?: number;
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
  requiresApk?: boolean;
  requires_apk?: boolean;
  bundle?: ManifestFile;
  bundlePath?: string;
  bundle_path?: string;
  bundleSha256?: string;
  bundle_sha256?: string;
  files?: ManifestFile[];
}

interface HotUpdateIndexRelease {
  versionCode?: number;
  version_code?: number;
  versionName?: string;
  version_name?: string;
  changelog?: string;
  requiresApk?: boolean;
  requires_apk?: boolean;
  apkUrl?: string;
  apk_url?: string;
  createdAt?: string;
  created_at?: string;
  detailFile?: string;
  detail_file?: string;
  detailUrl?: string;
  detail_url?: string;
  zipFile?: string;
  zip_file?: string;
  zipSha256?: string;
  zip_sha256?: string;
}

interface HotUpdateIndex {
  schemaVersion?: number;
  current?: HotUpdateIndexRelease;
  releases?: HotUpdateIndexRelease[];
}

interface HotUpdateReleaseDetail extends HotUpdateIndexRelease {
  schemaVersion?: number;
}

function normalizeSha(value: string): string {
  return value.trim().toLowerCase();
}

function assertSafeRelativePath(filePath: string): void {
  if (!filePath || filePath.startsWith('/') || filePath.includes('\\') || filePath.split('/').includes('..')) {
    throw new Error(`manifest 包含非法文件路径: ${filePath}`);
  }
}

function releaseVersionCode(release: HotUpdateIndexRelease | undefined): number {
  return Number(release?.versionCode ?? release?.version_code ?? 0);
}

function normalizeReleaseSummary(release: HotUpdateIndexRelease): HotUpdateChainItem & { zipSha256?: string } {
  const versionCode = releaseVersionCode(release);
  const versionName = String(release.versionName ?? release.version_name ?? `v${versionCode}`);
  return {
    versionCode,
    versionName,
    changelog: String(release.changelog || '').trim(),
    requiresApk: Boolean(release.requiresApk ?? release.requires_apk),
    apkUrl: String(release.apkUrl ?? release.apk_url ?? ''),
    createdAt: release.createdAt ?? release.created_at,
    detailUrl: release.detailUrl ?? release.detail_url,
    zipSha256: release.zipSha256 ?? release.zip_sha256,
  };
}

function formatChainChangelog(item: HotUpdateChainItem): string {
  const badge = item.requiresApk ? '需要安装新版 APK' : '热更新';
  const body = item.changelog || '暂无更新日志';
  return `${item.versionName} (${item.versionCode}) · ${badge}\n${body}`;
}

function alternateMetadataFileName(fileName: string): string {
  if (fileName.endsWith('.txt')) return fileName.replace(/\.txt$/, '.json');
  if (fileName.endsWith('.json')) return fileName.replace(/\.json$/, '.txt');
  return fileName;
}

function createInstalledState(info: HotUpdateInfo): HotUpdateState {
  return {
    installedVersionCode: info.versionCode,
    installedVersionName: info.versionName,
    installedApkVersionName: APP_VERSION,
    installedApkVersionCode: APP_ANDROID_VERSION_CODE,
    installedAt: Date.now(),
  };
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

  get currentStatePath(): string {
    return CURRENT_STATE_PATH;
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

  async getInstalledState(): Promise<HotUpdateState | null> {
    const state = await this.getState();
    if (!state) return null;
    if (await this.hasUsableInstalledBundle(state)) return state;

    await this.clearInstalledUpdate();
    return null;
  }

  async isAutoUpdateEnabled(): Promise<boolean> {
    return settingsService.getAutoUpdateEnabled();
  }

  async setAutoUpdateEnabled(enabled: boolean): Promise<void> {
    await settingsService.setAutoUpdateEnabled(enabled);
  }

  async checkForUpdate(): Promise<HotUpdateInfo | null> {
    const state = await this.getInstalledState();
    const localVersionCode = state
      ? state.installedVersionCode
      : APP_HOT_UPDATE_VERSION_CODE;
    const files = await resolveLanzouHotUpdateFiles();
    const historyUrls = new Map<string, string>();
    for (const file of files.history) {
      historyUrls.set(file.name, file.shareUrl);
      historyUrls.set(alternateMetadataFileName(file.name), file.shareUrl);
    }
    const info = files.index
      ? await this.readJsonUpdateInfo(files.index.shareUrl, files.zip.shareUrl, localVersionCode, historyUrls)
      : await this.readLegacyTextUpdateInfo(files.detail!.shareUrl, files.zip.shareUrl, localVersionCode);

    return info.versionCode > localVersionCode ? info : null;
  }

  async install(info: HotUpdateInfo): Promise<void> {
    await RNFS.mkdir(UPDATE_ROOT);
    await ensureCleanDir(TEMP_DIR);
    const previousState = await this.getInstalledState();
    let replacedCurrent = false;

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
      if (info.zipSha256) {
        const actualZipSha = normalizeSha(await RNFS.hash(zipPath, 'sha256'));
        if (actualZipSha !== normalizeSha(info.zipSha256)) {
          throw new Error('更新包校验失败，请重新下载。');
        }
      }

      await unzip(zipPath, extractDir);
      const manifestPath = `${extractDir}/manifest.json`;
      if (!(await RNFS.exists(manifestPath))) {
        throw new Error('更新包缺少 manifest.json');
      }

      const manifest = JSON.parse(await RNFS.readFile(manifestPath, 'utf8')) as HotUpdateManifest;
      this.assertManifestMatchesInfo(manifest, info);
      if (info.requiresApk || manifest.requiresApk || manifest.requires_apk) {
        throw new Error('此更新需要安装新版 APK，不能通过热更新安装。');
      }
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
      if (!(await isHermesBytecodeBundle(extractedBundle))) {
        throw new Error('更新包 bundle 必须是 Hermes bytecode，请重新构建热更新包');
      }

      await ensureCleanDir(CURRENT_DIR);
      replacedCurrent = true;
      await copyDir(extractDir, CURRENT_DIR);
      const installedState = createInstalledState(info);
      await AsyncStorage.setItem(STATE_KEY, JSON.stringify(installedState));
      await RNFS.writeFile(CURRENT_STATE_PATH, `${JSON.stringify(installedState, null, 2)}\n`, 'utf8');
    } catch (err) {
      if (replacedCurrent) {
        await RNFS.unlink(CURRENT_DIR).catch(() => {});
      }
      await this.markFailed(info, err, previousState);
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

  private async readJsonUpdateInfo(
    indexUrl: string,
    zipUrl: string,
    localVersionCode: number,
    historyUrls: Map<string, string>,
  ): Promise<HotUpdateInfo> {
    const raw = await fetchLanzouTextFile(indexUrl);
    let parsed: HotUpdateIndex;
    try {
      parsed = JSON.parse(raw) as HotUpdateIndex;
    } catch {
      throw new Error('base.txt 不是有效 JSON');
    }

    const indexReleases = Array.isArray(parsed.releases) ? parsed.releases : [];
    const sortedIndexReleases = [...indexReleases].sort((a, b) => releaseVersionCode(a) - releaseVersionCode(b));
    const currentSource = parsed.current || sortedIndexReleases[sortedIndexReleases.length - 1];
    if (!currentSource || releaseVersionCode(currentSource) <= 0) {
      throw new Error('base.txt 缺少有效的 current 或 releases');
    }
    const releases = await this.resolveUpdateChain(parsed, indexUrl, localVersionCode, historyUrls);
    const current = normalizeReleaseSummary(currentSource);
    const chain = releases
      .map(release => normalizeReleaseSummary(release))
      .filter(release => release.versionCode > localVersionCode)
      .sort((a, b) => a.versionCode - b.versionCode);
    if (chain.length === 0) {
      return {
        versionCode: current.versionCode,
        versionName: current.versionName,
        changelog: current.changelog,
        updateChain: [],
        requiresApk: current.requiresApk,
        apkUrl: current.apkUrl,
        zipUrl,
        zipSha256: current.zipSha256,
        detailUrl: current.detailUrl,
      };
    }

    const latest = chain[chain.length - 1];
    return {
      versionCode: latest.versionCode,
      versionName: latest.versionName,
      changelog: chain.map(item => formatChainChangelog(item)).join('\n\n'),
      updateChain: chain,
      requiresApk: chain.some(item => item.requiresApk),
      apkUrl: chain.find(item => item.requiresApk && item.apkUrl)?.apkUrl || latest.apkUrl,
      zipUrl,
      zipSha256: latest.zipSha256 || current.zipSha256,
      detailUrl: latest.detailUrl || current.detailUrl,
    };
  }

  private async resolveUpdateChain(
    index: HotUpdateIndex,
    indexUrl: string,
    localVersionCode: number,
    historyUrls: Map<string, string>,
  ): Promise<HotUpdateIndexRelease[]> {
    const releases = Array.isArray(index.releases) ? [...index.releases] : [];
    if (index.current) {
      const currentVersion = releaseVersionCode(index.current);
      if (!releases.some(release => releaseVersionCode(release) === currentVersion)) {
        releases.push(index.current);
      }
    }

    const candidates = releases
      .filter(release => releaseVersionCode(release) > localVersionCode)
      .sort((a, b) => releaseVersionCode(a) - releaseVersionCode(b));

    return Promise.all(candidates.map(release => this.hydrateReleaseDetail(release, indexUrl, historyUrls)));
  }

  private async hydrateReleaseDetail(
    release: HotUpdateIndexRelease,
    indexUrl: string,
    historyUrls: Map<string, string>,
  ): Promise<HotUpdateIndexRelease> {
    const detailFile = release.detailFile || release.detail_file;
    const detailUrl = release.detailUrl || release.detail_url || (detailFile ? historyUrls.get(detailFile) : '');
    if (!detailUrl) return release;

    try {
      const detailText = await fetchLanzouTextFile(detailUrl);
      const detail = JSON.parse(detailText) as HotUpdateReleaseDetail;
      return {
        ...release,
        ...detail,
        detailUrl,
      };
    } catch (err) {
      console.warn('[LineCode] Failed to read hot update detail:', indexUrl, err);
      return release;
    }
  }

  private async readLegacyTextUpdateInfo(detailUrl: string, zipUrl: string, localVersionCode: number): Promise<HotUpdateInfo> {
    const text = await fetchLanzouTextFile(detailUrl);
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    const firstLine = lines[0]?.trim();
    const secondLine = lines[1]?.trim();
    const versionCode = Number(firstLine);
    if (!Number.isFinite(versionCode) || versionCode <= 0) {
      throw new Error('更新详情第一行必须是有效版本号');
    }

    const release: HotUpdateChainItem = {
      versionCode,
      versionName: secondLine || `v${versionCode}`,
      changelog: lines.slice(2).join('\n').trim(),
      requiresApk: false,
      detailUrl,
    };
    return {
      versionCode,
      versionName: release.versionName,
      changelog: release.changelog,
      updateChain: versionCode > localVersionCode ? [release] : [],
      requiresApk: false,
      zipUrl,
      detailUrl,
    };
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

  private isStateForCurrentApk(state: HotUpdateState | null): boolean {
    return Boolean(
      state &&
      state.installedVersionCode >= APP_HOT_UPDATE_VERSION_CODE &&
      state.installedApkVersionName === APP_VERSION &&
      state.installedApkVersionCode === APP_ANDROID_VERSION_CODE,
    );
  }

  private async hasUsableInstalledBundle(state: HotUpdateState | null): Promise<boolean> {
    if (!this.isStateForCurrentApk(state)) return false;
    if (!(await RNFS.exists(CURRENT_STATE_PATH))) return false;
    return isHermesBytecodeBundle(this.currentBundlePath);
  }

  private async clearInstalledUpdate(): Promise<void> {
    await AsyncStorage.removeItem(STATE_KEY);
    if (await RNFS.exists(CURRENT_DIR)) {
      await RNFS.unlink(CURRENT_DIR).catch(() => {});
    }
  }

  private async markFailed(info: HotUpdateInfo, err: unknown, previousState?: HotUpdateState | null): Promise<void> {
    const previous = previousState ?? await this.getState();
    const failedState: HotUpdateState = {
      installedVersionCode: previous?.installedVersionCode ?? APP_HOT_UPDATE_VERSION_CODE,
      installedVersionName: previous?.installedVersionName ?? APP_VERSION,
      installedApkVersionName: previous?.installedApkVersionName,
      installedApkVersionCode: previous?.installedApkVersionCode,
      installedAt: previous?.installedAt ?? 0,
      failedVersionCode: info.versionCode,
      failedAt: Date.now(),
      failedReason: err instanceof Error ? err.message : String(err),
    };
    await AsyncStorage.setItem(STATE_KEY, JSON.stringify(failedState));
  }
}

async function isHermesBytecodeBundle(bundlePath: string): Promise<boolean> {
  try {
    if (!(await RNFS.exists(bundlePath))) return false;
    const header = await RNFS.read(bundlePath, 8, 0, 'base64');
    return header === HERMES_BYTECODE_MAGIC_BASE64;
  } catch {
    return false;
  }
}

export const hotUpdateService = new HotUpdateService();

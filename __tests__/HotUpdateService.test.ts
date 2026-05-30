import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { NativeModules, Platform } from 'react-native';
import { APP_ANDROID_VERSION_CODE, APP_HOT_UPDATE_VERSION_CODE, APP_VERSION } from '../src/constants/appInfo';
import { hotUpdateService } from '../src/services/HotUpdateService';
import {
  fetchLanzouTextFile,
  resolveLanzouDownloadUrl,
  resolveLanzouHotUpdateFiles,
} from '../src/services/LanzouShareResolver';

jest.mock('../src/services/LanzouShareResolver', () => ({
  fetchLanzouTextFile: jest.fn(),
  resolveLanzouDownloadUrl: jest.fn(),
  resolveLanzouHotUpdateFiles: jest.fn(),
}));

describe('HotUpdateService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    (RNFS.readDir as jest.Mock).mockResolvedValue([]);
  });

  it('reads base.txt update chain and hydrates historical details', async () => {
    (resolveLanzouHotUpdateFiles as jest.Mock).mockResolvedValue({
      index: { fileId: 'index', name: 'base.txt', sizeLabel: '', shareUrl: 'https://lanzou.example/base.txt' },
      history: [
        { fileId: 'old', name: `base-${APP_HOT_UPDATE_VERSION_CODE + 1}.txt`, sizeLabel: '', shareUrl: 'https://lanzou.example/base-old.txt' },
        { fileId: 'new', name: `base-${APP_HOT_UPDATE_VERSION_CODE + 2}.txt`, sizeLabel: '', shareUrl: 'https://lanzou.example/base-new.txt' },
      ],
      zip: { fileId: 'zip', name: 'base.zip', sizeLabel: '', shareUrl: 'https://lanzou.example/base.zip' },
    });
    (fetchLanzouTextFile as jest.Mock).mockImplementation(async (url: string) => {
      if (url.endsWith('base.txt')) {
        return JSON.stringify({
          current: {
            versionCode: APP_HOT_UPDATE_VERSION_CODE + 2,
            versionName: '1.7.9',
            changelog: 'latest summary',
            detailFile: `base-${APP_HOT_UPDATE_VERSION_CODE + 2}.txt`,
            zipSha256: 'abc123',
          },
          releases: [
            {
              versionCode: APP_HOT_UPDATE_VERSION_CODE + 1,
              versionName: '1.7.8',
              changelog: 'index old',
              detailFile: `base-${APP_HOT_UPDATE_VERSION_CODE + 1}.txt`,
            },
            {
              versionCode: APP_HOT_UPDATE_VERSION_CODE + 2,
              versionName: '1.7.9',
              changelog: 'index new',
              detailFile: `base-${APP_HOT_UPDATE_VERSION_CODE + 2}.txt`,
              zipSha256: 'abc123',
            },
          ],
        });
      }
      if (url.endsWith('base-old.txt')) {
        return JSON.stringify({
          versionCode: APP_HOT_UPDATE_VERSION_CODE + 1,
          versionName: '1.7.8',
          changelog: 'old detail',
          requiresApk: false,
        });
      }
      if (url.endsWith('base-new.txt')) {
        return JSON.stringify({
          versionCode: APP_HOT_UPDATE_VERSION_CODE + 2,
          versionName: '1.7.9',
          changelog: 'new detail',
          requiresApk: true,
          apkUrl: 'https://example.com/linecode.apk',
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const info = await hotUpdateService.checkForUpdate();

    expect(info).toEqual(expect.objectContaining({
      versionCode: APP_HOT_UPDATE_VERSION_CODE + 2,
      versionName: '1.7.9',
      requiresApk: true,
      apkUrl: 'https://example.com/linecode.apk',
      zipSha256: 'abc123',
      zipUrl: 'https://lanzou.example/base.zip',
    }));
    expect(info?.updateChain).toEqual([
      expect.objectContaining({ versionCode: APP_HOT_UPDATE_VERSION_CODE + 1, changelog: 'old detail', requiresApk: false }),
      expect.objectContaining({ versionCode: APP_HOT_UPDATE_VERSION_CODE + 2, changelog: 'new detail', requiresApk: true }),
    ]);
    expect(info?.changelog).toContain('old detail');
    expect(info?.changelog).toContain('new detail');
  });

  it('rejects malformed base.txt without current or releases', async () => {
    (resolveLanzouHotUpdateFiles as jest.Mock).mockResolvedValue({
      index: { fileId: 'index', name: 'base.txt', sizeLabel: '', shareUrl: 'https://lanzou.example/base.txt' },
      history: [],
      zip: { fileId: 'zip', name: 'base.zip', sizeLabel: '', shareUrl: 'https://lanzou.example/base.zip' },
    });
    (fetchLanzouTextFile as jest.Mock).mockResolvedValue('{}');

    await expect(hotUpdateService.checkForUpdate()).rejects.toThrow('base.txt 缺少有效的 current 或 releases');
  });

  it('hydrates legacy json detail when index references json name but folder only has txt', async () => {
    const nextVersion = APP_HOT_UPDATE_VERSION_CODE + 1;
    (resolveLanzouHotUpdateFiles as jest.Mock).mockResolvedValue({
      index: { fileId: 'index', name: 'base.txt', sizeLabel: '', shareUrl: 'https://lanzou.example/base.txt' },
      history: [
        { fileId: 'next', name: `base-${nextVersion}.txt`, sizeLabel: '', shareUrl: 'https://lanzou.example/base-next.txt' },
      ],
      zip: { fileId: 'zip', name: 'base.zip', sizeLabel: '', shareUrl: 'https://lanzou.example/base.zip' },
    });
    (fetchLanzouTextFile as jest.Mock).mockImplementation(async (url: string) => {
      if (url.endsWith('base.txt')) {
        return JSON.stringify({
          current: {
            versionCode: nextVersion,
            versionName: '1.7.8',
            changelog: 'index detail',
            detailFile: `base-${nextVersion}.json`,
          },
        });
      }
      if (url.endsWith('base-next.txt')) {
        return JSON.stringify({
          versionCode: nextVersion,
          versionName: '1.7.8',
          changelog: 'txt detail',
          requiresApk: false,
        });
      }
      throw new Error(`unexpected url: ${url}`);
    });

    const info = await hotUpdateService.checkForUpdate();

    expect(info?.updateChain[0]).toEqual(expect.objectContaining({
      versionCode: nextVersion,
      changelog: 'txt detail',
    }));
  });

  it('ignores installed hot update state when apk identity is missing', async () => {
    const nextVersion = APP_HOT_UPDATE_VERSION_CODE + 1;
    await AsyncStorage.setItem('@linecode_hot_update_state', JSON.stringify({
      installedVersionCode: APP_HOT_UPDATE_VERSION_CODE + 10,
      installedVersionName: '1.7.99',
      installedAt: 1,
    }));
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.read as jest.Mock).mockResolvedValue('xh+8A8EDGR8=');
    (resolveLanzouHotUpdateFiles as jest.Mock).mockResolvedValue({
      index: { fileId: 'index', name: 'base.txt', sizeLabel: '', shareUrl: 'https://lanzou.example/base.txt' },
      history: [],
      zip: { fileId: 'zip', name: 'base.zip', sizeLabel: '', shareUrl: 'https://lanzou.example/base.zip' },
    });
    (fetchLanzouTextFile as jest.Mock).mockResolvedValue(JSON.stringify({
      current: {
        versionCode: nextVersion,
        versionName: '1.7.8',
        changelog: 'next update',
      },
    }));

    const info = await hotUpdateService.checkForUpdate();

    expect(info?.versionCode).toBe(nextVersion);
    expect(await AsyncStorage.getItem('@linecode_hot_update_state')).toBeNull();
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/lineai-test/.linecode/updates/current');
  });

  it('ignores installed hot update state when it is older than the built-in bundle', async () => {
    const nextVersion = APP_HOT_UPDATE_VERSION_CODE + 1;
    await AsyncStorage.setItem('@linecode_hot_update_state', JSON.stringify({
      installedVersionCode: APP_HOT_UPDATE_VERSION_CODE - 1,
      installedVersionName: APP_VERSION,
      installedApkVersionName: APP_VERSION,
      installedApkVersionCode: APP_ANDROID_VERSION_CODE,
      installedAt: 1,
    }));
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.read as jest.Mock).mockResolvedValue('xh+8A8EDGR8=');
    (resolveLanzouHotUpdateFiles as jest.Mock).mockResolvedValue({
      index: { fileId: 'index', name: 'base.txt', sizeLabel: '', shareUrl: 'https://lanzou.example/base.txt' },
      history: [],
      zip: { fileId: 'zip', name: 'base.zip', sizeLabel: '', shareUrl: 'https://lanzou.example/base.zip' },
    });
    (fetchLanzouTextFile as jest.Mock).mockResolvedValue(JSON.stringify({
      current: {
        versionCode: nextVersion,
        versionName: APP_VERSION,
        changelog: 'next update',
      },
    }));

    const info = await hotUpdateService.checkForUpdate();

    expect(info?.versionCode).toBe(nextVersion);
    expect(await AsyncStorage.getItem('@linecode_hot_update_state')).toBeNull();
    expect(RNFS.unlink).toHaveBeenCalledWith('/tmp/lineai-test/.linecode/updates/current');
  });

  it('writes current apk identity for native bundle selection after install', async () => {
    const nextVersion = APP_HOT_UPDATE_VERSION_CODE + 1;
    (resolveLanzouDownloadUrl as jest.Mock).mockResolvedValue('https://cdn.example/base.zip');
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    (RNFS.read as jest.Mock).mockResolvedValue('xh+8A8EDGR8=');
    (RNFS.hash as jest.Mock).mockResolvedValue('bundle-sha');
    (RNFS.readFile as jest.Mock).mockImplementation(async (path: string) => {
      if (path.endsWith('/manifest.json')) {
        return JSON.stringify({
          versionCode: nextVersion,
          versionName: '1.7.8',
          bundle: { path: 'index.android.bundle', sha256: 'bundle-sha' },
          files: [{ path: 'index.android.bundle', sha256: 'bundle-sha' }],
        });
      }
      return '';
    });
    (RNFS.readDir as jest.Mock).mockResolvedValue([
      {
        name: 'index.android.bundle',
        path: '/tmp/lineai-test/.linecode/updates/tmp/extract/index.android.bundle',
        isDirectory: () => false,
      },
    ]);

    await hotUpdateService.install({
      versionCode: nextVersion,
      versionName: '1.7.8',
      changelog: 'next update',
      updateChain: [],
      requiresApk: false,
      zipUrl: 'https://lanzou.example/base.zip',
    });

    const state = JSON.parse(String(await AsyncStorage.getItem('@linecode_hot_update_state')));
    expect(state).toEqual(expect.objectContaining({
      installedVersionCode: nextVersion,
      installedVersionName: '1.7.8',
      installedApkVersionName: APP_VERSION,
      installedApkVersionCode: APP_ANDROID_VERSION_CODE,
    }));
    expect(RNFS.writeFile).toHaveBeenCalledWith(
      hotUpdateService.currentStatePath,
      expect.stringContaining(`"installedApkVersionName": "${APP_VERSION}"`),
      'utf8',
    );
  });

  it('downloads encrypted runtime APK packages and invokes the system installer', async () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    const nextVersion = APP_HOT_UPDATE_VERSION_CODE + 1;
    (resolveLanzouHotUpdateFiles as jest.Mock).mockResolvedValue({
      index: { fileId: 'index', name: 'base.txt', sizeLabel: '', shareUrl: 'https://lanzou.example/base.txt' },
      history: [
        { fileId: 'detail', name: `base-${nextVersion}.txt`, sizeLabel: '', shareUrl: 'https://lanzou.example/base-next.txt' },
      ],
      zip: undefined,
      apkPackages: {
        local: { fileId: 'apk', name: 'base-local.enc', sizeLabel: '', shareUrl: 'https://lanzou.example/base-local.enc' },
      },
      all: [
        { fileId: 'index', name: 'base.txt', sizeLabel: '', shareUrl: 'https://lanzou.example/base.txt' },
        { fileId: 'detail', name: `base-${nextVersion}.txt`, sizeLabel: '', shareUrl: 'https://lanzou.example/base-next.txt' },
        { fileId: 'apk', name: 'base-local.enc', sizeLabel: '', shareUrl: 'https://lanzou.example/base-local.enc' },
      ],
    });
    (fetchLanzouTextFile as jest.Mock).mockImplementation(async (url: string) => {
      if (url.endsWith('base.txt')) {
        return JSON.stringify({
          current: {
            versionCode: nextVersion,
            versionName: '1.9.2',
            changelog: 'apk update',
            requiresApk: true,
            detailFile: `base-${nextVersion}.txt`,
            apkPackages: {
              local: {
                file: 'base-local.enc',
                sha256: 'enc-sha',
                apkSha256: 'apk-sha',
              },
            },
          },
        });
      }
      return JSON.stringify({
        versionCode: nextVersion,
        versionName: '1.9.2',
        changelog: 'apk update detail',
        requiresApk: true,
        apkPackages: {
          local: {
            file: 'base-local.enc',
            sha256: 'enc-sha',
            apkSha256: 'apk-sha',
          },
        },
      });
    });
    (resolveLanzouDownloadUrl as jest.Mock).mockResolvedValue('https://cdn.example/base-local.enc');
    (RNFS.downloadFile as jest.Mock).mockReturnValue({ promise: Promise.resolve({ statusCode: 200 }) });
    (RNFS.hash as jest.Mock)
      .mockResolvedValueOnce('enc-sha')
      .mockResolvedValueOnce('apk-sha');

    try {
      const info = await hotUpdateService.checkForUpdate();
      await hotUpdateService.install(info!);

      expect(info).toEqual(expect.objectContaining({
        requiresApk: true,
        apkPackages: expect.objectContaining({
          local: expect.objectContaining({
            url: 'https://lanzou.example/base-local.enc',
          }),
        }),
      }));
      expect(RNFS.downloadFile).toHaveBeenCalledWith(expect.objectContaining({
        fromUrl: 'https://cdn.example/base-local.enc',
        toFile: expect.stringContaining('base-local.enc'),
      }));
      expect(NativeModules.ApkInstaller.decryptXorFile).toHaveBeenCalledWith(
        expect.stringContaining('base-local.enc'),
        expect.stringContaining('.apk'),
        'LineCodeApkUpdateXorV1',
      );
      expect(NativeModules.ApkInstaller.installApk).toHaveBeenCalledWith(expect.stringContaining('.apk'));
    } finally {
      Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    }
  });
});

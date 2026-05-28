import { Linking, NativeModules, PermissionsAndroid, Platform } from 'react-native';

interface StoragePermissionNativeModule {
  isManageExternalStorageGranted(): Promise<boolean>;
  openManageExternalStorageSettings(): Promise<boolean>;
}

const StoragePermission = NativeModules.StoragePermission as StoragePermissionNativeModule | undefined;

function safeDecodeUriPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    try {
      return decodeURI(value);
    } catch {
      return value;
    }
  }
}

function stripUriSuffix(value: string): string {
  return value.split(/[?#]/)[0];
}

function extractSafAuthority(uri: string): string | null {
  const match = uri.match(/^content:\/\/([^/]+)/);
  return match?.[1] || null;
}

function extractSafDocumentId(uri: string): string | null {
  const cleanUri = stripUriSuffix(uri);
  const documentMarker = '/document/';
  const documentIndex = cleanUri.indexOf(documentMarker);
  if (documentIndex >= 0) {
    return cleanUri.slice(documentIndex + documentMarker.length);
  }

  const treeMarker = '/tree/';
  const treeIndex = cleanUri.indexOf(treeMarker);
  if (treeIndex >= 0) {
    return cleanUri.slice(treeIndex + treeMarker.length);
  }

  return null;
}

function joinAbsolutePath(root: string, rest: string): string {
  const cleanRest = rest.replace(/^\/+/, '');
  return cleanRest ? `${root}/${cleanRest}` : root;
}

function mapExternalStorageDocumentId(documentId: string): string | null {
  if (documentId.startsWith('raw:')) {
    const rawPath = documentId.slice('raw:'.length);
    return rawPath.startsWith('/') ? rawPath : null;
  }

  const separatorIndex = documentId.indexOf(':');
  if (separatorIndex < 0) return null;

  const volume = documentId.slice(0, separatorIndex);
  const rest = documentId.slice(separatorIndex + 1);

  if (volume === 'primary') {
    return joinAbsolutePath('/storage/emulated/0', rest);
  }

  if (volume === 'home') {
    return joinAbsolutePath('/storage/emulated/0/Documents', rest);
  }

  if (/^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$/.test(volume)) {
    return joinAbsolutePath(`/storage/${volume}`, rest);
  }

  return null;
}

function mapDownloadsDocumentId(documentId: string): string | null {
  if (documentId.startsWith('raw:')) {
    const rawPath = documentId.slice('raw:'.length);
    return rawPath.startsWith('/') ? rawPath : null;
  }

  if (documentId === 'downloads' || documentId === 'download') {
    return '/storage/emulated/0/Download';
  }

  if (documentId.startsWith('downloads/') || documentId.startsWith('download/')) {
    const [, ...rest] = documentId.split('/');
    return joinAbsolutePath('/storage/emulated/0/Download', rest.join('/'));
  }

  const separatorIndex = documentId.indexOf(':');
  if (separatorIndex >= 0) {
    const volume = documentId.slice(0, separatorIndex);
    const rest = documentId.slice(separatorIndex + 1);
    if (volume === 'downloads' || volume === 'download') {
      return joinAbsolutePath('/storage/emulated/0/Download', rest);
    }
    return mapExternalStorageDocumentId(documentId);
  }

  return null;
}

export function safTreeUriToFileSystemPath(uri: string): string | null {
  if (!uri.startsWith('content://')) return null;

  const documentId = extractSafDocumentId(uri);
  if (!documentId) return null;

  const decodedDocumentId = safeDecodeUriPart(documentId).replace(/^\/+/, '');
  const authority = extractSafAuthority(uri);

  if (authority === 'com.android.providers.downloads.documents') {
    return mapDownloadsDocumentId(decodedDocumentId);
  }

  return mapExternalStorageDocumentId(decodedDocumentId);
}

class AndroidExternalStorageService {
  private getAndroidVersion(): number {
    return typeof Platform.Version === 'number'
      ? Platform.Version
      : Number.parseInt(String(Platform.Version), 10) || 0;
  }

  private getLegacyStoragePermissions(): string[] {
    const permissions = [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE];
    if (this.getAndroidVersion() <= 29) {
      permissions.push(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    }
    return permissions;
  }

  private async hasLegacyStoragePermissions(): Promise<boolean> {
    const results = await Promise.all(
      this.getLegacyStoragePermissions().map(permission => PermissionsAndroid.check(permission as any)),
    );
    return results.every(Boolean);
  }

  private async requestLegacyStoragePermissions(): Promise<boolean> {
    const permissions = this.getLegacyStoragePermissions();
    const result = await PermissionsAndroid.requestMultiple(permissions as any) as Record<string, string>;
    return permissions.every(permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED);
  }

  async isManageExternalStorageGranted(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    if (this.getAndroidVersion() < 30) {
      return this.hasLegacyStoragePermissions();
    }
    if (!StoragePermission?.isManageExternalStorageGranted) return false;
    return StoragePermission.isManageExternalStorageGranted();
  }

  getPermissionDeniedMessage(): string {
    if (Platform.OS === 'android' && this.getAndroidVersion() < 30) {
      return '缺少文件读写权限，无法访问外部项目目录。请允许 LineCode 读取和写入存储空间后重试。';
    }
    return '缺少“管理所有文件”权限，无法访问外部项目目录。';
  }

  async openManageExternalStorageSettings(): Promise<void> {
    if (Platform.OS !== 'android') return;

    if (StoragePermission?.openManageExternalStorageSettings) {
      await StoragePermission.openManageExternalStorageSettings();
      return;
    }

    await Linking.openSettings();
  }

  async ensureManageExternalStorageGranted(): Promise<void> {
    if (Platform.OS !== 'android') return;

    if (this.getAndroidVersion() < 30) {
      if (await this.hasLegacyStoragePermissions()) return;
      if (await this.requestLegacyStoragePermissions()) return;
      throw new Error('需要授予文件读写权限后才能访问文件。请允许 LineCode 读取和写入存储空间，然后重试。');
    }

    if (!StoragePermission?.isManageExternalStorageGranted) {
      throw new Error('当前 APK 缺少“管理所有文件”权限模块，请安装新版 APK 后再打开外部目录。');
    }

    if (await this.isManageExternalStorageGranted()) return;

    await this.openManageExternalStorageSettings().catch(() => {});
    throw new Error('需要开启“管理所有文件”权限后才能打开外部目录。请在系统设置中允许 LineCode 管理所有文件，然后返回重试。');
  }
}

export const androidExternalStorage = new AndroidExternalStorageService();

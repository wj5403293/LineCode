import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeModules, Platform } from 'react-native';
import RNFS from 'react-native-fs';
import { unzipWithPassword, zipWithPassword } from 'react-native-zip-archive';
import { APP_NAME, APP_VERSION } from '../constants/appInfo';
import { CONVERSATION_FILES_DIR } from './conversation';
import { DIFF_FILES_DIR } from './DiffService';
import { EVOLUTION_DB_DIR } from './evolution';
import { projectService } from './ProjectService';

const ARCHIVE_ROOT = `${RNFS.DocumentDirectoryPath}/.linecode/archive`;
const CONVERSATION_ARCHIVE_DIR = 'conversations';
const DIFF_ARCHIVE_DIR = 'diffs';
const SKILLS_ARCHIVE_DIR = 'skills';
const EVOLUTION_ARCHIVE_DIR = 'evolution';
const BACKUP_HEADER = 'LINECODE-BACKUP-v1\n';
const BACKUP_PASSWORD_SHA256 = '3b8c62235f137315bfc69ccd3080ce02ec14aba98b040be5716529f0e5357c83';
const ZIP_ENCRYPTION_METHOD = 'AES-256' as Parameters<typeof zipWithPassword>[3];

interface ArchiveManifestFile {
  path: string;
  sha256: string;
  size: number;
}

interface ArchiveManifest {
  format: 'linecode-backup';
  version: 1;
  appName: string;
  appVersion: string;
  exportedAt: string;
  files: ArchiveManifestFile[];
}

interface StorageEntry {
  key: string;
  value: string;
}

interface DataArchiveNativeModule {
  exportAsyncStorageDatabase(targetDir: string): Promise<number>;
  restoreAsyncStorageDatabase(sourceDir: string): Promise<number>;
}

const DataArchive = NativeModules.DataArchive as DataArchiveNativeModule | undefined;

async function ensureCleanDir(path: string): Promise<void> {
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
  await RNFS.mkdir(path);
}

async function copyDir(source: string, target: string): Promise<void> {
  if (!(await RNFS.exists(source))) return;
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

async function collectFiles(root: string, current = ''): Promise<ArchiveManifestFile[]> {
  const dir = current ? `${root}/${current}` : root;
  const items = await RNFS.readDir(dir);
  const files: ArchiveManifestFile[] = [];
  for (const item of items) {
    const relativePath = current ? `${current}/${item.name}` : item.name;
    if (item.isDirectory()) {
      files.push(...await collectFiles(root, relativePath));
    } else {
      files.push({
        path: relativePath,
        sha256: await RNFS.hash(item.path, 'sha256'),
        size: Number(item.size ?? 0),
      });
    }
  }
  return files;
}

function shouldExportKey(key: string): boolean {
  return key.startsWith('@lineai_') || key.startsWith('@linecode_');
}

function assertSafeManifestPath(path: string): void {
  if (!path || path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')) {
    throw new Error(`备份包包含非法文件路径: ${path}`);
  }
}

class DataArchiveService {
  async exportAllData(): Promise<string> {
    await RNFS.mkdir(ARCHIVE_ROOT);
    const workDir = `${ARCHIVE_ROOT}/export_${Date.now()}`;
    const payloadDir = `${workDir}/payload`;
    const zipPath = `${workDir}/payload.zip`;
    const archivePath = `${RNFS.DocumentDirectoryPath}/linecode_backup_${Date.now()}.linecode`;

    await ensureCleanDir(workDir);
    await RNFS.mkdir(payloadDir);

    try {
      await this.exportAsyncStorage(payloadDir);
      await copyDir(CONVERSATION_FILES_DIR, `${payloadDir}/${CONVERSATION_ARCHIVE_DIR}`);
      await copyDir(DIFF_FILES_DIR, `${payloadDir}/${DIFF_ARCHIVE_DIR}`);
      await copyDir(`${projectService.getLinecodeRoot()}/skills`, `${payloadDir}/${SKILLS_ARCHIVE_DIR}`);
      await copyDir(EVOLUTION_DB_DIR, `${payloadDir}/${EVOLUTION_ARCHIVE_DIR}`);
      const homeDir = await projectService.getCurrentHomePath();
      await copyDir(homeDir, `${payloadDir}/home`);

      const files = await collectFiles(payloadDir);
      const manifest: ArchiveManifest = {
        format: 'linecode-backup',
        version: 1,
        appName: APP_NAME,
        appVersion: APP_VERSION,
        exportedAt: new Date().toISOString(),
        files,
      };
      await RNFS.writeFile(`${payloadDir}/manifest.json`, JSON.stringify(manifest, null, 2), 'utf8');

      await zipWithPassword(payloadDir, zipPath, BACKUP_PASSWORD_SHA256, ZIP_ENCRYPTION_METHOD);
      const encryptedZip = await RNFS.readFile(zipPath, 'base64');
      await RNFS.writeFile(archivePath, `${BACKUP_HEADER}${encryptedZip}`, 'utf8');
      return archivePath;
    } finally {
      if (await RNFS.exists(workDir)) {
        await RNFS.unlink(workDir);
      }
    }
  }

  async importAllData(archivePath: string): Promise<void> {
    await RNFS.mkdir(ARCHIVE_ROOT);
    const workDir = `${ARCHIVE_ROOT}/import_${Date.now()}`;
    const zipPath = `${workDir}/payload.zip`;
    const payloadDir = `${workDir}/payload`;

    await ensureCleanDir(workDir);
    await RNFS.mkdir(payloadDir);

    try {
      const armored = await RNFS.readFile(archivePath, 'utf8');
      if (!armored.startsWith(BACKUP_HEADER)) {
        throw new Error('不是有效的 LineCode 数据包');
      }
      await RNFS.writeFile(zipPath, armored.slice(BACKUP_HEADER.length), 'base64');
      await unzipWithPassword(zipPath, payloadDir, BACKUP_PASSWORD_SHA256);
      await this.verifyManifest(payloadDir);
      await this.restoreAsyncStorage(payloadDir);
      await this.restoreConversationFiles(payloadDir);
      await this.restoreDiffFiles(payloadDir);
      await this.restoreGlobalSkills(payloadDir);
      await this.restoreEvolutionFiles(payloadDir);
      const homeDir = await projectService.getCurrentHomePath();
      await ensureCleanDir(homeDir);
      await copyDir(`${payloadDir}/home`, homeDir);
    } finally {
      if (await RNFS.exists(workDir)) {
        await RNFS.unlink(workDir);
      }
    }
  }

  private async restoreConversationFiles(payloadDir: string): Promise<void> {
    const source = `${payloadDir}/${CONVERSATION_ARCHIVE_DIR}`;
    await ensureCleanDir(CONVERSATION_FILES_DIR);
    if (!(await RNFS.exists(source))) return;
    await copyDir(source, CONVERSATION_FILES_DIR);
  }

  private async restoreDiffFiles(payloadDir: string): Promise<void> {
    const source = `${payloadDir}/${DIFF_ARCHIVE_DIR}`;
    await ensureCleanDir(DIFF_FILES_DIR);
    if (!(await RNFS.exists(source))) return;
    await copyDir(source, DIFF_FILES_DIR);
  }

  private async restoreGlobalSkills(payloadDir: string): Promise<void> {
    const source = `${payloadDir}/${SKILLS_ARCHIVE_DIR}`;
    const target = `${projectService.getLinecodeRoot()}/skills`;
    await ensureCleanDir(target);
    if (!(await RNFS.exists(source))) return;
    await copyDir(source, target);
  }

  private async restoreEvolutionFiles(payloadDir: string): Promise<void> {
    const source = `${payloadDir}/${EVOLUTION_ARCHIVE_DIR}`;
    await ensureCleanDir(EVOLUTION_DB_DIR);
    if (!(await RNFS.exists(source))) return;
    await copyDir(source, EVOLUTION_DB_DIR);
  }

  private async exportAsyncStorage(payloadDir: string): Promise<void> {
    if (Platform.OS === 'android' && DataArchive?.exportAsyncStorageDatabase) {
      const dbDir = `${payloadDir}/async-storage-db`;
      await RNFS.mkdir(dbDir);
      const copied = await DataArchive.exportAsyncStorageDatabase(dbDir);
      if (copied > 0) {
        return;
      }
      await RNFS.unlink(dbDir);
    }

    const keys = (await AsyncStorage.getAllKeys()).filter(shouldExportKey);
    const pairs = await AsyncStorage.multiGet(keys);
    const entries = pairs
      .filter((pair): pair is [string, string] => typeof pair[1] === 'string')
      .map(([key, value]) => ({ key, value }));
    await RNFS.writeFile(`${payloadDir}/async-storage.json`, JSON.stringify(entries, null, 2), 'utf8');
  }

  private async restoreAsyncStorage(payloadDir: string): Promise<void> {
    const dbDir = `${payloadDir}/async-storage-db`;
    if (await RNFS.exists(dbDir)) {
      if (Platform.OS !== 'android' || !DataArchive?.restoreAsyncStorageDatabase) {
        throw new Error('此备份包含 Android AsyncStorage 数据库，需要在 Android 设备上导入。');
      }
      await DataArchive.restoreAsyncStorageDatabase(dbDir);
      return;
    }

    const path = `${payloadDir}/async-storage.json`;
    if (!(await RNFS.exists(path))) {
      throw new Error('备份包缺少 AsyncStorage 数据');
    }
    const entries = JSON.parse(await RNFS.readFile(path, 'utf8')) as StorageEntry[];
    const nextEntries = entries.filter(entry => typeof entry.key === 'string' && typeof entry.value === 'string');
    const existingKeys = (await AsyncStorage.getAllKeys()).filter(shouldExportKey);
    if (existingKeys.length > 0) {
      await AsyncStorage.multiRemove(existingKeys);
    }
    if (nextEntries.length > 0) {
      await AsyncStorage.multiSet(nextEntries.map(entry => [entry.key, entry.value]));
    }
  }

  private async verifyManifest(payloadDir: string): Promise<void> {
    const manifestPath = `${payloadDir}/manifest.json`;
    if (!(await RNFS.exists(manifestPath))) {
      throw new Error('备份包缺少 manifest.json');
    }
    const manifest = JSON.parse(await RNFS.readFile(manifestPath, 'utf8')) as ArchiveManifest;
    if (manifest.format !== 'linecode-backup' || manifest.version !== 1) {
      throw new Error('备份包格式不兼容');
    }
    for (const file of manifest.files) {
      assertSafeManifestPath(file.path);
      const target = `${payloadDir}/${file.path}`;
      if (!(await RNFS.exists(target))) {
        throw new Error(`备份包缺少文件: ${file.path}`);
      }
      const actual = await RNFS.hash(target, 'sha256');
      if (actual.toLowerCase() !== file.sha256.toLowerCase()) {
        throw new Error(`备份文件校验失败: ${file.path}`);
      }
    }
  }
}

export const dataArchiveService = new DataArchiveService();

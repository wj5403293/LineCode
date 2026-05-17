import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { DiffRecord } from '../types';
import { workspaceFs } from './WorkspaceFileSystem';

const STORAGE_KEY = '@linecode_diffs';
const DIFF_SCHEMA_VERSION = 2;

export const DIFF_FILES_DIR = `${RNFS.DocumentDirectoryPath}/.linecode/diffs`;

interface FileBackedDiffRecord {
  storage: 'file';
  schemaVersion: 2;
  id: string;
  filePath: string;
  oldContentFile: string;
  newContentFile: string;
  oldSize: number;
  newSize: number;
  oldExists?: boolean;
  timestamp: number;
  reverted: boolean;
}

type StoredDiffRecord = DiffRecord | FileBackedDiffRecord;

class DiffService {
  async recordDiff(filePath: string, oldContent: string, newContent: string, oldExists = true): Promise<DiffRecord> {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const oldContentFile = `${id}.old.txt`;
    const newContentFile = `${id}.new.txt`;
    const storedRecord: FileBackedDiffRecord = {
      storage: 'file',
      schemaVersion: DIFF_SCHEMA_VERSION,
      id,
      filePath,
      oldContentFile,
      newContentFile,
      oldSize: oldContent.length,
      newSize: newContent.length,
      oldExists,
      timestamp: Date.now(),
      reverted: false,
    };

    await RNFS.mkdir(DIFF_FILES_DIR, { NSURLIsExcludedFromBackupKey: true });
    await RNFS.writeFile(this.diffContentPath(oldContentFile), oldContent, 'utf8');
    await RNFS.writeFile(this.diffContentPath(newContentFile), newContent, 'utf8');

    try {
      const all = await this.getAllStoredDiffs();
      all.push(storedRecord);
      await this.saveStoredDiffs(all);
    } catch (err) {
      await this.unlinkIfExists(this.diffContentPath(oldContentFile)).catch(() => {});
      await this.unlinkIfExists(this.diffContentPath(newContentFile)).catch(() => {});
      throw err;
    }

    return { ...storedRecord, oldContent, newContent };
  }

  async getDiffChain(filePath: string): Promise<DiffRecord[]> {
    const all = await this.getAllDiffs();
    return all
      .filter(d => d.filePath === filePath)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getDiff(diffId: string): Promise<DiffRecord | null> {
    const all = await this.getAllDiffs();
    return all.find(d => d.id === diffId) || null;
  }

  async revertLast(filePath: string): Promise<{ success: boolean; message: string }> {
    const chain = await this.getDiffChain(filePath);
    const last = chain.filter(d => !d.reverted).pop();

    if (!last) {
      return { success: false, message: '没有可撤销的修改' };
    }

    try {
      await this.restoreOldContent(last);

      // 标记为已撤销
      last.reverted = true;
      await this.updateAllDiffs(all => {
        const idx = all.findIndex(d => d.id === last.id);
        if (idx >= 0) all[idx].reverted = true;
        return all;
      });

      return { success: true, message: `已撤销对 ${filePath} 的修改` };
    } catch (err: any) {
      return { success: false, message: `撤销失败: ${err.message}` };
    }
  }

  async revertTo(filePath: string, diffId: string): Promise<{ success: boolean; message: string }> {
    const chain = await this.getDiffChain(filePath);
    const targetIdx = chain.findIndex(d => d.id === diffId);

    if (targetIdx < 0) {
      return { success: false, message: '未找到指定的修改记录' };
    }

    const target = chain[targetIdx];
    try {
      await this.restoreOldContent(target);

      // 标记 target 及之后的所有记录为已撤销
      await this.updateAllDiffs(all => {
        for (let i = targetIdx; i < chain.length; i++) {
          const idx = all.findIndex(d => d.id === chain[i].id);
          if (idx >= 0) all[idx].reverted = true;
        }
        return all;
      });

      return { success: true, message: `已撤销到指定版本` };
    } catch (err: any) {
      return { success: false, message: `撤销失败: ${err.message}` };
    }
  }

  async revertDiff(diffId: string): Promise<{ success: boolean; message: string }> {
    const target = await this.getDiff(diffId);
    if (!target) {
      return { success: false, message: '未找到指定的修改记录' };
    }
    if (target.reverted) {
      return { success: true, message: '此修改已撤销' };
    }

    const chain = await this.getDiffChain(target.filePath);
    const targetIdx = chain.findIndex(d => d.id === diffId);
    const laterActive = chain.slice(targetIdx + 1).some(d => !d.reverted);
    if (laterActive) {
      return { success: false, message: '请先撤销此文件后续的修改' };
    }

    try {
      await this.restoreOldContent(target);

      await this.updateAllDiffs(all => {
        const idx = all.findIndex(d => d.id === diffId);
        if (idx >= 0) all[idx].reverted = true;
        return all;
      });

      return { success: true, message: `已撤销对 ${target.filePath} 的修改` };
    } catch (err: any) {
      return { success: false, message: `撤销失败: ${err.message}` };
    }
  }

  async clearDiffs(filePath?: string): Promise<void> {
    if (filePath) {
      const all = await this.getAllStoredDiffs();
      const kept = all.filter(d => d.filePath !== filePath);
      const removed = all.filter(d => d.filePath === filePath);
      await this.saveStoredDiffs(kept);
      await Promise.all(removed.map(record => this.deleteDiffFiles(record)));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
      await this.unlinkIfExists(DIFF_FILES_DIR);
    }
  }

  private async getAllDiffs(): Promise<DiffRecord[]> {
    const stored = await this.getAllStoredDiffs();
    return Promise.all(stored.map(record => this.hydrateDiffRecord(record)));
  }

  private async updateAllDiffs(updater: (all: DiffRecord[]) => DiffRecord[]): Promise<void> {
    const stored = await this.getAllStoredDiffs();
    const hydrated = await Promise.all(stored.map(record => this.hydrateDiffRecord(record)));
    const updated = updater(hydrated);
    const updatedById = new Map(updated.map(record => [record.id, record]));
    const nextStored: StoredDiffRecord[] = [];

    for (const record of stored) {
      const updatedRecord = updatedById.get(record.id);
      if (!updatedRecord) continue;

      if (this.isFileBackedRecord(record)) {
        nextStored.push({
          ...record,
          filePath: updatedRecord.filePath,
          oldExists: updatedRecord.oldExists,
          timestamp: updatedRecord.timestamp,
          reverted: updatedRecord.reverted,
        });
      } else {
        nextStored.push(updatedRecord);
      }
      updatedById.delete(record.id);
    }

    for (const record of updatedById.values()) {
      nextStored.push(record);
    }

    await this.saveStoredDiffs(nextStored);
  }

  private async restoreOldContent(record: DiffRecord): Promise<void> {
    if (record.oldExists === false) {
      const exists = await workspaceFs.exists(record.filePath);
      if (exists) {
        await workspaceFs.unlink(record.filePath);
      }
      return;
    }

    const dir = workspaceFs.parentPath(record.filePath);
    if (dir) {
      const dirExists = await workspaceFs.exists(dir);
      if (!dirExists) {
        await workspaceFs.mkdir(dir);
      }
    }
    await workspaceFs.writeFile(record.filePath, record.oldContent);
  }

  private async getAllStoredDiffs(): Promise<StoredDiffRecord[]> {
    let json: string | null = null;
    try {
      json = await AsyncStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.error('[LineCode] Failed to read diff manifest, clearing legacy value:', err);
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      return [];
    }

    if (!json) return [];

    try {
      const parsed = JSON.parse(json) as StoredDiffRecord[];
      if (!Array.isArray(parsed)) return [];
      if (parsed.every(record => this.isFileBackedRecord(record))) {
        return parsed;
      }
      return this.migrateLegacyDiffs(parsed);
    } catch {
      await AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
      return [];
    }
  }

  private async migrateLegacyDiffs(records: StoredDiffRecord[]): Promise<FileBackedDiffRecord[]> {
    const migrated: FileBackedDiffRecord[] = [];
    await RNFS.mkdir(DIFF_FILES_DIR, { NSURLIsExcludedFromBackupKey: true });

    for (const rawRecord of records) {
      if (this.isFileBackedRecord(rawRecord)) {
        migrated.push(rawRecord);
        continue;
      }

      const record = rawRecord as DiffRecord;
      if (!record?.id || typeof record.filePath !== 'string') continue;

      const oldContent = String(record.oldContent || '');
      const newContent = String(record.newContent || '');
      const oldContentFile = `${this.safeId(record.id)}.old.txt`;
      const newContentFile = `${this.safeId(record.id)}.new.txt`;
      await RNFS.writeFile(this.diffContentPath(oldContentFile), oldContent, 'utf8');
      await RNFS.writeFile(this.diffContentPath(newContentFile), newContent, 'utf8');
      migrated.push({
        storage: 'file',
        schemaVersion: DIFF_SCHEMA_VERSION,
        id: record.id,
        filePath: record.filePath,
        oldContentFile,
        newContentFile,
        oldSize: oldContent.length,
        newSize: newContent.length,
        oldExists: record.oldExists,
        timestamp: Number(record.timestamp || Date.now()),
        reverted: !!record.reverted,
      });
    }

    await this.saveStoredDiffs(migrated);
    return migrated;
  }

  private async hydrateDiffRecord(record: StoredDiffRecord): Promise<DiffRecord> {
    if (!this.isFileBackedRecord(record)) {
      return record as DiffRecord;
    }

    return {
      id: record.id,
      filePath: record.filePath,
      oldContent: await this.readDiffContent(record.oldContentFile),
      newContent: await this.readDiffContent(record.newContentFile),
      oldExists: record.oldExists,
      timestamp: record.timestamp,
      reverted: record.reverted,
    };
  }

  private saveStoredDiffs(records: StoredDiffRecord[]): Promise<void> {
    return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }

  private isFileBackedRecord(record: StoredDiffRecord): record is FileBackedDiffRecord {
    return !!record &&
      (record as FileBackedDiffRecord).storage === 'file' &&
      (record as FileBackedDiffRecord).schemaVersion === DIFF_SCHEMA_VERSION &&
      typeof (record as FileBackedDiffRecord).oldContentFile === 'string' &&
      typeof (record as FileBackedDiffRecord).newContentFile === 'string';
  }

  private diffContentPath(fileName: string): string {
    return `${DIFF_FILES_DIR}/${fileName}`;
  }

  private readDiffContent(fileName: string): Promise<string> {
    return RNFS.readFile(this.diffContentPath(fileName), 'utf8');
  }

  private async deleteDiffFiles(record: StoredDiffRecord): Promise<void> {
    if (!this.isFileBackedRecord(record)) return;
    await this.unlinkIfExists(this.diffContentPath(record.oldContentFile));
    await this.unlinkIfExists(this.diffContentPath(record.newContentFile));
  }

  private async unlinkIfExists(path: string): Promise<void> {
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  }

  private safeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_') || `${Date.now()}`;
  }
}

export const diffService = new DiffService();

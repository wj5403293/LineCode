import AsyncStorage from '@react-native-async-storage/async-storage';
import { DiffRecord } from '../types';
import { workspaceFs } from './WorkspaceFileSystem';

const STORAGE_KEY = '@linecode_diffs';

class DiffService {
  async recordDiff(filePath: string, oldContent: string, newContent: string, oldExists = true): Promise<DiffRecord> {
    const record: DiffRecord = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      filePath,
      oldContent,
      newContent,
      oldExists,
      timestamp: Date.now(),
      reverted: false,
    };

    const all = await this.getAllDiffs();
    all.push(record);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));

    return record;
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
      await this.updateAllDiffs(all => all.filter(d => d.filePath !== filePath));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }

  private async getAllDiffs(): Promise<DiffRecord[]> {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  }

  private async updateAllDiffs(updater: (all: DiffRecord[]) => DiffRecord[]): Promise<void> {
    const all = await this.getAllDiffs();
    const updated = updater(all);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  private async restoreOldContent(record: DiffRecord): Promise<void> {
    if (record.oldExists === false) {
      const exists = await workspaceFs.exists(record.filePath);
      if (exists) {
        await workspaceFs.unlink(record.filePath);
      }
      return;
    }

    const dir = record.filePath.substring(0, record.filePath.lastIndexOf('/'));
    if (dir) {
      const dirExists = await workspaceFs.exists(dir);
      if (!dirExists) {
        await workspaceFs.mkdir(dir);
      }
    }
    await workspaceFs.writeFile(record.filePath, record.oldContent);
  }
}

export const diffService = new DiffService();

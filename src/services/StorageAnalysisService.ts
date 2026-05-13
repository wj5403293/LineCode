import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { projectService } from './ProjectService';
import { workspaceFs } from './WorkspaceFileSystem';

export interface StorageCategory {
  id: string;
  label: string;
  desc: string;
  bytes: number;
  items: number;
}

export interface StorageAnalysis {
  totalBytes: number;
  categories: StorageCategory[];
  generatedAt: number;
}

function byteLength(value: string): number {
  let size = 0;
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x7f) size += 1;
    else if (code <= 0x7ff) size += 2;
    else if (code >= 0xd800 && code <= 0xdfff) {
      size += 4;
      i += 1;
    } else {
      size += 3;
    }
  }
  return size;
}

function matchCategory(key: string): StorageCategory['id'] {
  if (key === '@linecode_diffs') return 'diffs';
  if (key === '@lineai_conversation_list' || key === '@lineai_current_conversation' || key.startsWith('@lineai_conv_')) return 'chats';
  if (key.includes('model') || key.includes('mcp') || key.includes('web_search') || key.includes('settings') || key.includes('theme') || key.includes('permission')) return 'config';
  return 'config';
}

function formatDesc(keys: number, prefix: string): string {
  return `${prefix}，${keys} 个存储键`;
}

class StorageAnalysisService {
  async analyze(): Promise<StorageAnalysis> {
    const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith('@lineai_') || key.startsWith('@linecode_'));
    const pairs = await AsyncStorage.multiGet(keys);
    const buckets: Record<string, { bytes: number; items: number }> = {
      diffs: { bytes: 0, items: 0 },
      chats: { bytes: 0, items: 0 },
      config: { bytes: 0, items: 0 },
    };

    for (const [key, value] of pairs) {
      const id = matchCategory(key);
      buckets[id].items += 1;
      buckets[id].bytes += byteLength(value || '');
    }

    const homePath = await projectService.getCurrentHomePath();
    const homeStats = await workspaceFs.getDirStats(homePath).catch(() => ({ bytes: 0, files: 0, directories: 0 }));
    const linecodeStats = await this.analyzeInternalLinecode(homePath);

    const categories: StorageCategory[] = [
      {
        id: 'diffs',
        label: 'Diff',
        desc: formatDesc(buckets.diffs.items, '文件修改记录'),
        bytes: buckets.diffs.bytes,
        items: buckets.diffs.items,
      },
      {
        id: 'chats',
        label: '聊天记录',
        desc: formatDesc(buckets.chats.items, '会话索引与消息内容'),
        bytes: buckets.chats.bytes,
        items: buckets.chats.items,
      },
      {
        id: 'config',
        label: '配置',
        desc: formatDesc(buckets.config.items, '模型、MCP、主题和应用设置'),
        bytes: buckets.config.bytes,
        items: buckets.config.items,
      },
      {
        id: 'home',
        label: 'Home 目录',
        desc: `${homeStats.files} 个文件，${homeStats.directories} 个目录`,
        bytes: homeStats.bytes,
        items: homeStats.files + homeStats.directories,
      },
      {
        id: 'linecode',
        label: '.linecode 内部目录',
        desc: `${linecodeStats.files} 个文件，${linecodeStats.directories} 个目录，不含当前 home`,
        bytes: linecodeStats.bytes,
        items: linecodeStats.files + linecodeStats.directories,
      },
    ];

    return {
      categories,
      totalBytes: categories.reduce((sum, item) => sum + item.bytes, 0),
      generatedAt: Date.now(),
    };
  }

  private async analyzeInternalLinecode(currentHomePath: string) {
    const root = projectService.getLinecodeRoot();
    if (!(await RNFS.exists(root))) return { bytes: 0, files: 0, directories: 0 };

    const stats = { bytes: 0, files: 0, directories: 1 };
    const visit = async (dir: string): Promise<void> => {
      const items = await RNFS.readDir(dir);
      for (const item of items) {
        if (item.path === currentHomePath || item.path.startsWith(`${currentHomePath}/`)) continue;
        if (item.isDirectory()) {
          stats.directories += 1;
          await visit(item.path);
        } else {
          stats.files += 1;
          stats.bytes += Number(item.size || 0);
        }
      }
    };
    await visit(root);
    return stats;
  }
}

export const storageAnalysisService = new StorageAnalysisService();

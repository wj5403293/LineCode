import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { Message } from '../types';

const KEYS = {
  CONVERSATION_LIST: '@lineai_conversation_list',
  CURRENT: '@lineai_current_conversation',
  CONVERSATION_PREFIX: '@lineai_conv_',
  CONVERSATION_CHUNK_PREFIX: '@lineai_conv_chunk_',
} as const;

export const CONVERSATION_FILES_DIR = `${RNFS.DocumentDirectoryPath}/.linecode/conversations`;

interface ConversationChunkManifest {
  chunked: true;
  id: string;
  chunks: number;
  size: number;
}

interface ConversationFileManifest {
  storage: 'file';
  version: 1;
  id: string;
  fileName: string;
  size: number;
  updatedAt: number;
}

export interface ConversationMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface Conversation extends ConversationMeta {
  messages: Message[];
}

class ConversationStore {
  private cache: Map<string, Conversation> = new Map();
  private writeQueues: Map<string, Promise<void>> = new Map();

  async getConversationList(): Promise<ConversationMeta[]> {
    const json = await AsyncStorage.getItem(KEYS.CONVERSATION_LIST);
    return json ? JSON.parse(json) : [];
  }

  private async saveConversationList(list: ConversationMeta[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.CONVERSATION_LIST, JSON.stringify(list));
  }

  async getConversation(id: string): Promise<Conversation | null> {
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    try {
      const json = await AsyncStorage.getItem(KEYS.CONVERSATION_PREFIX + id);
      if (json) {
        const parsed = JSON.parse(json) as Conversation | ConversationChunkManifest | ConversationFileManifest;
        const conv = await this.readConversationFromStoredValue(id, parsed, json);
        this.cache.set(id, conv);
        return conv;
      }
    } catch (err) {
      console.error('[LineCode] Failed to get conversation:', id, err);
    }
    return null;
  }

  private async saveConversation(conv: Conversation): Promise<void> {
    this.cache.set(conv.id, conv);
    await this.enqueueConversationWrite(conv.id, () => this.writeConversationData(conv));
  }

  private async enqueueConversationWrite(id: string, write: () => Promise<void>): Promise<void> {
    const previous = this.writeQueues.get(id) || Promise.resolve();
    const queued = previous
      .catch(() => {})
      .then(write);
    const tracked = queued.catch(() => {}).finally(() => {
      if (this.writeQueues.get(id) === tracked) {
        this.writeQueues.delete(id);
      }
    });
    this.writeQueues.set(id, tracked);
    await queued;
  }

  private async deleteConversationData(id: string): Promise<void> {
    this.cache.delete(id);
    try {
      await this.deleteConversationFile(id);
      await this.deleteConversationChunks(id);
      await AsyncStorage.removeItem(KEYS.CONVERSATION_PREFIX + id);
    } catch (err) {
      console.error('[LineCode] Failed to delete conversation:', id, err);
    }
  }

  async getConversationMetas(): Promise<ConversationMeta[]> {
    return this.getConversationList();
  }

  async getConversations(): Promise<Conversation[]> {
    const list = await this.getConversationList();
    const conversations: Conversation[] = [];
    for (const meta of list) {
      const conv = await this.getConversation(meta.id);
      if (conv) {
        conversations.push(conv);
      } else {
        conversations.push({ ...meta, messages: [] });
      }
    }
    return conversations;
  }

  async getCurrentConversationId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.CURRENT);
  }

  async setCurrentConversationId(id: string): Promise<void> {
    if (id) {
      await AsyncStorage.setItem(KEYS.CURRENT, id);
    } else {
      await AsyncStorage.removeItem(KEYS.CURRENT);
    }
  }

  async createConversation(): Promise<Conversation> {
    const now = Date.now();
    const conv: Conversation = {
      id: String(now),
      title: '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    const list = await this.getConversationList();
    list.unshift({ id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt });
    await this.saveConversationList(list);
    await this.saveConversation(conv);
    await this.setCurrentConversationId(conv.id);
    return conv;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    const conv = await this.getConversation(id);
    if (conv) {
      const updated: Conversation = { ...conv, ...updates, updatedAt: Date.now() };
      await this.saveConversation(updated);

      const list = await this.getConversationList();
      const index = list.findIndex(m => m.id === id);
      if (index >= 0) {
        list[index] = { id: updated.id, title: updated.title, createdAt: updated.createdAt, updatedAt: updated.updatedAt };
        await this.saveConversationList(list);
      }
    }
  }

  async deleteConversation(id: string): Promise<void> {
    const list = await this.getConversationList();
    const filtered = list.filter(m => m.id !== id);
    await this.saveConversationList(filtered);
    await this.deleteConversationData(id);
  }

  async clearAll(): Promise<void> {
    const list = await this.getConversationList();
    for (const meta of list) {
      await this.deleteConversationData(meta.id);
    }
    await AsyncStorage.removeItem(KEYS.CONVERSATION_LIST);
    await AsyncStorage.removeItem(KEYS.CURRENT);
    this.cache.clear();
  }

  private isChunkManifest(value: Conversation | ConversationChunkManifest | ConversationFileManifest): value is ConversationChunkManifest {
    return !!value && (value as ConversationChunkManifest).chunked === true;
  }

  private isFileManifest(value: Conversation | ConversationChunkManifest | ConversationFileManifest): value is ConversationFileManifest {
    return !!value && (value as ConversationFileManifest).storage === 'file';
  }

  private chunkKey(id: string, index: number): string {
    return `${KEYS.CONVERSATION_CHUNK_PREFIX}${id}_${index}`;
  }

  private fileName(id: string): string {
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_') || 'conversation';
    return `${safeId}.json`;
  }

  private filePath(id: string): string {
    return `${CONVERSATION_FILES_DIR}/${this.fileName(id)}`;
  }

  private backupFilePath(id: string): string {
    return `${this.filePath(id)}.bak`;
  }

  private async writeConversationData(conv: Conversation): Promise<void> {
    const json = JSON.stringify(conv);
    await this.writeConversationFile(conv.id, json);
    const manifest: ConversationFileManifest = {
      storage: 'file',
      version: 1,
      id: conv.id,
      fileName: this.fileName(conv.id),
      size: json.length,
      updatedAt: conv.updatedAt,
    };
    await AsyncStorage.setItem(KEYS.CONVERSATION_PREFIX + conv.id, JSON.stringify(manifest));
  }

  private async writeConversationFile(id: string, json: string): Promise<void> {
    await RNFS.mkdir(CONVERSATION_FILES_DIR, { NSURLIsExcludedFromBackupKey: true });
    const target = this.filePath(id);
    const backup = this.backupFilePath(id);
    const temp = `${target}.${Date.now()}_${Math.random().toString(36).slice(2, 8)}.tmp`;

    await RNFS.writeFile(temp, json, 'utf8');
    try {
      await this.unlinkIfExists(backup);
      if (await RNFS.exists(target)) {
        await RNFS.moveFile(target, backup);
      }
      await RNFS.moveFile(temp, target);
      await this.unlinkIfExists(backup);
    } catch (err) {
      await this.unlinkIfExists(temp).catch(() => {});
      if (!(await RNFS.exists(target)) && await RNFS.exists(backup)) {
        await RNFS.moveFile(backup, target).catch(() => {});
      }
      throw err;
    }
  }

  private async readConversationFromStoredValue(
    id: string,
    parsed: Conversation | ConversationChunkManifest | ConversationFileManifest,
    storedJson: string,
  ): Promise<Conversation> {
    if (this.isFileManifest(parsed)) {
      return this.readFileConversation(parsed);
    }

    if (this.isChunkManifest(parsed)) {
      const conv = await this.readChunkedConversation(parsed);
      this.migrateLegacyConversation(conv, 'chunked', storedJson).catch(err => {
        console.error('[LineCode] Failed to migrate chunked conversation:', id, err);
      });
      return conv;
    }

    const conv = parsed as Conversation;
    this.migrateLegacyConversation(conv, 'inline', storedJson).catch(err => {
      console.error('[LineCode] Failed to migrate inline conversation:', id, err);
    });
    return conv;
  }

  private async readFileConversation(manifest: ConversationFileManifest): Promise<Conversation> {
    const target = `${CONVERSATION_FILES_DIR}/${manifest.fileName || this.fileName(manifest.id)}`;
    try {
      return JSON.parse(await RNFS.readFile(target, 'utf8')) as Conversation;
    } catch (err) {
      const backup = this.backupFilePath(manifest.id);
      if (await RNFS.exists(backup)) {
        return JSON.parse(await RNFS.readFile(backup, 'utf8')) as Conversation;
      }
      throw err;
    }
  }

  private async migrateLegacyConversation(conv: Conversation, source: 'inline' | 'chunked', legacyJson: string): Promise<void> {
    if (!conv?.id) return;
    await this.enqueueConversationWrite(conv.id, async () => {
      const currentJson = await AsyncStorage.getItem(KEYS.CONVERSATION_PREFIX + conv.id);
      if (currentJson !== legacyJson) return;

      let chunkKeys: string[] = [];
      if (source === 'chunked') {
        chunkKeys = await this.getConversationChunkKeys(conv.id);
      }
      await this.writeConversationData(conv);
      if (chunkKeys.length > 0) {
        await AsyncStorage.multiRemove(chunkKeys);
      }
    });
  }

  private async readChunkedConversation(manifest: ConversationChunkManifest): Promise<Conversation> {
    const keys = Array.from({ length: manifest.chunks }, (_, index) => this.chunkKey(manifest.id, index));
    const pairs = await AsyncStorage.multiGet(keys);
    const chunks = pairs.map(([key, value]) => {
      if (value === null) {
        throw new Error(`Conversation chunk missing: ${key}`);
      }
      return value;
    });
    const json = chunks.join('');
    return JSON.parse(json) as Conversation;
  }

  private async deleteConversationChunks(id: string): Promise<void> {
    const keys = await this.getConversationChunkKeys(id);
    if (keys.length > 0) {
      await AsyncStorage.multiRemove(keys);
    }
  }

  private async getConversationChunkKeys(id: string): Promise<string[]> {
    const json = await AsyncStorage.getItem(KEYS.CONVERSATION_PREFIX + id);
    if (!json) return [];

    try {
      const parsed = JSON.parse(json) as Conversation | ConversationChunkManifest | ConversationFileManifest;
      if (!this.isChunkManifest(parsed)) return [];
      return Array.from({ length: parsed.chunks }, (_, index) => this.chunkKey(id, index));
    } catch {
      // Legacy or corrupt entries have no managed chunks to delete.
      return [];
    }
  }

  private async deleteConversationFile(id: string): Promise<void> {
    const json = await AsyncStorage.getItem(KEYS.CONVERSATION_PREFIX + id);
    if (json) {
      try {
        const parsed = JSON.parse(json) as Conversation | ConversationChunkManifest | ConversationFileManifest;
        if (this.isFileManifest(parsed)) {
          await this.unlinkIfExists(`${CONVERSATION_FILES_DIR}/${parsed.fileName}`);
          await this.unlinkIfExists(`${CONVERSATION_FILES_DIR}/${parsed.fileName}.bak`);
          return;
        }
      } catch {
      }
    }
    await this.unlinkIfExists(this.filePath(id));
    await this.unlinkIfExists(this.backupFilePath(id));
  }

  private async unlinkIfExists(path: string): Promise<void> {
    if (await RNFS.exists(path)) {
      await RNFS.unlink(path);
    }
  }
}

export const conversationStore = new ConversationStore();

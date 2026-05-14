import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../types';

const KEYS = {
  CONVERSATION_LIST: '@lineai_conversation_list',
  CURRENT: '@lineai_current_conversation',
  CONVERSATION_PREFIX: '@lineai_conv_',
  CONVERSATION_CHUNK_PREFIX: '@lineai_conv_chunk_',
} as const;

const CHUNK_SIZE = 512 * 1024;

interface ConversationChunkManifest {
  chunked: true;
  id: string;
  chunks: number;
  size: number;
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
        const parsed = JSON.parse(json) as Conversation | ConversationChunkManifest;
        const conv = this.isChunkManifest(parsed)
          ? await this.readChunkedConversation(parsed)
          : parsed as Conversation;
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
    try {
      await this.writeConversationData(conv);
    } catch (err) {
      console.error('[LineCode] Failed to save conversation:', conv.id, err);
    }
  }

  private async deleteConversationData(id: string): Promise<void> {
    this.cache.delete(id);
    try {
      await this.deleteConversationChunks(id);
      await AsyncStorage.removeItem(KEYS.CONVERSATION_PREFIX + id);
    } catch (err) {
      console.error('[LineCode] Failed to delete conversation:', id, err);
    }
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

  private isChunkManifest(value: Conversation | ConversationChunkManifest): value is ConversationChunkManifest {
    return !!value && (value as ConversationChunkManifest).chunked === true;
  }

  private chunkKey(id: string, index: number): string {
    return `${KEYS.CONVERSATION_CHUNK_PREFIX}${id}_${index}`;
  }

  private async writeConversationData(conv: Conversation): Promise<void> {
    const json = JSON.stringify(conv);
    await this.deleteConversationChunks(conv.id);

    if (json.length <= CHUNK_SIZE) {
      await AsyncStorage.setItem(KEYS.CONVERSATION_PREFIX + conv.id, json);
      return;
    }

    const chunks: [string, string][] = [];
    for (let offset = 0; offset < json.length; offset += CHUNK_SIZE) {
      chunks.push([this.chunkKey(conv.id, chunks.length), json.slice(offset, offset + CHUNK_SIZE)]);
    }

    await AsyncStorage.multiSet(chunks);
    await AsyncStorage.setItem(KEYS.CONVERSATION_PREFIX + conv.id, JSON.stringify({
      chunked: true,
      id: conv.id,
      chunks: chunks.length,
      size: json.length,
    } satisfies ConversationChunkManifest));
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
    const json = await AsyncStorage.getItem(KEYS.CONVERSATION_PREFIX + id);
    if (!json) return;

    try {
      const parsed = JSON.parse(json) as Conversation | ConversationChunkManifest;
      if (!this.isChunkManifest(parsed)) return;
      const keys = Array.from({ length: parsed.chunks }, (_, index) => this.chunkKey(id, index));
      await AsyncStorage.multiRemove(keys);
    } catch {
      // Legacy or corrupt entries have no managed chunks to delete.
    }
  }
}

export const conversationStore = new ConversationStore();

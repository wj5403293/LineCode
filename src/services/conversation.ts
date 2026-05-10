import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../types';

const KEYS = {
  CONVERSATIONS: '@lineai_conversations',
  CURRENT: '@lineai_current_conversation',
} as const;

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

class ConversationStore {
  async getConversations(): Promise<Conversation[]> {
    const json = await AsyncStorage.getItem(KEYS.CONVERSATIONS);
    return json ? JSON.parse(json) : [];
  }

  async saveConversations(conversations: Conversation[]): Promise<void> {
    await AsyncStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(conversations));
  }

  async getCurrentConversationId(): Promise<string | null> {
    return AsyncStorage.getItem(KEYS.CURRENT);
  }

  async setCurrentConversationId(id: string): Promise<void> {
    await AsyncStorage.setItem(KEYS.CURRENT, id);
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
    const conversations = await this.getConversations();
    conversations.unshift(conv);
    await this.saveConversations(conversations);
    await this.setCurrentConversationId(conv.id);
    return conv;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
    const conversations = await this.getConversations();
    const index = conversations.findIndex(c => c.id === id);
    if (index >= 0) {
      conversations[index] = { ...conversations[index], ...updates, updatedAt: Date.now() };
      await this.saveConversations(conversations);
    }
  }

  async deleteConversation(id: string): Promise<void> {
    const conversations = await this.getConversations();
    const filtered = conversations.filter(c => c.id !== id);
    await this.saveConversations(filtered);
  }
}

export const conversationStore = new ConversationStore();

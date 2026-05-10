import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message } from '../types';

const CONVERSATIONS_KEY = '@lineai_conversations';
const CURRENT_KEY = '@lineai_current_conversation';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

export async function getConversations(): Promise<Conversation[]> {
  const json = await AsyncStorage.getItem(CONVERSATIONS_KEY);
  return json ? JSON.parse(json) : [];
}

export async function saveConversations(conversations: Conversation[]): Promise<void> {
  await AsyncStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations));
}

export async function getCurrentConversationId(): Promise<string | null> {
  return AsyncStorage.getItem(CURRENT_KEY);
}

export async function setCurrentConversationId(id: string): Promise<void> {
  await AsyncStorage.setItem(CURRENT_KEY, id);
}

export async function createConversation(): Promise<Conversation> {
  const now = Date.now();
  const conv: Conversation = {
    id: String(now),
    title: '新对话',
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  const conversations = await getConversations();
  conversations.unshift(conv);
  await saveConversations(conversations);
  await setCurrentConversationId(conv.id);
  return conv;
}

export async function updateConversation(id: string, updates: Partial<Conversation>): Promise<void> {
  const conversations = await getConversations();
  const index = conversations.findIndex(c => c.id === id);
  if (index >= 0) {
    conversations[index] = { ...conversations[index], ...updates, updatedAt: Date.now() };
    await saveConversations(conversations);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  const conversations = await getConversations();
  const filtered = conversations.filter(c => c.id !== id);
  await saveConversations(filtered);
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { conversationStore } from '../src/services/conversation';

interface CacheBackedStore {
  cache: Map<string, unknown>;
}

describe('conversationStore chunked persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    (conversationStore as unknown as CacheBackedStore).cache.clear();
  });

  it('stores and restores conversations larger than AsyncStorage row limits', async () => {
    const conv = await conversationStore.createConversation();
    const largeContent = 'x'.repeat(2 * 1024 * 1024 + 100);

    await conversationStore.updateConversation(conv.id, {
      messages: [{
        id: 'large-message',
        role: 'assistant',
        content: largeContent,
        timestamp: 1,
      }],
    });

    const manifest = await AsyncStorage.getItem(`@lineai_conv_${conv.id}`);
    expect(manifest).toContain('"chunked":true');

    (conversationStore as unknown as CacheBackedStore).cache.clear();

    const restored = await conversationStore.getConversation(conv.id);
    expect(restored?.messages[0]?.content.length).toBe(largeContent.length);
    expect(restored?.messages[0]?.content).toBe(largeContent);
  });

  it('removes chunks when deleting a large conversation', async () => {
    const conv = await conversationStore.createConversation();

    await conversationStore.updateConversation(conv.id, {
      messages: [{
        id: 'large-message',
        role: 'assistant',
        content: 'x'.repeat(2 * 1024 * 1024 + 100),
        timestamp: 1,
      }],
    });

    const keysBefore = await AsyncStorage.getAllKeys();
    expect(keysBefore.some(key => key.startsWith(`@lineai_conv_chunk_${conv.id}_`))).toBe(true);

    await conversationStore.deleteConversation(conv.id);

    const keysAfter = await AsyncStorage.getAllKeys();
    expect(keysAfter.some(key => key.startsWith(`@lineai_conv_chunk_${conv.id}_`))).toBe(false);
    expect(await AsyncStorage.getItem(`@lineai_conv_${conv.id}`)).toBeNull();
  });
});

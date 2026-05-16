import AsyncStorage from '@react-native-async-storage/async-storage';
import { conversationStore } from '../src/services/conversation';

interface CacheBackedStore {
  cache: Map<string, unknown>;
  writeQueues: Map<string, Promise<void>>;
}

const CHUNK_SIZE = 512 * 1024;

describe('conversationStore persistence migration', () => {
  let files: Map<string, string>;
  let dirs: Set<string>;

  beforeEach(async () => {
    const RNFS = require('react-native-fs');
    files = new Map();
    dirs = new Set(['/tmp/lineai-test']);
    RNFS.exists.mockImplementation((path: string) => Promise.resolve(files.has(path) || dirs.has(path)));
    RNFS.mkdir.mockImplementation((path: string) => {
      dirs.add(path);
      return Promise.resolve();
    });
    RNFS.writeFile.mockImplementation((path: string, content: string) => {
      files.set(path, content);
      return Promise.resolve();
    });
    RNFS.readFile.mockImplementation((path: string) => {
      if (!files.has(path)) return Promise.reject(new Error(`ENOENT ${path}`));
      return Promise.resolve(files.get(path));
    });
    RNFS.moveFile.mockImplementation((from: string, to: string) => {
      if (!files.has(from)) return Promise.reject(new Error(`ENOENT ${from}`));
      files.set(to, files.get(from)!);
      files.delete(from);
      return Promise.resolve();
    });
    RNFS.unlink.mockImplementation((path: string) => {
      files.delete(path);
      dirs.delete(path);
      return Promise.resolve();
    });
    await AsyncStorage.clear();
    (conversationStore as unknown as CacheBackedStore).cache.clear();
    (conversationStore as unknown as CacheBackedStore).writeQueues.clear();
  });

  it('stores and restores conversations from file-backed manifests', async () => {
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
    expect(manifest).toContain('"storage":"file"');
    expect(files.has(`/tmp/lineai-test/.linecode/conversations/${conv.id}.json`)).toBe(true);

    (conversationStore as unknown as CacheBackedStore).cache.clear();

    const restored = await conversationStore.getConversation(conv.id);
    expect(restored?.messages[0]?.content.length).toBe(largeContent.length);
    expect(restored?.messages[0]?.content).toBe(largeContent);
  });

  it('migrates legacy chunked conversations to file-backed manifests', async () => {
    const id = 'legacy-chunked';
    const largeContent = 'x'.repeat(2 * 1024 * 1024 + 100);
    const conv = {
      id,
      title: '旧格式',
      createdAt: 1,
      updatedAt: 2,
      messages: [{
        id: 'large-message',
        role: 'assistant' as const,
        content: largeContent,
        timestamp: 1,
      }],
    };
    const json = JSON.stringify(conv);
    const chunks: [string, string][] = [];
    for (let offset = 0; offset < json.length; offset += CHUNK_SIZE) {
      chunks.push([`@lineai_conv_chunk_${id}_${chunks.length}`, json.slice(offset, offset + CHUNK_SIZE)]);
    }
    await AsyncStorage.setItem('@lineai_conversation_list', JSON.stringify([{ id, title: conv.title, createdAt: 1, updatedAt: 2 }]));
    await AsyncStorage.multiSet(chunks);
    await AsyncStorage.setItem(`@lineai_conv_${id}`, JSON.stringify({
      chunked: true,
      id,
      chunks: chunks.length,
      size: json.length,
    }));

    const restored = await conversationStore.getConversation(id);
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(restored?.messages[0]?.content).toBe(largeContent);
    expect(await AsyncStorage.getItem(`@lineai_conv_${id}`)).toContain('"storage":"file"');
    expect(await AsyncStorage.getItem(`@lineai_conv_chunk_${id}_0`)).toBeNull();
    expect(files.has(`/tmp/lineai-test/.linecode/conversations/${id}.json`)).toBe(true);
  });

  it('migrates legacy inline conversations to file-backed manifests', async () => {
    const id = 'legacy-inline';
    const conv = {
      id,
      title: '旧内联格式',
      createdAt: 1,
      updatedAt: 2,
      messages: [{
        id: 'message',
        role: 'user' as const,
        content: 'legacy inline content',
        timestamp: 1,
      }],
    };
    await AsyncStorage.setItem('@lineai_conversation_list', JSON.stringify([{ id, title: conv.title, createdAt: 1, updatedAt: 2 }]));
    await AsyncStorage.setItem(`@lineai_conv_${id}`, JSON.stringify(conv));

    const restored = await conversationStore.getConversation(id);
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(restored?.messages[0]?.content).toBe('legacy inline content');
    expect(await AsyncStorage.getItem(`@lineai_conv_${id}`)).toContain('"storage":"file"');
    expect(files.has(`/tmp/lineai-test/.linecode/conversations/${id}.json`)).toBe(true);
  });

  it('migrates v1 file manifests to v2 manifests', async () => {
    const id = 'legacy-file-manifest';
    const conv = {
      id,
      title: '旧文件格式',
      createdAt: 1,
      updatedAt: 2,
      messages: [{
        id: 'message',
        role: 'assistant' as const,
        content: 'legacy file content',
        timestamp: 1,
      }],
    };
    files.set(`/tmp/lineai-test/.linecode/conversations/${id}.json`, JSON.stringify(conv));
    await AsyncStorage.setItem('@lineai_conversation_list', JSON.stringify([{ id, title: conv.title, createdAt: 1, updatedAt: 2 }]));
    await AsyncStorage.setItem(`@lineai_conv_${id}`, JSON.stringify({
      storage: 'file',
      version: 1,
      id,
      fileName: `${id}.json`,
      size: JSON.stringify(conv).length,
      updatedAt: 2,
    }));

    const restored = await conversationStore.getConversation(id);
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(restored?.messages[0]?.content).toBe('legacy file content');
    const manifest = await AsyncStorage.getItem(`@lineai_conv_${id}`);
    expect(manifest).toContain('"schemaVersion":2');
    expect(manifest).toContain('"messageCount":1');
  });

  it('keeps legacy chunks readable when migration write fails', async () => {
    const RNFS = require('react-native-fs');
    const id = 'legacy-write-fails';
    const conv = {
      id,
      title: '迁移失败',
      createdAt: 1,
      updatedAt: 2,
      messages: [{
        id: 'large-message',
        role: 'assistant' as const,
        content: 'legacy content',
        timestamp: 1,
      }],
    };
    const json = JSON.stringify(conv);
    await AsyncStorage.multiSet([[`@lineai_conv_chunk_${id}_0`, json]]);
    await AsyncStorage.setItem(`@lineai_conv_${id}`, JSON.stringify({
      chunked: true,
      id,
      chunks: 1,
      size: json.length,
    }));
    RNFS.writeFile.mockRejectedValueOnce(new Error('disk full'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    const restored = await conversationStore.getConversation(id);
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(restored?.messages[0]?.content).toBe('legacy content');
    expect(await AsyncStorage.getItem(`@lineai_conv_${id}`)).toContain('"chunked":true');
    expect(await AsyncStorage.getItem(`@lineai_conv_chunk_${id}_0`)).toBe(json);
    expect(consoleError).toHaveBeenCalledWith(
      '[LineCode] Failed to migrate chunked conversation:',
      id,
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it('removes file-backed conversations when deleting', async () => {
    const conv = await conversationStore.createConversation();
    await conversationStore.updateConversation(conv.id, {
      messages: [{
        id: 'message',
        role: 'assistant',
        content: 'stored in a file',
        timestamp: 1,
      }],
    });
    expect(files.has(`/tmp/lineai-test/.linecode/conversations/${conv.id}.json`)).toBe(true);
    await conversationStore.deleteConversation(conv.id);
    expect(files.has(`/tmp/lineai-test/.linecode/conversations/${conv.id}.json`)).toBe(false);
    expect(await AsyncStorage.getItem(`@lineai_conv_${conv.id}`)).toBeNull();
  });
});

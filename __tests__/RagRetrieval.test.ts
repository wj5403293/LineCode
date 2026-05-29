import { ragRank } from '../src/services/evolution/RagRetriever';
import { EvolutionDatabase } from '../src/services/evolution/EvolutionDatabase';
import { EvolutionService } from '../src/services/evolution/EvolutionService';
import { ConversationIndexer } from '../src/services/evolution/ConversationIndexer';

describe('RAG retrieval and project scoping', () => {
  beforeEach(() => {
    const RNFS = require('react-native-fs');
    const files = new Map<string, string>();
    RNFS.exists.mockImplementation((path: string) => Promise.resolve(files.has(path)));
    RNFS.mkdir.mockResolvedValue(undefined);
    RNFS.writeFile.mockImplementation((path: string, content: string) => {
      files.set(path, content);
      return Promise.resolve();
    });
    RNFS.readFile.mockImplementation((path: string) => Promise.resolve(files.get(path) || ''));
    RNFS.readDir.mockResolvedValue([]);
  });

  it('ranks semantically relevant chunks with query overlap and recency tie-breakers', () => {
    const ranked = ragRank('Android release apk 构建失败', [
      { item: 'ios', text: 'iOS archive signing profile' },
      { item: 'android', text: 'Android release APK Gradle 构建 签名' },
      { item: 'general', text: 'React Native 项目 构建失败' },
    ], { limit: 2 });

    expect(ranked.map(item => item.item)).toEqual(['android', 'general']);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('keeps project memories and history scoped to the active home path while user memories stay global', async () => {
    const db = new EvolutionDatabase('/tmp/lineai-test/.linecode/evolution/rag-scope-db.json');
    await db.upsertMemory({ scope: 'user', content: '用户喜欢详细 Markdown 教程', source: 'manual' });
    await db.upsertMemory({ scope: 'project', projectId: '/workspace/a', content: 'A 项目 Android APK 构建使用 Gradle', source: 'manual' });
    await db.upsertMemory({ scope: 'project', projectId: '/workspace/b', content: 'B 项目使用 iOS archive', source: 'manual' });

    const indexer = new ConversationIndexer(db);
    await indexer.indexConversation({
      projectId: '/workspace/a',
      conversationId: 'conv-a',
      title: 'Android 构建',
      messages: [{ id: 'a1', role: 'user', content: 'Android APK 构建失败', timestamp: 1 }],
    });
    await indexer.indexConversation({
      projectId: '/workspace/b',
      conversationId: 'conv-b',
      title: 'iOS 构建',
      messages: [{ id: 'b1', role: 'user', content: 'iOS archive 失败', timestamp: 2 }],
    });

    const service = new EvolutionService(db);
    const context = await service.buildLearningContext({
      learningMode: true,
      userInput: 'Android APK 构建 教程',
      homePath: '/workspace/a',
    });

    expect(context).toContain('用户喜欢详细 Markdown 教程');
    expect(context).toContain('A 项目 Android APK');
    expect(context).toContain('Android APK 构建失败');
    expect(context).not.toContain('B 项目使用 iOS');
    expect(context).not.toContain('iOS archive 失败');
  });

  it('injects short-term working memory separately from long-term memory', async () => {
    const db = new EvolutionDatabase('/tmp/lineai-test/.linecode/evolution/working-memory-db.json');
    await db.upsertWorkingMemory({
      projectId: '/workspace/a',
      content: '当前任务正在实现 SQLite FTS5 和 BM25 RAG',
      source: 'task',
      ttlMs: 60_000,
    });
    await db.upsertMemory({
      scope: 'project',
      projectId: '/workspace/a',
      content: 'A 项目使用 React Native',
      source: 'manual',
    });

    const service = new EvolutionService(db);
    const context = await service.buildLearningContext({
      learningMode: true,
      userInput: 'SQLite BM25 RAG React Native',
      homePath: '/workspace/a',
    });

    expect(context).toContain('### 短期/工作记忆');
    expect(context).toContain('当前任务正在实现 SQLite FTS5 和 BM25 RAG');
    expect(context).toContain('### 长期记忆');
    expect(context).toContain('A 项目使用 React Native');
  });

  it('defines SQLite FTS5 virtual tables and BM25 queries for native retrieval', () => {
    const db = new EvolutionDatabase('/tmp/lineai-test/.linecode/evolution/schema-db.json');
    const schema = db.getFts5Bm25Schema().join('\n');

    expect(schema).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5');
    expect(schema).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS conversation_fts USING fts5');
    expect(schema).toContain('CREATE VIRTUAL TABLE IF NOT EXISTS working_memory_fts USING fts5');
    expect(schema).toContain('bm25(memories_fts)');
    expect(schema).toContain('bm25(conversation_fts)');
    expect(schema).toContain('bm25(working_memory_fts)');
  });
});

import { ConversationIndexer } from '../src/services/evolution/ConversationIndexer';
import { EvolutionDatabase } from '../src/services/evolution/EvolutionDatabase';
import { EvolutionService } from '../src/services/evolution/EvolutionService';

interface MockEntry {
  name: string;
  path: string;
  directory?: boolean;
}

function entry({ name, path, directory = false }: MockEntry) {
  return {
    name,
    path,
    isDirectory: () => directory,
    isFile: () => !directory,
  };
}

describe('evolution learning context', () => {
  let files: Map<string, string>;
  let dirs: Set<string>;

  beforeEach(() => {
    const RNFS = require('react-native-fs');
    files = new Map();
    dirs = new Set(['/tmp/lineai-test', '/tmp/lineai-test/.linecode']);
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
    RNFS.readDir.mockImplementation((path: string) => {
      const children: any[] = [];
      const prefix = `${path}/`;
      const names = new Set<string>();
      for (const dir of dirs) {
        if (!dir.startsWith(prefix)) continue;
        const rest = dir.slice(prefix.length);
        if (!rest || rest.includes('/')) continue;
        names.add(rest);
        children.push(entry({ name: rest, path: dir, directory: true }));
      }
      for (const file of files.keys()) {
        if (!file.startsWith(prefix)) continue;
        const rest = file.slice(prefix.length);
        if (!rest || rest.includes('/') || names.has(rest)) continue;
        children.push(entry({ name: rest, path: file }));
      }
      return Promise.resolve(children);
    });
  });

  it('indexes messages and builds a gated learning context', async () => {
    const db = new EvolutionDatabase('/tmp/lineai-test/.linecode/evolution/test-db.json');
    await db.upsertMemory({
      scope: 'user',
      content: '用户喜欢 TypeScript 和两空格缩进。',
      source: 'manual',
      confidence: 1,
    });

    const indexer = new ConversationIndexer(db);
    await indexer.indexConversation({
      conversationId: 'conv-1',
      title: 'RN 测试',
      messages: [
        { id: 'u1', role: 'user', content: '如何给 React Native 写 Jest 测试？', timestamp: 1 },
        { id: 'a1', role: 'assistant', content: '可以 mock react-native-fs 并聚焦纯服务。', timestamp: 2 },
      ],
    });

    dirs.add('/tmp/lineai-test/.linecode/skills');
    dirs.add('/tmp/lineai-test/.linecode/skills/jest-skill');
    files.set('/tmp/lineai-test/.linecode/skills/jest-skill/SKILL.md', [
      '---',
      'name: Jest RN',
      'description: React Native Jest testing guidance',
      '---',
      '# Jest RN',
    ].join('\n'));

    const service = new EvolutionService(db);
    const disabled = await service.buildLearningContext({
      learningMode: false,
      userInput: 'TypeScript React Native Jest 测试',
      homePath: '/tmp/lineai-test/project',
      modelId: 'model-1',
    });
    expect(disabled).toBe('');

    const enabled = await service.buildLearningContext({
      learningMode: true,
      userInput: 'TypeScript React Native Jest 测试',
      homePath: '/tmp/lineai-test/project',
      modelId: 'model-1',
    });

    expect(enabled).toContain('## 学习模式上下文');
    expect(enabled).toContain('用户喜欢 TypeScript');
    expect(enabled).toContain('React Native 写 Jest 测试');
    expect(enabled).toContain('Jest RN');
    expect(enabled).toContain('/tmp/lineai-test/.linecode/skills');
  });
});

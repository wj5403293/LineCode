import RNFS from 'react-native-fs';
import {
  ConversationIndexEntry,
  DiscoveredSkill,
  EvolutionDatabaseState,
  EvolutionMemory,
  EvolutionMemoryInput,
  WorkingMemoryEntry,
} from './types';
import { ragRank } from './RagRetriever';

export const EVOLUTION_DB_DIR = `${RNFS.DocumentDirectoryPath}/.linecode/evolution`;
export const EVOLUTION_DB_PATH = `${EVOLUTION_DB_DIR}/evolution-db.json`;
export const EVOLUTION_SQLITE_PATH = `${EVOLUTION_DB_DIR}/evolution.db`;

const EMPTY_STATE: EvolutionDatabaseState = {
  schemaVersion: 2,
  memories: [],
  conversationIndex: [],
  workingMemory: [],
  skills: [],
  skillUsage: [],
};

function nowId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeState(value: Partial<EvolutionDatabaseState> | null | undefined): EvolutionDatabaseState {
  return {
    schemaVersion: 2,
    memories: Array.isArray(value?.memories) ? value!.memories : [],
    conversationIndex: Array.isArray(value?.conversationIndex) ? value!.conversationIndex : [],
    workingMemory: Array.isArray(value?.workingMemory) ? value!.workingMemory : [],
    skills: Array.isArray(value?.skills) ? value!.skills : [],
    skillUsage: Array.isArray(value?.skillUsage) ? value!.skillUsage : [],
  };
}

function dbDirname(path: string): string {
  const cleanPath = path.replace(/\/+$/, '');
  const index = cleanPath.lastIndexOf('/');
  return index > 0 ? cleanPath.slice(0, index) : '';
}

function isNotExpired(entry: WorkingMemoryEntry, now = Date.now()): boolean {
  return !entry.expiresAt || entry.expiresAt > now;
}

export class EvolutionDatabase {
  private state: EvolutionDatabaseState | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly dbPath: string = EVOLUTION_DB_PATH) {}

  async initSqliteFts5(): Promise<void> {
    // Runtime hook for the native SQLite implementation. The JSON store remains
    // the Jest/mobile-safe fallback, while this method documents and executes the
    // FTS5/BM25 schema when react-native-quick-sqlite is available.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sqlite = require('react-native-quick-sqlite');
      const db = sqlite.open({ name: 'evolution.db', location: EVOLUTION_DB_DIR });
      const statements = [
        'CREATE TABLE IF NOT EXISTS memories (id TEXT PRIMARY KEY, scope TEXT NOT NULL, project_id TEXT, content TEXT NOT NULL, source TEXT NOT NULL, confidence REAL NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, last_used_at INTEGER, use_count INTEGER NOT NULL DEFAULT 0)',
        'CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(id UNINDEXED, scope UNINDEXED, project_id UNINDEXED, content, tokenize="unicode61")',
        'CREATE TABLE IF NOT EXISTS conversation_index (id TEXT PRIMARY KEY, project_id TEXT, conversation_id TEXT NOT NULL, message_id TEXT, role TEXT NOT NULL, text TEXT NOT NULL, title TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
        'CREATE VIRTUAL TABLE IF NOT EXISTS conversation_fts USING fts5(id UNINDEXED, project_id UNINDEXED, conversation_id UNINDEXED, title, text, tokenize="unicode61")',
        'CREATE TABLE IF NOT EXISTS working_memory (id TEXT PRIMARY KEY, project_id TEXT, content TEXT NOT NULL, source TEXT NOT NULL, expires_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)',
        'CREATE VIRTUAL TABLE IF NOT EXISTS working_memory_fts USING fts5(id UNINDEXED, project_id UNINDEXED, content, tokenize="unicode61")',
      ];
      statements.forEach(sql => db.execute?.(sql));
    } catch {
      // Optional native dependency is unavailable in Jest or non-native contexts.
    }
  }

  getFts5Bm25Schema(): string[] {
    return [
      'CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(id UNINDEXED, scope UNINDEXED, project_id UNINDEXED, content, tokenize="unicode61")',
      'SELECT id, bm25(memories_fts) AS rank FROM memories_fts WHERE memories_fts MATCH ?',
      'CREATE VIRTUAL TABLE IF NOT EXISTS conversation_fts USING fts5(id UNINDEXED, project_id UNINDEXED, conversation_id UNINDEXED, title, text, tokenize="unicode61")',
      'SELECT id, bm25(conversation_fts) AS rank FROM conversation_fts WHERE conversation_fts MATCH ?',
      'CREATE VIRTUAL TABLE IF NOT EXISTS working_memory_fts USING fts5(id UNINDEXED, project_id UNINDEXED, content, tokenize="unicode61")',
      'SELECT id, bm25(working_memory_fts) AS rank FROM working_memory_fts WHERE working_memory_fts MATCH ?',
    ];
  }

  async getState(): Promise<EvolutionDatabaseState> {
    await this.ensureLoaded();
    return this.cloneState(this.state!);
  }

  async upsertMemory(input: EvolutionMemoryInput): Promise<EvolutionMemory> {
    await this.ensureLoaded();
    const now = Date.now();
    const existingIndex = input.id
      ? this.state!.memories.findIndex(memory => memory.id === input.id)
      : -1;
    const existing = existingIndex >= 0 ? this.state!.memories[existingIndex] : undefined;
    const next: EvolutionMemory = {
      id: existing?.id || input.id || nowId('mem'),
      scope: input.scope,
      projectId: input.scope === 'user' ? undefined : input.projectId,
      content: input.content.trim(),
      source: input.source,
      confidence: input.confidence ?? existing?.confidence ?? 1,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastUsedAt: existing?.lastUsedAt,
      useCount: existing?.useCount || 0,
    };
    if (!next.content) {
      throw new Error('Memory content cannot be empty.');
    }
    if (existingIndex >= 0) {
      this.state!.memories[existingIndex] = next;
    } else {
      this.state!.memories.unshift(next);
    }
    await this.persist();
    return next;
  }

  async getMemories(): Promise<EvolutionMemory[]> {
    await this.ensureLoaded();
    return [...this.state!.memories];
  }

  async deleteMemory(id: string): Promise<void> {
    await this.ensureLoaded();
    const next = this.state!.memories.filter(memory => memory.id !== id);
    if (next.length === this.state!.memories.length) return;
    this.state!.memories = next;
    await this.persist();
  }

  async searchMemories(query: string, options: { projectId?: string; limit?: number } = {}): Promise<EvolutionMemory[]> {
    const memories = await this.getMemories();
    return ragRank(query, memories
      .filter(memory => memory.scope === 'user' || !memory.projectId || memory.projectId === options.projectId)
      .map(memory => ({ item: memory, text: `${memory.scope} ${memory.content}`, updatedAt: memory.updatedAt })), {
      limit: options.limit ?? 6,
    }).map(result => result.item);
  }

  async markMemoriesUsed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.ensureLoaded();
    const now = Date.now();
    const idSet = new Set(ids);
    this.state!.memories = this.state!.memories.map(memory => idSet.has(memory.id)
      ? { ...memory, lastUsedAt: now, useCount: memory.useCount + 1 }
      : memory);
    await this.persist();
  }

  async upsertConversationEntries(entries: ConversationIndexEntry[]): Promise<void> {
    if (entries.length === 0) return;
    await this.ensureLoaded();
    const nextById = new Map(this.state!.conversationIndex.map(entry => [entry.id, entry]));
    for (const entry of entries) {
      nextById.set(entry.id, entry);
    }
    this.state!.conversationIndex = Array.from(nextById.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 5000);
    await this.persist();
  }

  async getConversationIndex(): Promise<ConversationIndexEntry[]> {
    await this.ensureLoaded();
    return [...this.state!.conversationIndex];
  }

  async searchConversationIndex(query: string, options: { projectId?: string; limit?: number } = {}): Promise<ConversationIndexEntry[]> {
    const history = await this.getConversationIndex();
    return ragRank(query, history
      .filter(entry => !entry.projectId || entry.projectId === options.projectId)
      .map(entry => ({ item: entry, text: `${entry.title || ''} ${entry.text}`, updatedAt: entry.updatedAt })), {
      limit: options.limit ?? 6,
    }).map(result => result.item);
  }

  async upsertWorkingMemory(input: {
    id?: string;
    projectId?: string;
    content: string;
    source: WorkingMemoryEntry['source'];
    ttlMs?: number;
  }): Promise<WorkingMemoryEntry> {
    await this.ensureLoaded();
    const now = Date.now();
    const existingIndex = input.id
      ? this.state!.workingMemory.findIndex(entry => entry.id === input.id)
      : -1;
    const existing = existingIndex >= 0 ? this.state!.workingMemory[existingIndex] : undefined;
    const next: WorkingMemoryEntry = {
      id: existing?.id || input.id || nowId('wm'),
      projectId: input.projectId,
      content: input.content.trim(),
      source: input.source,
      expiresAt: input.ttlMs ? now + input.ttlMs : existing?.expiresAt,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    if (!next.content) {
      throw new Error('Working memory content cannot be empty.');
    }
    if (existingIndex >= 0) {
      this.state!.workingMemory[existingIndex] = next;
    } else {
      this.state!.workingMemory.unshift(next);
    }
    await this.persist();
    return next;
  }

  async getWorkingMemory(projectId?: string): Promise<WorkingMemoryEntry[]> {
    await this.ensureLoaded();
    const now = Date.now();
    const visible = this.state!.workingMemory
      .filter(entry => isNotExpired(entry, now))
      .filter(entry => !entry.projectId || entry.projectId === projectId);
    if (visible.length !== this.state!.workingMemory.length) {
      this.state!.workingMemory = this.state!.workingMemory.filter(entry => isNotExpired(entry, now));
      await this.persist();
    }
    return [...visible];
  }

  async searchWorkingMemory(query: string, options: { projectId?: string; limit?: number } = {}): Promise<WorkingMemoryEntry[]> {
    const workingMemory = await this.getWorkingMemory(options.projectId);
    return ragRank(query, workingMemory.map(entry => ({
      item: entry,
      text: entry.content,
      updatedAt: entry.updatedAt,
      boost: 0.3,
    })), { limit: options.limit ?? 5 }).map(result => result.item);
  }

  async clearWorkingMemory(projectId?: string): Promise<void> {
    await this.ensureLoaded();
    this.state!.workingMemory = this.state!.workingMemory.filter(entry => projectId && entry.projectId !== projectId);
    await this.persist();
  }

  async upsertSkills(skills: DiscoveredSkill[]): Promise<void> {
    await this.ensureLoaded();
    const nextById = new Map(this.state!.skills.map(skill => [skill.id, skill]));
    for (const skill of skills) {
      nextById.set(skill.id, skill);
    }
    this.state!.skills = Array.from(nextById.values()).sort((a, b) => a.name.localeCompare(b.name));
    await this.persist();
  }

  async getSkills(): Promise<DiscoveredSkill[]> {
    await this.ensureLoaded();
    return [...this.state!.skills];
  }

  private async ensureLoaded(): Promise<void> {
    if (this.state) return;
    try {
      const exists = await RNFS.exists(this.dbPath);
      if (!exists) {
        this.state = this.cloneState(EMPTY_STATE);
        await this.persist();
        return;
      }
      const raw = await RNFS.readFile(this.dbPath, 'utf8');
      this.state = normalizeState(raw ? JSON.parse(raw) : EMPTY_STATE);
    } catch {
      this.state = this.cloneState(EMPTY_STATE);
      await this.persist();
    }
  }

  private async persist(): Promise<void> {
    const write = async () => {
      await RNFS.mkdir(dbDirname(this.dbPath), { NSURLIsExcludedFromBackupKey: true });
      await RNFS.writeFile(this.dbPath, JSON.stringify(this.state, null, 2), 'utf8');
    };
    this.writeQueue = this.writeQueue.catch(() => {}).then(write);
    await this.writeQueue;
  }

  private cloneState(state: EvolutionDatabaseState): EvolutionDatabaseState {
    return JSON.parse(JSON.stringify(state));
  }
}

export const evolutionDatabase = new EvolutionDatabase();

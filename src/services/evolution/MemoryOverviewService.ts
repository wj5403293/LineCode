import { EvolutionDatabase, evolutionDatabase } from './EvolutionDatabase';
import { projectService } from '../ProjectService';
import { ConversationIndexEntry, EvolutionMemory, MemoryScope, WorkingMemoryEntry } from './types';

export interface MemoryOverview {
  longTerm: EvolutionMemory[];
  project: EvolutionMemory[];
  environment: EvolutionMemory[];
  shortTerm: WorkingMemoryEntry[];
  history: ConversationIndexEntry[];
  projectId?: string;
}

export class MemoryOverviewService {
  constructor(private readonly database: EvolutionDatabase = evolutionDatabase) {}

  async getOverview(projectId?: string): Promise<MemoryOverview> {
    const resolvedProjectId = projectId ?? await projectService.getCurrentHomePath().catch(() => undefined);
    const [memories, shortTerm, history] = await Promise.all([
      this.database.getMemories(),
      this.database.getWorkingMemory(resolvedProjectId),
      this.database.getConversationIndex(),
    ]);

    const projectScoped = memories.filter(memory => memory.scope === 'project' && (!memory.projectId || memory.projectId === resolvedProjectId));
    const environmentScoped = memories.filter(memory => memory.scope === 'environment' && (!memory.projectId || memory.projectId === resolvedProjectId));
    const historyScoped = history.filter(entry => !entry.projectId || entry.projectId === resolvedProjectId);

    return {
      longTerm: memories.filter(memory => memory.scope === 'user'),
      project: projectScoped,
      environment: environmentScoped,
      shortTerm,
      history: historyScoped,
      projectId: resolvedProjectId,
    };
  }

  async addMemory(content: string, scope: MemoryScope, projectId?: string): Promise<void> {
    const resolvedProjectId = scope === 'user'
      ? undefined
      : projectId ?? await projectService.getCurrentHomePath().catch(() => undefined);
    await this.database.upsertMemory({
      scope,
      projectId: resolvedProjectId,
      content,
      source: 'manual',
      confidence: 1,
    });
  }

  async updateMemory(id: string, input: { content: string; scope: MemoryScope; projectId?: string }): Promise<void> {
    const memories = await this.database.getMemories();
    const existing = memories.find(memory => memory.id === id);
    if (!existing) {
      throw new Error('Memory not found.');
    }
    const resolvedProjectId = input.scope === 'user'
      ? undefined
      : input.projectId ?? existing.projectId ?? await projectService.getCurrentHomePath().catch(() => undefined);
    await this.database.upsertMemory({
      id,
      scope: input.scope,
      projectId: resolvedProjectId,
      content: input.content,
      source: existing.source,
      confidence: existing.confidence,
    });
  }

  async deleteMemory(id: string): Promise<void> {
    await this.database.deleteMemory(id);
  }
}

export const memoryOverviewService = new MemoryOverviewService();

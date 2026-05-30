import { EvolutionDatabase, evolutionDatabase } from './EvolutionDatabase';
import { projectService } from '../ProjectService';
import { ConversationIndexEntry, EvolutionMemory, WorkingMemoryEntry } from './types';

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

  async addMemory(content: string, scope: 'user' | 'project' | 'environment', projectId?: string): Promise<void> {
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
}

export const memoryOverviewService = new MemoryOverviewService();

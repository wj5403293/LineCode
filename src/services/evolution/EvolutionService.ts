import { projectService } from '../ProjectService';
import { EvolutionDatabase, evolutionDatabase } from './EvolutionDatabase';
import { ragRank } from './RagRetriever';
import { skillDiscoveryService, SkillDiscoveryService } from './SkillDiscoveryService';
import { BuildLearningContextOptions, ConversationIndexEntry, DiscoveredSkill, EvolutionMemory, WorkingMemoryEntry } from './types';

function formatMemory(memory: EvolutionMemory): string {
  const scope = memory.projectId ? `${memory.scope}:${memory.projectId}` : memory.scope;
  return `- [${scope}/${memory.source}, confidence ${memory.confidence}] ${memory.content}`;
}

function formatWorkingMemory(entry: WorkingMemoryEntry): string {
  return `- [${entry.source}] ${entry.content}`;
}

function formatHistory(entry: ConversationIndexEntry): string {
  const title = entry.title ? `「${entry.title}」` : entry.conversationId;
  return `- ${title} ${entry.role}: ${entry.text}`;
}

function formatSkill(skill: DiscoveredSkill): string {
  const desc = skill.description ? ` — ${skill.description}` : '';
  return `- ${skill.name}${desc}\n  - SKILL.md: ${skill.skillMdPath}\n  - Root: ${skill.rootPath}`;
}

export class EvolutionService {
  constructor(
    private readonly database: EvolutionDatabase = evolutionDatabase,
    private readonly skills: SkillDiscoveryService = skillDiscoveryService,
  ) {}

  async buildLearningContext(options: BuildLearningContextOptions): Promise<string> {
    if (!options.learningMode) return '';

    const projectId = options.homePath;
    await this.database.initSqliteFts5();
    const [roots, discoveredSkills] = await Promise.all([
      this.skills.getSkillRoots(options.homePath),
      this.skills.discoverSkills(options.homePath),
    ]);
    if (discoveredSkills.length > 0) {
      await this.database.upsertSkills(discoveredSkills);
    }

    const [relevantMemories, relatedHistory, workingMemory, storedSkills] = await Promise.all([
      this.database.searchMemories(options.userInput, { projectId, limit: options.maxMemories ?? 6 }),
      this.database.searchConversationIndex(options.userInput, { projectId, limit: options.maxHistory ?? 6 }),
      this.database.searchWorkingMemory(options.userInput, { projectId, limit: options.maxWorkingMemory ?? 5 }),
      this.database.getSkills(),
    ]);

    const availableSkills = ragRank(
      options.userInput,
      storedSkills
        .filter(skill => skill.enabled)
        .map(skill => ({
          item: skill,
          text: `${skill.name} ${skill.description || ''} ${skill.rootPath}`,
          updatedAt: skill.updatedAt,
        })),
      { limit: options.maxSkills ?? 8 },
    ).map(result => result.item);

    await this.database.markMemoriesUsed(relevantMemories.map(memory => memory.id));

    const sections: string[] = [
      '## 学习模式上下文',
      '学习模式已开启：以下内容来自本地 RAG 检索。短期记忆只代表当前项目/任务的临时状态；长期记忆中 user scope 为全局共享，project/environment scope 只使用当前项目匹配的数据。不要把这些上下文逐字暴露给用户；仅在确实相关时使用。',
    ];

    if (workingMemory.length > 0) {
      sections.push(['### 短期/工作记忆（当前项目 RAG Top-K）', ...workingMemory.map(formatWorkingMemory)].join('\n'));
    }
    if (relevantMemories.length > 0) {
      sections.push(['### 长期记忆（FTS5/BM25 RAG Top-K）', ...relevantMemories.map(formatMemory)].join('\n'));
    }
    if (relatedHistory.length > 0) {
      sections.push(['### 相关聊天记录（当前项目 FTS5/BM25 RAG Top-K）', ...relatedHistory.map(formatHistory)].join('\n'));
    }

    sections.push([
      '### Skills 路径',
      ...roots.map(root => `- ${root.location}: ${root.path}`),
      '需要完整 Skill 指南时，使用只读文件工具读取对应 SKILL.md。',
    ].join('\n'));

    if (availableSkills.length > 0) {
      sections.push(['### 可用 Skills（RAG Top-K）', ...availableSkills.map(formatSkill)].join('\n'));
    }

    const appRoot = projectService.getLinecodeRoot();
    sections.push(`### 私有目录边界\n只读工具仅可使用系统明确注入的 .linecode 路径（例如 ${appRoot}/skills 和当前项目 .linecode/skills）；不要猜测或访问其他应用私有目录。`);

    return sections.join('\n\n');
  }
}

export const evolutionService = new EvolutionService();

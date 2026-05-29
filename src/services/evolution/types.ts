import { MessageRole } from '../../types';

export type MemoryScope = 'user' | 'project' | 'environment';
export type MemorySource = 'manual' | 'auto' | 'correction' | 'summary';
export type SkillLocation = 'app' | 'project' | 'ssh';

export interface EvolutionMemory {
  id: string;
  scope: MemoryScope;
  projectId?: string;
  content: string;
  source: MemorySource;
  confidence: number;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  useCount: number;
}

export interface EvolutionMemoryInput {
  id?: string;
  scope: MemoryScope;
  projectId?: string;
  content: string;
  source: MemorySource;
  confidence?: number;
}

export interface ConversationIndexEntry {
  id: string;
  projectId?: string;
  conversationId: string;
  messageId?: string;
  role: MessageRole;
  text: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DiscoveredSkill {
  id: string;
  name: string;
  description?: string;
  rootPath: string;
  skillMdPath: string;
  location: SkillLocation;
  enabled: boolean;
  discoveredAt: number;
  updatedAt: number;
}

export interface EvolutionDatabaseState {
  schemaVersion: number;
  memories: EvolutionMemory[];
  conversationIndex: ConversationIndexEntry[];
  workingMemory: WorkingMemoryEntry[];
  skills: DiscoveredSkill[];
  skillUsage: SkillUsageEntry[];
}

export interface WorkingMemoryEntry {
  id: string;
  projectId?: string;
  content: string;
  source: 'session' | 'task' | 'tool' | 'summary';
  expiresAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface SkillUsageEntry {
  skillId: string;
  usedAt: number;
  taskHint?: string;
  success?: boolean;
}

export interface ConversationIndexMessage {
  id?: string;
  role: MessageRole;
  content: string;
  timestamp?: number;
}

export interface BuildLearningContextOptions {
  learningMode?: boolean;
  userInput: string;
  homePath?: string;
  modelId?: string;
  maxMemories?: number;
  maxHistory?: number;
  maxWorkingMemory?: number;
  maxSkills?: number;
}

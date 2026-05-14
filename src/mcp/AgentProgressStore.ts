import { AgentProgressItem, AgentToolCall, ContentBlock } from '../types';

export interface AgentProgressPatch {
  id: string;
  name: string;
  type: 'explore' | 'sub-coding';
  status?: AgentProgressItem['status'];
  output?: string;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  toolCallCount?: number;
  startTime?: number;
  endTime?: number;
  waitingForUnlock?: AgentProgressItem['waitingForUnlock'];
}

export class AgentProgressStore {
  private items = new Map<string, AgentProgressItem>();

  upsert(patch: AgentProgressPatch): AgentProgressItem[] {
    const current = this.items.get(patch.id);
    const next: AgentProgressItem = {
      ...current,
      id: patch.id,
      name: patch.name,
      type: patch.type,
      status: patch.status || current?.status || 'running',
      output: patch.output ?? current?.output,
      thinking: patch.thinking ?? current?.thinking,
      toolCalls: patch.toolCalls ?? current?.toolCalls,
      toolCallCount: patch.toolCallCount ?? current?.toolCallCount,
      startTime: patch.startTime ?? current?.startTime,
      endTime: patch.endTime ?? current?.endTime,
      waitingForUnlock: patch.waitingForUnlock,
    };
    this.items.set(patch.id, next);
    return this.snapshot();
  }

  snapshot(): AgentProgressItem[] {
    return Array.from(this.items.values()).sort((a, b) => {
      const aStart = a.startTime || 0;
      const bStart = b.startTime || 0;
      if (aStart !== bStart) return aStart - bStart;
      return a.id.localeCompare(b.id);
    });
  }

  toContentBlock(update?: Partial<ContentBlock>): Partial<ContentBlock> {
    return {
      ...update,
      agentItems: this.snapshot(),
    };
  }
}

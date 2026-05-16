import { ToolCall } from '../types';

export interface ToolExecutionPlan {
  concurrentTasks: ToolCall[];
  sequentialTasks: ToolCall[];
}

export class ToolExecutionCoordinator {
  createPlan(toolCalls: ToolCall[]): ToolExecutionPlan {
    const concurrentTasks: ToolCall[] = [];
    const sequentialTasks: ToolCall[] = [];

    for (const toolCall of toolCalls) {
      if (this.isConcurrencySafe(toolCall)) {
        concurrentTasks.push(toolCall);
      } else {
        sequentialTasks.push(toolCall);
      }
    }

    return { concurrentTasks, sequentialTasks };
  }

  isConcurrencySafe(toolCall: ToolCall): boolean {
    if (toolCall.name === 'file_read' || toolCall.name === 'glob' || toolCall.name === 'web_search' || toolCall.name === 'web_fetch') {
      return true;
    }
    if (toolCall.name === 'agent') {
      try {
        const input = JSON.parse(toolCall.arguments);
        return input.type === 'explore';
      } catch {
        return false;
      }
    }
    return false;
  }
}

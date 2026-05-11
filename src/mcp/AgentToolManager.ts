import { AgentTool } from './tools/builtins/AgentTool';

class AgentToolManager {
  private currentAgentTool: AgentTool | null = null;

  setCurrent(tool: AgentTool | null) {
    this.currentAgentTool = tool;
  }

  getCurrent(): AgentTool | null {
    return this.currentAgentTool;
  }

  continueAfterUnlock() {
    this.currentAgentTool?.continueAfterUnlock();
  }

  abort() {
    this.currentAgentTool?.abort();
  }

  getWaitingForUnlock() {
    return this.currentAgentTool?.getWaitingForUnlock();
  }
}

export const agentToolManager = new AgentToolManager();

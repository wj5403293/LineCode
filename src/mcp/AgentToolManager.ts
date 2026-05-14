interface ManagedAgentTool {
  abort(): void;
  continueAfterUnlock?: () => void;
  getWaitingForUnlock?: () => { filePath: string; lockedBy: string } | null;
}

class AgentToolManager {
  private currentAgentTool: ManagedAgentTool | null = null;

  setCurrent(tool: ManagedAgentTool | null) {
    this.currentAgentTool = tool;
  }

  getCurrent(): ManagedAgentTool | null {
    return this.currentAgentTool;
  }

  continueAfterUnlock() {
    this.currentAgentTool?.continueAfterUnlock?.();
  }

  abort() {
    this.currentAgentTool?.abort();
  }

  getWaitingForUnlock() {
    return this.currentAgentTool?.getWaitingForUnlock?.();
  }
}

export const agentToolManager = new AgentToolManager();

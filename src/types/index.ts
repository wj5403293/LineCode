export interface AgentToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  isLocked?: boolean;
  lockedBy?: string;
  lockedFilePath?: string;
}

export interface ContentBlock {
  type: 'thinking' | 'text' | 'tool_use' | 'tool_result' | 'agent';
  content: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  toolCallId?: string;
  isError?: boolean;
  agentType?: 'explore' | 'sub-coding';
  agentStatus?: 'running' | 'done' | 'error' | 'waiting_unlock';
  agentOutput?: string;
  agentThinking?: string;
  agentToolCalls?: AgentToolCall[];
  waitingForUnlock?: {
    filePath: string;
    lockedBy: string;
  };
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface AgentInstance {
  id: number;
  type: 'explore' | 'sub-coding';
  name: string;
  status: 'running' | 'done' | 'error';
  startTime: number;
  endTime?: number;
  input: string;
  output: string;
  toolCalls: number;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  blocks?: ContentBlock[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  toolCallId?: string;
  toolName?: string;
  timestamp: number;
  streaming?: boolean;
  reasoningContent?: string;
  isError?: boolean;
}

export interface Model {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic';
  modelId: string;
  apiKey: string;
  baseUrl?: string;
}

export interface SystemPrompt {
  content: string;
}

export interface OptionItem {
  id: string;
  label: string;
  desc?: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface DiffRecord {
  id: string;
  filePath: string;
  oldContent: string;
  newContent: string;
  timestamp: number;
  reverted: boolean;
}

export interface MCPConfig {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  tools: string[];
}

export type ToolCategory = 'read' | 'write' | 'system';

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  requiresConfirmation: boolean;
  parameters: Record<string, unknown>;
}

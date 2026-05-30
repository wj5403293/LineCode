export interface AgentToolCall {
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
  diffId?: string;
  isLocked?: boolean;
  lockedBy?: string;
  lockedFilePath?: string;
}

export interface AgentProgressItem {
  id: string;
  name: string;
  type: 'explore' | 'sub-coding';
  status: 'waiting' | 'running' | 'done' | 'error' | 'waiting_unlock';
  dependencies?: string[];
  output?: string;
  thinking?: string;
  toolCalls?: AgentToolCall[];
  toolCallCount?: number;
  order?: number;
  startTime?: number;
  endTime?: number;
  waitingForUnlock?: {
    filePath: string;
    lockedBy: string;
  };
}

export interface ContentBlock {
  type: 'thinking' | 'text' | 'tool_use' | 'tool_result' | 'agent' | 'compact';
  content: string;
  thinkingStatus?: 'running' | 'done';
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
  agentItems?: AgentProgressItem[];
  waitingForUnlock?: {
    filePath: string;
    lockedBy: string;
  };
  compactStatus?: 'running' | 'done' | 'error';
  shellStatus?: 'running' | 'done' | 'error';
  shellOutput?: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

export type ReasoningDetail = Record<string, unknown>;

export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
  diffId?: string;
  reviewState?: 'accepted' | 'rejected';
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
  reasoningDetails?: ReasoningDetail[];
  isError?: boolean;
  hidden?: boolean;
  excludeFromContext?: boolean;
  attachments?: InputAttachment[];
}

export interface InputAttachment {
  name: string;
  path: string;
  source: 'local' | 'ssh';
}

export interface Model {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'codex' | 'local';
  modelId: string;
  apiKey: string;
  baseUrl?: string;
  providerLabel?: string;
  learningMode?: boolean;
  localModel?: {
    fileUri: string;
    fileName: string;
    fileSize?: number;
    localPath: string;
    acceleration: 'auto' | 'cpu' | 'npu';
    nCtx?: number;
  };
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
  oldExists?: boolean;
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

export type WebSearchProvider = 'tavily' | 'brave' | 'serpapi' | 'bing' | 'custom';

export interface WebSearchConfig {
  provider: WebSearchProvider;
  baseUrl: string;
  apiKey: string;
  model?: string;
  queryParam?: string;
  apiKeyHeader?: string;
  apiKeyParam?: string;
}

export type ToolCategory = 'read' | 'write' | 'system';

export interface ToolDefinition {
  name: string;
  description: string;
  category: ToolCategory;
  requiresConfirmation: boolean;
  parameters: Record<string, unknown>;
}

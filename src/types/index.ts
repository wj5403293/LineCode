export interface ContentBlock {
  type: 'thinking' | 'text';
  content: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  blocks?: ContentBlock[];
  timestamp: number;
  streaming?: boolean;
  toolName?: string;
  toolCallId?: string;
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

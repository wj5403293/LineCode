import { ToolCall, AgentToolCall, ToolCategory } from '../types';

export const TOOL_CATEGORIES = {
  READ: new Set(['file_read', 'glob']),
  WRITE: new Set(['file_write', 'file_edit']),
  DELETE: new Set(['file_delete']),
  HTTP: new Set(['http_server']),
  AGENT: new Set(['agent']),
} as const;

export function getToolCategory(name: string): ToolCategory | null {
  if (TOOL_CATEGORIES.READ.has(name)) return 'read';
  if (TOOL_CATEGORIES.WRITE.has(name)) return 'write';
  if (TOOL_CATEGORIES.DELETE.has(name)) return 'write';
  if (TOOL_CATEGORIES.HTTP.has(name)) return 'system';
  if (TOOL_CATEGORIES.AGENT.has(name)) return 'system';
  return null;
}

export function isReadTool(name: string): boolean {
  return TOOL_CATEGORIES.READ.has(name);
}

export function isWriteTool(name: string): boolean {
  return TOOL_CATEGORIES.WRITE.has(name);
}

export function isDeleteTool(name: string): boolean {
  return TOOL_CATEGORIES.DELETE.has(name);
}

export function isHttpTool(name: string): boolean {
  return TOOL_CATEGORIES.HTTP.has(name);
}

export function isAgentTool(name: string): boolean {
  return TOOL_CATEGORIES.AGENT.has(name);
}

export function parseToolInput(toolCall: ToolCall | AgentToolCall): Record<string, unknown> {
  if ('arguments' in toolCall && typeof (toolCall as ToolCall).arguments === 'string') {
    try {
      return JSON.parse((toolCall as ToolCall).arguments);
    } catch {
      return {};
    }
  }
  if ('input' in toolCall) {
    return (toolCall as AgentToolCall).input || {};
  }
  return {};
}

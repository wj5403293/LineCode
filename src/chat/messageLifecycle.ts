import { AgentProgressItem, AgentToolCall, ContentBlock, InputAttachment, Message, ToolCall, ToolResult } from '../types';
import { isDangerousShellCommand } from '../utils/shellSafety';

const TERMINATED_RESULT = '已终止';

function markAgentToolCallsTerminated(toolCalls?: AgentToolCall[]): AgentToolCall[] | undefined {
  if (!toolCalls) return toolCalls;
  return toolCalls.map(tc => {
    if (tc.result) return tc;
    return {
      ...tc,
      result: TERMINATED_RESULT,
      isError: true,
    };
  });
}

function markAgentItemsTerminated(items?: AgentProgressItem[]): AgentProgressItem[] | undefined {
  if (!items) return items;
  return items.map(item => {
    if (item.status !== 'waiting' && item.status !== 'running' && item.status !== 'waiting_unlock') return item;
    return {
      ...item,
      status: 'error' as const,
      output: item.output || TERMINATED_RESULT,
      toolCalls: markAgentToolCallsTerminated(item.toolCalls),
      waitingForUnlock: undefined,
      endTime: item.endTime || Date.now(),
    };
  });
}

function markBlocksTerminated(blocks?: ContentBlock[]): {
  blocks?: ContentBlock[];
  toolResults: ToolResult[];
} {
  if (!blocks) return { blocks, toolResults: [] };

  const toolResults: ToolResult[] = [];
  let changed = false;

  const nextBlocks = blocks.map(block => {
    if (block.type === 'compact' && block.compactStatus === 'running') {
      changed = true;
      return {
        ...block,
        compactStatus: 'error' as const,
      };
    }

    if (block.type !== 'tool_use') return block;

    const hasRunningAgentItems = block.agentItems?.some(item =>
      item.status === 'waiting' || item.status === 'running' || item.status === 'waiting_unlock'
    );

    if (block.agentStatus === 'running' || block.agentStatus === 'waiting_unlock' || hasRunningAgentItems) {
      changed = true;
      return {
        ...block,
        agentStatus: 'error' as const,
        agentOutput: block.agentOutput || TERMINATED_RESULT,
        agentToolCalls: markAgentToolCallsTerminated(block.agentToolCalls),
        agentItems: markAgentItemsTerminated(block.agentItems),
        waitingForUnlock: undefined,
      };
    }

    if (block.id) {
      const shellOutput = typeof block.shellOutput === 'string' ? block.shellOutput.trim() : '';
      const content = block.name === 'shell_execute' && shellOutput ? shellOutput : TERMINATED_RESULT;
      toolResults.push({
        toolCallId: block.id,
        content,
        isError: true,
      });
    }

    return block;
  });

  return { blocks: changed ? nextBlocks : blocks, toolResults };
}

export function markMessagesTerminated(messages: Message[]): Message[] {
  return messages.map(m => {
    let changed = false;
    const updated = { ...m };
    if (m.streaming) {
      updated.streaming = false;
      if (!m.content?.trim() && !m.blocks?.length && !m.toolCalls?.length) {
        updated.content = TERMINATED_RESULT;
        updated.isError = true;
      }
      changed = true;
    }

    const existingResultIds = new Set((m.toolResults || []).map(r => r.toolCallId));
    const missingToolResults = (m.toolCalls || [])
      .filter(tc => !existingResultIds.has(tc.id))
      .map(tc => ({
        toolCallId: tc.id,
        content: TERMINATED_RESULT,
        isError: true,
      }));

    const blockUpdate = markBlocksTerminated(m.blocks);
    if (blockUpdate.blocks !== m.blocks) {
      updated.blocks = blockUpdate.blocks;
      changed = true;
    }

    const missingBlockResults = blockUpdate.toolResults.filter(r => !existingResultIds.has(r.toolCallId));
    const missingResults = [...missingToolResults, ...missingBlockResults];
    if (missingResults.length > 0) {
      updated.toolResults = [...(m.toolResults || []), ...missingResults];
      changed = true;
    }

    return changed ? updated : m;
  });
}

export function createToolResultMessage(tc: ToolCall, content: string, isError?: boolean): Message {
  return {
    id: `tool_${tc.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: 'tool',
    content,
    toolCallId: tc.id,
    timestamp: Date.now(),
    toolName: tc.name,
    isError,
  };
}

export function getShellCommandFromToolCall(tc: ToolCall): string {
  if (tc.name !== 'shell_execute') return '';
  try {
    const input = JSON.parse(tc.arguments);
    return String(input.command || '');
  } catch {
    return tc.arguments;
  }
}

export function isDangerousShellToolCall(tc: ToolCall): boolean {
  return tc.name === 'shell_execute' && isDangerousShellCommand(getShellCommandFromToolCall(tc));
}

export function composeUserContent(text: string, attachments: InputAttachment[]): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  return attachments.length > 0 ? '已附加文件' : '';
}

function getErrorText(err: any): string {
  if (!err) return '未知错误';
  if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim();
  const text = String(err);
  return text.trim() || '未知错误';
}

export function buildRequestFailedText(err: any): string {
  return `请求失败:\n\n${getErrorText(err)}`;
}

export function markMessageRequestFailed(message: Message, errorText: string): Message {
  const existingContent = message.content?.trim() || '';
  const nextContent = existingContent
    ? `${existingContent}\n\n${errorText}`
    : errorText;

  if (message.blocks?.length) {
    const errorBlock: ContentBlock = {
      type: 'text',
      content: `${message.blocks.some(block => block.content?.trim()) ? '\n\n' : ''}${errorText}`,
    };
    return {
      ...message,
      content: nextContent,
      blocks: [...message.blocks, errorBlock],
      streaming: false,
      isError: true,
    };
  }

  return {
    ...message,
    content: nextContent,
    streaming: false,
    isError: true,
  };
}

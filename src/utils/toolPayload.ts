import { AgentProgressItem, AgentToolCall, ContentBlock, Message, ToolCall, ToolResult } from '../types';

const LARGE_TOOL_FIELD_LIMIT = 64 * 1024;
const TOOL_CONTENT_PREVIEW_LIMIT = 2 * 1024;
const LARGE_RESULT_FIELD_LIMIT = 128 * 1024;
const RESULT_PREVIEW_HEAD_LIMIT = 8 * 1024;
const RESULT_PREVIEW_TAIL_LIMIT = 8 * 1024;

function createLargeTextPlaceholder(value: string, label: string): string {
  if (value.length <= LARGE_RESULT_FIELD_LIMIT) return value;
  const head = value.slice(0, RESULT_PREVIEW_HEAD_LIMIT);
  const tail = value.slice(value.length - RESULT_PREVIEW_TAIL_LIMIT);
  const omitted = Math.max(0, value.length - head.length - tail.length);
  return [
    head,
    '',
    `[LineCode 已省略 ${omitted} 个字符的${label}，完整内容未写入会话存储。]`,
    '',
    tail,
  ].join('\n');
}

function createLargeContentPlaceholder(value: string): string {
  const preview = value.slice(0, TOOL_CONTENT_PREVIEW_LIMIT);
  const omitted = Math.max(0, value.length - preview.length);
  return [
    preview,
    '',
    `[LineCode 已省略 ${omitted} 个字符的 file_write.content，文件内容已写入目标文件。]`,
  ].join('\n');
}

function sanitizeToolInput(name: string, input: Record<string, unknown>): Record<string, unknown> {
  if (name !== 'file_write' || typeof input.content !== 'string') {
    return input;
  }

  if (input.content.length <= LARGE_TOOL_FIELD_LIMIT) {
    return input;
  }

  return {
    ...input,
    content: createLargeContentPlaceholder(input.content),
    contentOmitted: true,
    originalContentLength: input.content.length,
  };
}

export function sanitizeToolCallForStorage(toolCall: ToolCall): ToolCall {
  if (toolCall.name !== 'file_write' || !toolCall.arguments.includes('"content"')) {
    return toolCall;
  }

  try {
    const input = JSON.parse(toolCall.arguments) as Record<string, unknown>;
    const sanitized = sanitizeToolInput(toolCall.name, input);
    if (sanitized === input) return toolCall;
    return {
      ...toolCall,
      arguments: JSON.stringify(sanitized),
    };
  } catch {
    if (toolCall.arguments.length <= LARGE_TOOL_FIELD_LIMIT) return toolCall;
    return {
      ...toolCall,
      arguments: JSON.stringify({
        argumentsOmitted: true,
        originalArgumentsLength: toolCall.arguments.length,
        preview: toolCall.arguments.slice(0, TOOL_CONTENT_PREVIEW_LIMIT),
      }),
    };
  }
}

function sanitizeAgentToolCall(toolCall: AgentToolCall): AgentToolCall {
  const input = sanitizeToolInput(toolCall.name, toolCall.input || {});
  let nextToolCall = input === toolCall.input ? toolCall : { ...toolCall, input };
  if (typeof nextToolCall.result === 'string') {
    const result = createLargeTextPlaceholder(nextToolCall.result, `${nextToolCall.name} 结果`);
    if (result !== nextToolCall.result) {
      nextToolCall = { ...nextToolCall, result };
    }
  }
  return nextToolCall;
}

function sanitizeAgentItem(item: AgentProgressItem): AgentProgressItem {
  let nextItem = item;
  if (typeof item.output === 'string') {
    const output = createLargeTextPlaceholder(item.output, 'Agent 输出');
    if (output !== item.output) nextItem = { ...nextItem, output };
  }
  if (typeof nextItem.thinking === 'string') {
    const thinking = createLargeTextPlaceholder(nextItem.thinking, 'Agent 思考');
    if (thinking !== nextItem.thinking) nextItem = { ...nextItem, thinking };
  }
  if (nextItem.toolCalls?.length) {
    const toolCalls = nextItem.toolCalls.map(sanitizeAgentToolCall);
    if (toolCalls.some((toolCall, index) => toolCall !== nextItem.toolCalls?.[index])) {
      nextItem = { ...nextItem, toolCalls };
    }
  }
  return nextItem;
}

function sanitizeToolResult(result: ToolResult): ToolResult {
  const content = createLargeTextPlaceholder(result.content, '工具结果');
  return content === result.content ? result : { ...result, content };
}

function sanitizeBlock(block: ContentBlock): ContentBlock {
  let nextBlock = block;

  if (block.type === 'tool_use' && block.name === 'file_write') {
    if (block.input) {
      const input = sanitizeToolInput(block.name, block.input);
      if (input !== block.input) {
        nextBlock = { ...nextBlock, input };
      }
    }
    if (typeof block.content === 'string' && block.content.length > LARGE_TOOL_FIELD_LIMIT) {
      try {
        const input = JSON.parse(block.content) as Record<string, unknown>;
        nextBlock = {
          ...nextBlock,
          content: JSON.stringify(sanitizeToolInput(block.name, input)),
        };
      } catch {
        nextBlock = {
          ...nextBlock,
          content: createLargeContentPlaceholder(block.content),
        };
      }
    }
  }

  if (typeof nextBlock.shellOutput === 'string') {
    const shellOutput = createLargeTextPlaceholder(nextBlock.shellOutput, 'shell 输出');
    if (shellOutput !== nextBlock.shellOutput) {
      nextBlock = { ...nextBlock, shellOutput };
    }
  }

  if (typeof nextBlock.agentOutput === 'string') {
    const agentOutput = createLargeTextPlaceholder(nextBlock.agentOutput, 'Agent 输出');
    if (agentOutput !== nextBlock.agentOutput) {
      nextBlock = { ...nextBlock, agentOutput };
    }
  }

  if (typeof nextBlock.agentThinking === 'string') {
    const agentThinking = createLargeTextPlaceholder(nextBlock.agentThinking, 'Agent 思考');
    if (agentThinking !== nextBlock.agentThinking) {
      nextBlock = { ...nextBlock, agentThinking };
    }
  }

  if (nextBlock.agentToolCalls?.length) {
    nextBlock = {
      ...nextBlock,
      agentToolCalls: nextBlock.agentToolCalls.map(sanitizeAgentToolCall),
    };
  }

  if (nextBlock.agentItems?.length) {
    nextBlock = {
      ...nextBlock,
      agentItems: nextBlock.agentItems.map(sanitizeAgentItem),
    };
  }

  return nextBlock;
}

export function sanitizeMessagesForStorage(messages: Message[]): Message[] {
  return messages.map(message => {
    let nextMessage = message;

    if (message.toolCalls?.length) {
      const toolCalls = message.toolCalls.map(sanitizeToolCallForStorage);
      if (toolCalls.some((toolCall, index) => toolCall !== message.toolCalls?.[index])) {
        nextMessage = { ...nextMessage, toolCalls };
      }
    }

    if (message.blocks?.length) {
      const blocks = message.blocks.map(sanitizeBlock);
      if (blocks.some((block, index) => block !== message.blocks?.[index])) {
        nextMessage = { ...nextMessage, blocks };
      }
    }

    if (message.toolResults?.length) {
      const toolResults = message.toolResults.map(sanitizeToolResult);
      if (toolResults.some((toolResult, index) => toolResult !== message.toolResults?.[index])) {
        nextMessage = { ...nextMessage, toolResults };
      }
    }

    if (message.role === 'tool' && typeof message.content === 'string') {
      const content = createLargeTextPlaceholder(message.content, '工具消息');
      if (content !== message.content) {
        nextMessage = { ...nextMessage, content };
      }
    }

    return nextMessage;
  });
}

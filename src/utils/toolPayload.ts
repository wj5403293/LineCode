import { AgentProgressItem, AgentToolCall, ContentBlock, Message, ToolCall } from '../types';

const LARGE_TOOL_FIELD_LIMIT = 64 * 1024;
const TOOL_CONTENT_PREVIEW_LIMIT = 2 * 1024;

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
  return input === toolCall.input ? toolCall : { ...toolCall, input };
}

function sanitizeAgentItem(item: AgentProgressItem): AgentProgressItem {
  if (!item.toolCalls?.length) return item;
  return {
    ...item,
    toolCalls: item.toolCalls.map(sanitizeAgentToolCall),
  };
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

    return nextMessage;
  });
}

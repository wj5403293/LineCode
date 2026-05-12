import { Message, ContentBlock, ToolResult, ToolCall } from '../types';

export function updateMessageBlock(
  messages: Message[],
  messageId: string,
  blockId: string,
  update: Partial<ContentBlock>,
): Message[] {
  return messages.map(m => {
    if (m.id === messageId && m.blocks) {
      const updatedBlocks = m.blocks.map(b => {
        if (b.type === 'tool_use' && b.id === blockId) {
          return { ...b, ...update };
        }
        return b;
      });
      return { ...m, blocks: updatedBlocks };
    }
    return m;
  });
}

export function addToolResult(
  messages: Message[],
  toolCallId: string,
  result: ToolResult,
): Message[] {
  return messages.map(m => {
    if (m.role === 'assistant' && m.toolCalls?.some(t => t.id === toolCallId)) {
      const existingResults = m.toolResults || [];
      return {
        ...m,
        toolResults: [...existingResults, result],
      };
    }
    return m;
  });
}

export function createToolMessage(
  tc: ToolCall,
  content: string,
  isError?: boolean,
): Message {
  return {
    id: `tool_${tc.id}_${Date.now()}`,
    role: 'tool',
    content,
    toolCallId: tc.id,
    timestamp: Date.now(),
    toolName: tc.name,
    isError,
  };
}

export function createAIMessage(id: string): Message {
  return {
    id,
    role: 'assistant',
    content: '',
    blocks: [],
    timestamp: Date.now(),
    streaming: true,
  };
}

export function finalizeAIMessage(
  id: string,
  result: {
    text: string;
    blocks: ContentBlock[];
    toolCalls?: ToolCall[];
    reasoningContent?: string;
    reasoningDetails?: Record<string, unknown>[];
  },
): Message {
  return {
    id,
    role: 'assistant',
    content: result.text,
    blocks: result.blocks,
    toolCalls: result.toolCalls,
    timestamp: Date.now(),
    streaming: false,
    reasoningContent: result.reasoningContent,
    reasoningDetails: result.reasoningDetails,
  };
}

export function addToolUseBlock(
  messages: Message[],
  messageId: string,
  toolCall: { id: string; name: string },
): Message[] {
  return messages.map(m => {
    if (m.id === messageId) {
      const existingBlocks = m.blocks || [];
      const hasToolBlock = existingBlocks.some(b => b.type === 'tool_use' && b.id === toolCall.id);
      if (!hasToolBlock) {
        const newBlock: ContentBlock = {
          type: 'tool_use',
          id: toolCall.id,
          name: toolCall.name,
          content: '',
        };
        return { ...m, blocks: [...existingBlocks, newBlock] };
      }
    }
    return m;
  });
}

export function updateAIMessageWithBlocks(
  messages: Message[],
  messageId: string,
  blocks: ContentBlock[],
): Message[] {
  return messages.map(m =>
    m.id === messageId
      ? { ...m, blocks, content: blocks.filter(b => b.type === 'text').map(b => b.content).join('') }
      : m,
  );
}

export function appendMessage(messages: Message[], newMessage: Message): Message[] {
  return [...messages, newMessage];
}

export function updateLastStreamingMessage(
  messages: Message[],
  content: string,
): Message[] {
  const last = messages[messages.length - 1];
  if (last?.streaming) {
    return messages.map(m =>
      m.id === last.id
        ? { ...m, content, streaming: false }
        : m,
    );
  }
  return messages;
}

import { useRef, useCallback } from 'react';
import { Message, Model, ToolCall, ContentBlock } from '../../types';
import { aiService, ChatMessage } from '../../services/ai';
import { executeTool, needsConfirmation, getHomePath } from '../../mcp/ToolExecutor';
import { ToneMode, ReasoningEffort } from '../../services/settings';

export function useChatStream(
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  conversationId: string | null,
  summarizeTitle: (model: Model, firstUserMsg: string, firstAiMsg: string) => Promise<void>,
  toChatMessages: (msgs: Message[]) => ChatMessage[],
  toneMode: ToneMode,
  reasoningEffort: ReasoningEffort,
) {
  const streamingRef = useRef(false);
  const atBottomRef = useRef(true);
  const abortRef = useRef(false);

  const scrollToBottom = useCallback((animated = true) => {
    if (atBottomRef.current) {
      // 由外部处理滚动
    }
  }, []);

  const createAIMessage = useCallback((id: string): Message => ({
    id,
    role: 'assistant' as const,
    content: '',
    blocks: [],
    timestamp: Date.now(),
    streaming: true,
  }), []);

  const updateAIMessageWithBlocks = useCallback((
    aiId: string,
    blocks: ContentBlock[],
  ) => {
    setMessages(prev => prev.map(m =>
      m.id === aiId
        ? { ...m, blocks, content: blocks.filter(b => b.type === 'text').map(b => b.content).join('') }
        : m,
    ));
  }, [setMessages]);

  const addToolUseBlock = useCallback((
    aiId: string,
    toolCall: { id: string; name: string },
  ) => {
    setMessages(prev => prev.map(m => {
      if (m.id === aiId) {
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
    }));
  }, [setMessages]);

  const updateToolBlockProgress = useCallback((
    tcId: string,
    update: Partial<ContentBlock>,
  ) => {
    setMessages(prev => prev.map(m => {
      if (m.role === 'assistant' && m.blocks) {
        const updatedBlocks = m.blocks.map(b => {
          if (b.type === 'tool_use' && b.id === tcId) {
            return { ...b, ...update };
          }
          return b;
        });
        return { ...m, blocks: updatedBlocks };
      }
      return m;
    }));
  }, [setMessages]);

  const finalizeAIMessage = useCallback((
    aiId: string,
    result: {
      text: string;
      blocks: ContentBlock[];
      toolCalls?: ToolCall[];
      reasoningContent?: string;
    },
  ): Message => ({
    id: aiId,
    role: 'assistant' as const,
    content: result.text,
    blocks: result.blocks,
    toolCalls: result.toolCalls,
    timestamp: Date.now(),
    streaming: false,
    reasoningContent: result.reasoningContent,
  }), []);

  const createToolMessage = useCallback((
    tc: ToolCall,
    content: string,
    isError?: boolean,
  ): Message => ({
    id: `tool_${tc.id}_${Date.now()}`,
    role: 'tool' as const,
    content,
    toolCallId: tc.id,
    timestamp: Date.now(),
    toolName: tc.name,
    isError,
  }), []);

  const updateMessagesWithToolResult = useCallback((
    prev: Message[],
    tc: ToolCall,
    content: string,
    isError?: boolean,
  ) => {
    const toolMsg = createToolMessage(tc, content, isError);
    const updated = [...prev, toolMsg];
    return updated.map(m => {
      if (m.role === 'assistant' && m.toolCalls?.some(t => t.id === tc.id)) {
        const existingResults = m.toolResults || [];
        return {
          ...m,
          toolResults: [...existingResults, {
            toolCallId: tc.id,
            content,
            isError,
          }],
        };
      }
      return m;
    });
  }, [createToolMessage]);

  return {
    streamingRef,
    atBottomRef,
    abortRef,
    scrollToBottom,
    createAIMessage,
    updateAIMessageWithBlocks,
    addToolUseBlock,
    updateToolBlockProgress,
    finalizeAIMessage,
    createToolMessage,
    updateMessagesWithToolResult,
  };
}

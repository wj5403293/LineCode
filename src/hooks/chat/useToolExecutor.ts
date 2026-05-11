import { useState, useCallback } from 'react';
import { Message, ToolCall, ContentBlock } from '../../types';
import { executeTool, ExecuteToolOptions } from '../../mcp/ToolExecutor';

interface PendingToolCall {
  toolCalls: ToolCall[];
  localMessages: Message[];
  text: string;
}

export function useToolExecutor(
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
) {
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null);

  const executeToolWithProgress = useCallback(async (
    tc: ToolCall,
    options?: ExecuteToolOptions,
  ) => {
    return executeTool(tc, {
      ...options,
      onProgress: (update: Partial<ContentBlock>) => {
        if (tc.name === 'agent') {
          setMessages(prev => prev.map(m => {
            if (m.role === 'assistant' && m.blocks) {
              const updatedBlocks = m.blocks.map(b => {
                if (b.type === 'tool_use' && b.id === tc.id) {
                  return { ...b, ...update };
                }
                return b;
              });
              return { ...m, blocks: updatedBlocks };
            }
            return m;
          }));
        }
        options?.onProgress?.(update);
      },
    });
  }, [setMessages]);

  const createToolMessage = useCallback((tc: ToolCall, content: string, isError?: boolean): Message => {
    return {
      id: `tool_${tc.id}_${Date.now()}`,
      role: 'tool',
      content,
      toolCallId: tc.id,
      timestamp: Date.now(),
      toolName: tc.name,
      isError,
    };
  }, []);

  const updateAssistantWithToolResult = useCallback((
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
    pendingToolCall,
    setPendingToolCall,
    executeToolWithProgress,
    createToolMessage,
    updateAssistantWithToolResult,
  };
}

import { useState, useCallback } from 'react';
import { Message } from '../../types';
import { ChatMessage } from '../../services/ai';

export function useMessageManager() {
  const [messages, setMessages] = useState<Message[]>([]);

  const clearMessages = useCallback(() => setMessages([]), []);

  const toChatMessages = useCallback((msgs: Message[]): ChatMessage[] => {
    return msgs.map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolCallId: m.toolCallId,
      reasoningContent: m.reasoningContent,
    }));
  }, []);

  return {
    messages,
    setMessages,
    clearMessages,
    toChatMessages,
  };
}

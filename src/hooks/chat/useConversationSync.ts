import { useState, useEffect, useCallback } from 'react';
import { Message, Model } from '../../types';
import { conversationStore } from '../../services/conversation';
import { aiService } from '../../services/ai';

export function useConversationSync(
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
) {
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (conversationId && messages.length > 0) {
      conversationStore.updateConversation(conversationId, { messages });
    }
  }, [conversationId, messages]);

  const summarizeTitle = useCallback(async (model: Model, firstUserMsg: string, firstAiMsg: string) => {
    try {
      const result = await aiService.sendMessage(model, [
        { role: 'system', content: '用不超过10个字总结这段对话的主题，只输出标题，不要任何标点符号。' },
        { role: 'user', content: `用户: ${firstUserMsg}\n助手: ${firstAiMsg}` },
      ]);
      const title = result.text.trim().slice(0, 20);
      if (title && conversationId) {
        conversationStore.updateConversation(conversationId, { title });
      }
    } catch {}
  }, [conversationId]);

  const initConversation = useCallback(async () => {
    const convId = await conversationStore.getCurrentConversationId();
    if (convId) {
      const conversations = await conversationStore.getConversations();
      const conv = conversations.find(c => c.id === convId);
      if (conv) {
        setConversationId(conv.id);
        setMessages(conv.messages);
        return conv.id;
      }
    }
    return null;
  }, [setMessages]);

  const createNewConversation = useCallback(async () => {
    const conv = await conversationStore.createConversation();
    setConversationId(conv.id);
    return conv.id;
  }, []);

  return {
    conversationId,
    setConversationId,
    summarizeTitle,
    initConversation,
    createNewConversation,
  };
}

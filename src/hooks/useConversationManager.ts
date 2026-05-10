import { useState, useCallback } from 'react';
import { conversationStore } from '../services/conversation';

export function useConversationManager() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const handleNewConversation = useCallback(async () => {
    const conv = await conversationStore.createConversation();
    setConversationId(conv.id);
    setSidebarVisible(false);
    return conv;
  }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    const conversations = await conversationStore.getConversations();
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setConversationId(conv.id);
      await conversationStore.setCurrentConversationId(id);
    }
    setSidebarVisible(false);
    return conv;
  }, []);

  const openSidebar = useCallback(() => setSidebarVisible(true), []);
  const closeSidebar = useCallback(() => setSidebarVisible(false), []);

  return {
    conversationId,
    setConversationId,
    sidebarVisible,
    handleNewConversation,
    handleSelectConversation,
    openSidebar,
    closeSidebar,
  };
}

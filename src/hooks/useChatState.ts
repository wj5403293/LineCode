import { useState, useRef, useCallback, useEffect } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, FlatList } from 'react-native';
import { Message, Model } from '../types';
import { modelStorage } from '../services/storage';
import { aiService } from '../services/ai';
import { conversationStore } from '../services/conversation';
import { ToneMode } from '../services/settings';

export function useChatState(toneMode: ToneMode) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const streamingRef = useRef(false);
  const atBottomRef = useRef(true);

  // Load model and conversation on mount
  useEffect(() => {
    (async () => {
      const [models, selectedId, convId] = await Promise.all([
        modelStorage.getModels(),
        modelStorage.getSelectedModelId(),
        conversationStore.getCurrentConversationId(),
      ]);

      if (selectedId) {
        setModel(models.find(m => m.id === selectedId) || null);
      } else if (models.length > 0) {
        setModel(models[0]);
      }

      if (convId) {
        const conversations = await conversationStore.getConversations();
        const conv = conversations.find(c => c.id === convId);
        if (conv) {
          setConversationId(conv.id);
          setMessages(conv.messages);
        }
      }

      setLoading(false);
    })();
  }, []);

  // Auto-save messages
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      conversationStore.updateConversation(conversationId, { messages });
    }
  }, [conversationId, messages]);

  const scrollToBottom = useCallback((animated = true) => {
    if (atBottomRef.current) {
      flatListRef.current?.scrollToEnd({ animated });
    }
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 80;
    atBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  }, []);

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

  const handleSend = useCallback(async (text: string) => {
    if (!model || streamingRef.current) return;

    let convId = conversationId;
    if (!convId) {
      const conv = await conversationStore.createConversation();
      convId = conv.id;
      setConversationId(conv.id);
    }

    const now = Date.now();
    const userMsg: Message = { id: String(now), role: 'user', content: text, timestamp: now };
    const aiId = String(now + 1);

    atBottomRef.current = true;
    setMessages(prev => [...prev, userMsg, {
      id: aiId, role: 'assistant', content: '', blocks: [], timestamp: now + 1, streaming: true,
    }]);

    streamingRef.current = true;

    try {
      const chatMessages = aiService.buildMessages(
        '',
        [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        toneMode,
      );

      const result = await aiService.sendMessage(model, chatMessages, {
        onBlocks: (blocks) => {
          setMessages(prev => prev.map(m =>
            m.id === aiId ? { ...m, blocks, content: blocks.filter(b => b.type === 'text').map(b => b.content).join('') } : m,
          ));
          scrollToBottom(false);
        },
      });

      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === aiId ? { ...m, content: result.text, blocks: result.blocks, streaming: false } : m,
        );
        if (messages.length === 0) {
          summarizeTitle(model, text, result.text);
        }
        return updated;
      });
    } catch (err: any) {
      console.error('[LineAI] sendMessage error:', err);
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, content: `错误: ${err.message || '请求失败'}`, streaming: false } : m,
      ));
    } finally {
      streamingRef.current = false;
    }
  }, [model, messages, conversationId, scrollToBottom, summarizeTitle, toneMode]);

  const clearMessages = useCallback(() => setMessages([]), []);

  return {
    messages,
    setMessages,
    model,
    loading,
    conversationId,
    setConversationId,
    flatListRef,
    streamingRef,
    handleSend,
    scrollToBottom,
    handleScroll,
    clearMessages,
  };
}

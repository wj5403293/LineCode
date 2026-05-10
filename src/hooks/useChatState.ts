import { useState, useRef, useCallback, useEffect } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, FlatList } from 'react-native';
import { Message, Model, ToolCall } from '../types';
import { modelStorage } from '../services/storage';
import { aiService, ChatMessage } from '../services/ai';
import { conversationStore } from '../services/conversation';
import { ToneMode } from '../services/settings';
import { executeTool } from '../mcp/ToolExecutor';

export function useChatState(toneMode: ToneMode) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const streamingRef = useRef(false);
  const atBottomRef = useRef(true);

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

  /**
   * 将本地 messages 数组转为 ChatMessage 数组，用于 API 调用。
   * 关键：保留 assistant 的 toolCalls 和 tool 消息的 toolCallId。
   */
  const toChatMessages = useCallback((msgs: Message[]): ChatMessage[] => {
    return msgs.map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolCallId: m.toolCallId,
    }));
  }, []);

  /**
   * 核心：对话循环引擎
   * 1. 发送消息给 AI
   * 2. 如果 AI 返回 tool_calls → 执行工具 → 把 tool_result 加入消息 → 回到 1
   * 3. 如果没有 tool_calls → 结束
   */
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

    atBottomRef.current = true;

    // 追加用户消息
    setMessages(prev => [...prev, userMsg]);
    streamingRef.current = true;

    // 本地消息累加器（包含 tool_calls 和 tool_result）
    const localMessages: Message[] = [...messages, userMsg];
    try {
      while (true) {
        // 创建 AI 消息占位符
        const aiId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const aiPlaceholder: Message = {
          id: aiId, role: 'assistant', content: '', blocks: [], timestamp: Date.now(), streaming: true,
        };

        setMessages(prev => [...prev, aiPlaceholder]);

        // 构建 API 消息
        const chatMessages = await aiService.buildMessages('', toChatMessages(localMessages), toneMode);

        // 调用 AI
        const result = await aiService.sendMessage(model, chatMessages, {
          onBlocks: (blocks) => {
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, blocks, content: blocks.filter(b => b.type === 'text').map(b => b.content).join('') } : m,
            ));
            scrollToBottom(false);
          },
        });

        // 构建 assistant 消息（包含 toolCalls）
        const assistantMsg: Message = {
          id: aiId,
          role: 'assistant',
          content: result.text,
          blocks: result.blocks,
          toolCalls: result.toolCalls,
          timestamp: Date.now(),
          streaming: false,
        };

        // 更新 UI 和本地消息
        setMessages(prev => prev.map(m => m.id === aiId ? assistantMsg : m));
        localMessages.push(assistantMsg);

        // 没有 tool_calls → 对话结束
        if (!result.toolCalls || result.toolCalls.length === 0) {
          if (messages.length === 0) {
            summarizeTitle(model, text, result.text);
          }
          break;
        }

        // 有 tool_calls → 逐个执行工具
        for (const tc of result.toolCalls) {
          const toolResult = await executeTool(tc);

          const toolMsg: Message = {
            id: `tool_${tc.id}_${Date.now()}`,
            role: 'tool',
            content: toolResult.content,
            toolCallId: tc.id,
            timestamp: Date.now(),
            toolName: tc.name,
          };

          // 追加 tool_result 到消息列表
          localMessages.push(toolMsg);
          setMessages(prev => [...prev, toolMsg]);
        }

        // 循环继续：下一轮会把包含 tool_result 的历史发送给 AI
      }
    } catch (err: any) {
      console.error('[LineCode] sendMessage error:', err);
      const errMsg = err?.message || String(err) || '请求失败';
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          return prev.map(m => m.id === last.id
            ? { ...m, content: `请求失败: ${errMsg}`, streaming: false }
            : m
          );
        }
        return [...prev, {
          id: `err_${Date.now()}`,
          role: 'assistant' as const,
          content: `请求失败: ${errMsg}`,
          timestamp: Date.now(),
        }];
      });
    } finally {
      streamingRef.current = false;
    }
  }, [model, messages, conversationId, scrollToBottom, summarizeTitle, toneMode, toChatMessages]);

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

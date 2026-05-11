import { useState, useRef, useCallback, useEffect } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, FlatList } from 'react-native';
import { Message, Model, ToolCall, ContentBlock } from '../types';
import { modelStorage } from '../services/storage';
import { aiService, ChatMessage } from '../services/ai';
import { ToneMode, ReasoningEffort } from '../services/settings';
import { executeTool, needsConfirmation, getHomePath } from '../mcp/ToolExecutor';
import { conversationStore } from '../services/conversation';

interface PendingToolCall {
  toolCalls: ToolCall[];
  localMessages: Message[];
  text: string;
}

function isConcurrencySafe(tc: ToolCall): boolean {
  if (tc.name === 'file_read' || tc.name === 'glob') {
    return true;
  }
  if (tc.name === 'agent') {
    try {
      const input = JSON.parse(tc.arguments);
      return input.type === 'explore';
    } catch {
      return false;
    }
  }
  return false;
}

export function useChatState(toneMode: ToneMode, reasoningEffort: ReasoningEffort) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null);
  const [homePath, setHomePath] = useState<string>('');
  const [streaming, setStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const streamingRef = useRef(false);
  const atBottomRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getHomePath().then(setHomePath);
  }, []);

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
        const conv = await conversationStore.getConversation(convId);
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

  const toChatMessages = useCallback((msgs: Message[]): ChatMessage[] => {
    return msgs.map(m => ({
      role: m.role,
      content: m.content,
      toolCalls: m.toolCalls,
      toolCallId: m.toolCallId,
      reasoningContent: m.reasoningContent,
    }));
  }, []);

  const executeToolCall = useCallback(async (
    tc: ToolCall,
    abortSignal: AbortSignal,
  ): Promise<{ toolMsg: Message; toolResult: { content: string; isError?: boolean } }> => {
    const toolResult = await executeTool(tc, {
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
      },
    });

    const toolMsg: Message = {
      id: `tool_${tc.id}_${Date.now()}`,
      role: 'tool',
      content: toolResult.content,
      toolCallId: tc.id,
      timestamp: Date.now(),
      toolName: tc.name,
    };

    return { toolMsg, toolResult };
  }, []);

  const executeToolCalls = useCallback(async (
    toolCalls: ToolCall[],
    localMessages: Message[],
    abortSignal: AbortSignal,
  ): Promise<void> => {
    const concurrentTasks: ToolCall[] = [];
    const sequentialTasks: ToolCall[] = [];

    for (const tc of toolCalls) {
      if (isConcurrencySafe(tc)) {
        concurrentTasks.push(tc);
      } else {
        sequentialTasks.push(tc);
      }
    }

    if (concurrentTasks.length > 0) {
      const results = await Promise.all(
        concurrentTasks.map(tc => executeToolCall(tc, abortSignal))
      );

      for (const { toolMsg, toolResult } of results) {
        localMessages.push(toolMsg);
        setMessages(prev => {
          const updated = [...prev, toolMsg];
          return updated.map(m => {
            if (m.role === 'assistant' && m.toolCalls?.some(t => t.id === toolMsg.toolCallId)) {
              const existingResults = m.toolResults || [];
              return {
                ...m,
                toolResults: [...existingResults, {
                  toolCallId: toolMsg.toolCallId!,
                  content: toolResult.content,
                  isError: toolResult.isError,
                }],
              };
            }
            return m;
          });
        });
      }
    }

    for (const tc of sequentialTasks) {
      if (abortSignal.aborted) break;

      const { toolMsg, toolResult } = await executeToolCall(tc, abortSignal);
      localMessages.push(toolMsg);
      setMessages(prev => {
        const updated = [...prev, toolMsg];
        return updated.map(m => {
          if (m.role === 'assistant' && m.toolCalls?.some(t => t.id === tc.id)) {
            const existingResults = m.toolResults || [];
            return {
              ...m,
              toolResults: [...existingResults, {
                toolCallId: tc.id,
                content: toolResult.content,
                isError: toolResult.isError,
              }],
            };
          }
          return m;
        });
      });
    }
  }, [executeToolCall]);

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

    setMessages(prev => [...prev, userMsg]);
    streamingRef.current = true;
    setStreaming(true);

    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    const localMessages: Message[] = [...messages, userMsg];
    try {
      while (true) {
        if (abortSignal.aborted) {
          console.log('[LineCode] Aborted by user');
          break;
        }

        const aiId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const aiPlaceholder: Message = {
          id: aiId, role: 'assistant', content: '', blocks: [], timestamp: Date.now(), streaming: true,
        };

        setMessages(prev => [...prev, aiPlaceholder]);

        const chatMessages = await aiService.buildMessages('', toChatMessages(localMessages), toneMode, homePath);

        const result = await aiService.sendMessage(model, chatMessages, {
          onBlocks: (blocks) => {
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, blocks, content: blocks.filter(b => b.type === 'text').map(b => b.content).join('') } : m,
            ));
            scrollToBottom(false);
          },
          onToolCallDetected: (toolCall) => {
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
            scrollToBottom(false);
          },
        }, reasoningEffort, undefined, abortSignal);

        const assistantMsg: Message = {
          id: aiId,
          role: 'assistant',
          content: result.text,
          blocks: result.blocks,
          toolCalls: result.toolCalls,
          timestamp: Date.now(),
          streaming: false,
          reasoningContent: result.reasoningContent,
        };

        setMessages(prev => prev.map(m => m.id === aiId ? assistantMsg : m));
        localMessages.push(assistantMsg);

        if (!result.toolCalls || result.toolCalls.length === 0) {
          if (messages.length === 0) {
            summarizeTitle(model, text, result.text);
          }
          break;
        }

        const confirmToolCalls: ToolCall[] = [];
        const normalToolCalls: ToolCall[] = [];
        
        for (const tc of result.toolCalls) {
          if (needsConfirmation(tc)) {
            confirmToolCalls.push(tc);
          } else {
            normalToolCalls.push(tc);
          }
        }

        await executeToolCalls(normalToolCalls, localMessages, abortSignal);

        if (abortSignal.aborted) break;

        if (confirmToolCalls.length > 0) {
          setPendingToolCall({ toolCalls: confirmToolCalls, localMessages: [...localMessages], text });
          streamingRef.current = false;
          return;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LineCode] Request aborted by user');
      } else {
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
      }
    } finally {
      streamingRef.current = false;
      setStreaming(false);
      abortControllerRef.current = null;
    }
  }, [model, messages, conversationId, scrollToBottom, summarizeTitle, toneMode, toChatMessages, homePath, reasoningEffort, executeToolCalls]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    streamingRef.current = false;
    setStreaming(false);
    setPendingToolCall(null);
  }, []);

  const clearMessages = useCallback(() => setMessages([]), []);

  const handleToolConfirm = useCallback(async (confirmed: boolean) => {
    if (!pendingToolCall || !model) return;

    const { toolCalls, localMessages, text } = pendingToolCall;
    setPendingToolCall(null);

    if (!confirmed) {
      for (const tc of toolCalls) {
        const cancelMsg: Message = {
          id: `tool_${tc.id}_${Date.now()}`,
          role: 'tool',
          content: '用户取消了此操作',
          toolCallId: tc.id,
          timestamp: Date.now(),
          toolName: tc.name,
        };
        localMessages.push(cancelMsg);
        setMessages(prev => [...prev, cancelMsg]);
      }
      streamingRef.current = false;
      return;
    }

    streamingRef.current = true;

    abortControllerRef.current = new AbortController();
    const abortSignal = abortControllerRef.current.signal;

    await executeToolCalls(toolCalls, localMessages, abortSignal);

    if (abortSignal.aborted) {
      streamingRef.current = false;
      return;
    }

    try {
      while (true) {
        const aiId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const aiPlaceholder: Message = {
          id: aiId, role: 'assistant', content: '', blocks: [], timestamp: Date.now(), streaming: true,
        };
        setMessages(prev => [...prev, aiPlaceholder]);

        const chatMessages = await aiService.buildMessages('', toChatMessages(localMessages), toneMode, homePath);
        const result = await aiService.sendMessage(model, chatMessages, {
          onBlocks: (blocks) => {
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, blocks, content: blocks.filter(b => b.type === 'text').map(b => b.content).join('') } : m,
            ));
            scrollToBottom(false);
          },
          onToolCallDetected: (toolCallInfo) => {
            setMessages(prev => prev.map(m => {
              if (m.id === aiId) {
                const existingBlocks = m.blocks || [];
                const hasToolBlock = existingBlocks.some(b => b.type === 'tool_use' && b.id === toolCallInfo.id);
                if (!hasToolBlock) {
                  const newBlock: ContentBlock = {
                    type: 'tool_use',
                    id: toolCallInfo.id,
                    name: toolCallInfo.name,
                    content: '',
                  };
                  return { ...m, blocks: [...existingBlocks, newBlock] };
                }
              }
              return m;
            }));
            scrollToBottom(false);
          },
        }, reasoningEffort, undefined, abortSignal);

        const assistantMsg: Message = {
          id: aiId,
          role: 'assistant',
          content: result.text,
          blocks: result.blocks,
          toolCalls: result.toolCalls,
          timestamp: Date.now(),
          streaming: false,
          reasoningContent: result.reasoningContent,
        };

        setMessages(prev => prev.map(m => m.id === aiId ? assistantMsg : m));
        localMessages.push(assistantMsg);

        if (!result.toolCalls || result.toolCalls.length === 0) {
          if (messages.length === 0) {
            summarizeTitle(model, text, result.text);
          }
          break;
        }

        const confirmToolCalls: ToolCall[] = [];
        const normalToolCalls: ToolCall[] = [];
        
        for (const tc of result.toolCalls) {
          if (needsConfirmation(tc)) {
            confirmToolCalls.push(tc);
          } else {
            normalToolCalls.push(tc);
          }
        }

        await executeToolCalls(normalToolCalls, localMessages, abortSignal);

        if (abortSignal.aborted) break;

        if (confirmToolCalls.length > 0) {
          setPendingToolCall({ toolCalls: confirmToolCalls, localMessages: [...localMessages], text });
          streamingRef.current = false;
          return;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LineCode] Request aborted by user');
      } else {
        console.error('[LineCode] handleToolConfirm error:', err);
      }
    } finally {
      streamingRef.current = false;
      abortControllerRef.current = null;
    }
  }, [pendingToolCall, model, messages, toneMode, toChatMessages, scrollToBottom, summarizeTitle, homePath, reasoningEffort, executeToolCalls]);

  return {
    messages,
    setMessages,
    model,
    loading,
    conversationId,
    setConversationId,
    flatListRef,
    streaming,
    handleSend,
    handleStop,
    scrollToBottom,
    handleScroll,
    clearMessages,
    pendingToolCall,
    homePath,
    handleToolConfirm,
  };
}

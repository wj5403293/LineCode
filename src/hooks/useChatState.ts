import { useState, useRef, useCallback, useEffect } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, FlatList } from 'react-native';
import { Message, Model, ContentBlock, ToolCall } from '../types';
import { modelStorage } from '../services/storage';
import { aiService, ChatMessage } from '../services/ai';
import { conversationStore } from '../services/conversation';
import { ToneMode, ReasoningEffort } from '../services/settings';
import { executeTool, needsConfirmation, getHomePath, ExecuteToolOptions } from '../mcp/ToolExecutor';

interface PendingToolCall {
  toolCalls: ToolCall[];
  localMessages: Message[];
  text: string;
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
  const abortRef = useRef(false);

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
      reasoningContent: m.reasoningContent,
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
    setStreaming(true);
    abortRef.current = false;

    // 本地消息累加器（包含 tool_calls 和 tool_result）
    const localMessages: Message[] = [...messages, userMsg];
    try {
      while (true) {
        // 检查是否被终止
        if (abortRef.current) {
          console.log('[LineCode] Aborted by user');
          break;
        }

        console.log('[LineCode] Loop iteration, localMessages:', localMessages.map(m => ({ role: m.role, content: m.content?.substring(0, 50), toolCalls: m.toolCalls?.length, toolCallId: m.toolCallId })));
        
        // 创建 AI 消息占位符
        const aiId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const aiPlaceholder: Message = {
          id: aiId, role: 'assistant', content: '', blocks: [], timestamp: Date.now(), streaming: true,
        };

        setMessages(prev => [...prev, aiPlaceholder]);

        // 构建 API 消息
        const chatMessages = await aiService.buildMessages('', toChatMessages(localMessages), toneMode, homePath);
        console.log('[LineCode] Built chatMessages:', chatMessages.length);

        // 调用 AI
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
        }, reasoningEffort);

        // 构建 assistant 消息（包含 toolCalls）
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

        console.log('[LineCode] AI result - text:', result.text?.substring(0, 100), 'blocks:', result.blocks?.length, 'toolCalls:', result.toolCalls?.length, 'reasoning:', result.reasoningContent?.substring(0, 50));

        // 更新 UI 和本地消息
        setMessages(prev => prev.map(m => m.id === aiId ? assistantMsg : m));
        localMessages.push(assistantMsg);

        // 没有 tool_calls → 对话结束
        if (!result.toolCalls || result.toolCalls.length === 0) {
          console.log('[LineCode] No tool_calls, ending loop, AI response:', result.text?.substring(0, 200));
          if (messages.length === 0) {
            summarizeTitle(model, text, result.text);
          }
          break;
        }

        console.log('[LineCode] Found tool_calls:', result.toolCalls.length);

        const confirmToolCalls: ToolCall[] = [];
        const normalToolCalls: ToolCall[] = [];
        
        for (const tc of result.toolCalls) {
          if (needsConfirmation(tc)) {
            confirmToolCalls.push(tc);
          } else {
            normalToolCalls.push(tc);
          }
        }

        for (const tc of normalToolCalls) {
          console.log('[LineCode] Executing tool:', tc.name, 'id:', tc.id);
          
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
          
          console.log('[LineCode] Tool result:', toolResult.content?.substring(0, 100));

          const toolMsg: Message = {
            id: `tool_${tc.id}_${Date.now()}`,
            role: 'tool',
            content: toolResult.content,
            toolCallId: tc.id,
            timestamp: Date.now(),
            toolName: tc.name,
          };

          localMessages.push(toolMsg);
          console.log('[LineCode] localMessages length:', localMessages.length);
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

        if (confirmToolCalls.length > 0) {
          console.log('[LineCode] Tools need confirmation:', confirmToolCalls.map(t => t.name));
          setPendingToolCall({ toolCalls: confirmToolCalls, localMessages: [...localMessages], text });
          streamingRef.current = false;
          return;
        }

        console.log('[LineCode] Continuing loop with', localMessages.length, 'messages');
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
      setStreaming(false);
    }
  }, [model, messages, conversationId, scrollToBottom, summarizeTitle, toneMode, toChatMessages]);

  const handleStop = useCallback(() => {
    abortRef.current = true;
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
    console.log('[LineCode] User confirmed, executing tools:', toolCalls.map(t => t.name));

    for (const tc of toolCalls) {
      console.log('[LineCode] Executing tool:', tc.name, 'id:', tc.id);
      
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
      
      console.log('[LineCode] Tool result:', toolResult.content?.substring(0, 100));

      const toolMsg: Message = {
        id: `tool_${tc.id}_${Date.now()}`,
        role: 'tool',
        content: toolResult.content,
        toolCallId: tc.id,
        timestamp: Date.now(),
        toolName: tc.name,
      };

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
        }, reasoningEffort);

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

        for (const tc of normalToolCalls) {
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

        if (confirmToolCalls.length > 0) {
          setPendingToolCall({ toolCalls: confirmToolCalls, localMessages: [...localMessages], text });
          streamingRef.current = false;
          return;
        }
      }
    } catch (err: any) {
      console.error('[LineCode] handleToolConfirm error:', err);
    } finally {
      streamingRef.current = false;
    }
  }, [pendingToolCall, model, messages, toneMode, toChatMessages, scrollToBottom, summarizeTitle]);

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

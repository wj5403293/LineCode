import { useState, useRef, useCallback, useEffect } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, FlatList } from 'react-native';
import { Message, Model, ToolCall, ContentBlock, AgentToolCall, ToolResult } from '../types';
import { modelStorage } from '../services/storage';
import { aiService, ChatMessage } from '../services/ai';
import { ToneMode, ReasoningEffort } from '../services/settings';
import { executeTool, needsConfirmation, getHomePath } from '../mcp/ToolExecutor';
import { agentToolManager } from '../mcp/AgentToolManager';
import { conversationStore } from '../services/conversation';
import { isDangerousShellCommand } from '../utils/shellSafety';

interface PendingToolCall {
  toolCalls: ToolCall[];
  localMessages: Message[];
  text: string;
  type?: 'delete' | 'shell';
  confirmResolve?: (confirmed: boolean) => void;
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

const TERMINATED_RESULT = '已终止';

function markAgentToolCallsTerminated(toolCalls?: AgentToolCall[]): AgentToolCall[] | undefined {
  if (!toolCalls) return toolCalls;
  return toolCalls.map(tc => {
    if (tc.result) return tc;
    return {
      ...tc,
      result: TERMINATED_RESULT,
      isError: true,
    };
  });
}

function markBlocksTerminated(blocks?: ContentBlock[]): {
  blocks?: ContentBlock[];
  toolResults: ToolResult[];
} {
  if (!blocks) return { blocks, toolResults: [] };

  const toolResults: ToolResult[] = [];
  let changed = false;

  const nextBlocks = blocks.map(block => {
    if (block.type !== 'tool_use') return block;

    if (block.agentStatus === 'running' || block.agentStatus === 'waiting_unlock') {
      changed = true;
      return {
        ...block,
        agentStatus: 'error' as const,
        agentOutput: block.agentOutput || TERMINATED_RESULT,
        agentToolCalls: markAgentToolCallsTerminated(block.agentToolCalls),
        waitingForUnlock: undefined,
      };
    }

    if (block.id) {
      toolResults.push({
        toolCallId: block.id,
        content: TERMINATED_RESULT,
        isError: true,
      });
    }

    return block;
  });

  return { blocks: changed ? nextBlocks : blocks, toolResults };
}

function markMessagesTerminated(messages: Message[]): Message[] {
  return messages.map(m => {
    let changed = false;
    const updated = { ...m };
    if (m.streaming) {
      updated.streaming = false;
      if (!m.content?.trim() && !m.blocks?.length && !m.toolCalls?.length) {
        updated.content = TERMINATED_RESULT;
        updated.isError = true;
      }
      changed = true;
    }

    const existingResultIds = new Set((m.toolResults || []).map(r => r.toolCallId));
    const missingToolResults = (m.toolCalls || [])
      .filter(tc => !existingResultIds.has(tc.id))
      .map(tc => ({
        toolCallId: tc.id,
        content: TERMINATED_RESULT,
        isError: true,
      }));

    const blockUpdate = markBlocksTerminated(m.blocks);
    if (blockUpdate.blocks !== m.blocks) {
      updated.blocks = blockUpdate.blocks;
      changed = true;
    }

    const missingBlockResults = blockUpdate.toolResults.filter(r => !existingResultIds.has(r.toolCallId));
    const missingResults = [...missingToolResults, ...missingBlockResults];
    if (missingResults.length > 0) {
      updated.toolResults = [...(m.toolResults || []), ...missingResults];
      changed = true;
    }

    return changed ? updated : m;
  });
}

function createToolResultMessage(tc: ToolCall, content: string, isError?: boolean): Message {
  return {
    id: `tool_${tc.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    role: 'tool',
    content,
    toolCallId: tc.id,
    timestamp: Date.now(),
    toolName: tc.name,
    isError,
  };
}

function getShellCommandFromToolCall(tc: ToolCall): string {
  if (tc.name !== 'shell_execute') return '';
  try {
    const input = JSON.parse(tc.arguments);
    return String(input.command || '');
  } catch {
    return tc.arguments;
  }
}

function isDangerousShellToolCall(tc: ToolCall): boolean {
  return tc.name === 'shell_execute' && isDangerousShellCommand(getShellCommandFromToolCall(tc));
}

export function useChatState(toneMode: ToneMode, reasoningEffort: ReasoningEffort, preserveReasoning: boolean) {
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
  const localMessagesRef = useRef<Message[]>([]);
  const messagesRef = useRef<Message[]>([]);
  const shellAutoApproveRef = useRef(false);

  useEffect(() => {
    getHomePath().then(setHomePath);
  }, []);

  const loadInitialData = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const reloadModel = useCallback(async () => {
    const [models, selectedId] = await Promise.all([
      modelStorage.getModels(),
      modelStorage.getSelectedModelId(),
    ]);
    if (selectedId) {
      const found = models.find(m => m.id === selectedId);
      if (found) setModel(found);
    } else if (models.length > 0 && !model) {
      setModel(models[0]);
    }
  }, [model]);

  useEffect(() => {
    messagesRef.current = messages;
    if (conversationId && messages.length > 0) {
      conversationStore.updateConversation(conversationId, { messages });
    }
  }, [conversationId, messages]);

  const scrollToBottom = useCallback((animated = true) => {
    if (atBottomRef.current) {
      flatListRef.current?.scrollToEnd({ animated });
    }
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    atBottomRef.current = false;
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 80;
    atBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  }, []);

  const summarizeTitle = useCallback(async (titleModel: Model, firstUserMsg: string, firstAiMsg: string) => {
    try {
      const result = await aiService.sendMessage(titleModel, [
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
      reasoningDetails: m.reasoningDetails,
    }));
  }, []);

  const executeToolCall = useCallback(async (
    tc: ToolCall,
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
      onConfirm: async (confirmTc: ToolCall): Promise<boolean> => {
        if (
          confirmTc.name === 'shell_execute' &&
          shellAutoApproveRef.current &&
          !isDangerousShellToolCall(confirmTc)
        ) {
          return true;
        }
        return new Promise((resolve) => {
          setPendingToolCall({
            toolCalls: [confirmTc],
            localMessages: [...localMessagesRef.current],
            text: '',
            type: confirmTc.name === 'shell_execute' ? 'shell' : 'delete',
            confirmResolve: (confirmed: boolean) => {
              setPendingToolCall(null);
              resolve(confirmed);
            },
          });
        });
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

  const shouldConfirmToolCall = useCallback((tc: ToolCall): boolean => {
    if (
      tc.name === 'shell_execute' &&
      shellAutoApproveRef.current &&
      !isDangerousShellToolCall(tc)
    ) {
      return false;
    }
    return needsConfirmation(tc);
  }, []);

  const executeToolCalls = useCallback(async (
    toolCalls: ToolCall[],
    localMessages: Message[],
    abortSignal: AbortSignal,
  ): Promise<boolean> => {
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
        concurrentTasks.map(tc => executeToolCall(tc))
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
      if (abortSignal.aborted) return false;

      const { toolMsg, toolResult } = await executeToolCall(tc);
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

    return true;
  }, [executeToolCall]);

  const persistTerminatedMessages = useCallback(() => {
    const terminated = markMessagesTerminated(messagesRef.current);
    messagesRef.current = terminated;
    setMessages(terminated);
    if (conversationId && terminated.length > 0) {
      conversationStore.updateConversation(conversationId, { messages: terminated });
    }
  }, [conversationId]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    agentToolManager.abort();
    shellAutoApproveRef.current = false;
    streamingRef.current = false;
    setStreaming(false);
    setPendingToolCall(prev => {
      if (prev?.confirmResolve) {
        prev.confirmResolve(false);
      }
      return null;
    });
    persistTerminatedMessages();
  }, [persistTerminatedMessages]);

  const handleSend = useCallback(async (text: string) => {
    if (!model || streamingRef.current) return;
    shellAutoApproveRef.current = false;

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
    localMessagesRef.current = localMessages;

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
            if (abortSignal.aborted) return;
            setMessages(prev => prev.map(m =>
              m.id === aiId ? { ...m, blocks, content: blocks.filter(b => b.type === 'text').map(b => b.content).join('') } : m,
            ));
            scrollToBottom(false);
          },
          onToolCallDetected: (toolCall) => {
            if (abortSignal.aborted) return;
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
        }, reasoningEffort, undefined, abortSignal, preserveReasoning);

        if (abortSignal.aborted) {
          persistTerminatedMessages();
          break;
        }

        const assistantMsg: Message = {
          id: aiId,
          role: 'assistant',
          content: result.text,
          blocks: result.blocks,
          toolCalls: result.toolCalls,
          timestamp: Date.now(),
          streaming: false,
          reasoningContent: result.reasoningContent,
          reasoningDetails: result.reasoningDetails,
        };

        setMessages(prev => prev.map(m => m.id === aiId ? assistantMsg : m));
        localMessages.push(assistantMsg);
        localMessagesRef.current = localMessages;

        if (abortSignal.aborted) break;

        if (!result.toolCalls || result.toolCalls.length === 0) {
          if (messages.length === 0) {
            summarizeTitle(model, text, result.text);
          }
          break;
        }

        const confirmToolCalls: ToolCall[] = [];
        const normalToolCalls: ToolCall[] = [];

        for (const tc of result.toolCalls) {
          if (shouldConfirmToolCall(tc)) {
            confirmToolCalls.push(tc);
          } else {
            normalToolCalls.push(tc);
          }
        }

        const continued = await executeToolCalls(normalToolCalls, localMessages, abortSignal);
        if (!continued || abortSignal.aborted) break;

        if (confirmToolCalls.length > 0) {
          const cancelToolCall = (tc: ToolCall) => {
            const cancelMsg = createToolResultMessage(tc, '用户取消了此操作', true);
            localMessages.push(cancelMsg);
            setMessages(prev => {
              const updated = [...prev, cancelMsg];
              return updated.map(m => {
                if (m.role === 'assistant' && m.toolCalls?.some(t => t.id === tc.id)) {
                  return {
                    ...m,
                    toolResults: [...(m.toolResults || []), {
                      toolCallId: tc.id,
                      content: cancelMsg.content,
                      isError: true,
                    }],
                  };
                }
                return m;
              });
            });
          };

          for (const tc of confirmToolCalls) {
            if (abortSignal.aborted) break;

            if (!shouldConfirmToolCall(tc)) {
              const autoContinued = await executeToolCalls([tc], localMessages, abortSignal);
              if (!autoContinued || abortSignal.aborted) break;
              continue;
            }

            const confirmed = await new Promise<boolean>((resolve) => {
              setPendingToolCall({
                toolCalls: [tc],
                localMessages: [...localMessages],
                text,
                type: tc.name === 'shell_execute' ? 'shell' : 'delete',
                confirmResolve: (c: boolean) => {
                  setPendingToolCall(null);
                  resolve(c);
                },
              });
            });

            if (!confirmed || abortSignal.aborted) {
              cancelToolCall(tc);
              if (abortSignal.aborted) break;
              continue;
            }

            const confirmedContinued = await executeToolCalls([tc], localMessages, abortSignal);
            if (!confirmedContinued || abortSignal.aborted) break;
          }
          if (abortSignal.aborted) break;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LineCode] Aborted by user');
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
      if (abortSignal.aborted) {
        persistTerminatedMessages();
      }
      shellAutoApproveRef.current = false;
      streamingRef.current = false;
      setStreaming(false);
      abortControllerRef.current = null;
    }
  }, [model, messages, conversationId, scrollToBottom, summarizeTitle, toneMode, toChatMessages, homePath, reasoningEffort, preserveReasoning, executeToolCalls, persistTerminatedMessages, shouldConfirmToolCall]);

  const clearMessages = useCallback(() => setMessages([]), []);

  const handleToolConfirm = useCallback((confirmed: boolean, defaultExecute = false) => {
    if (!pendingToolCall) return;

    const { confirmResolve } = pendingToolCall;
    if (defaultExecute && confirmed) {
      shellAutoApproveRef.current = true;
    }

    if (confirmResolve) {
      confirmResolve(confirmed);
    } else {
      setPendingToolCall(null);
    }
  }, [pendingToolCall]);

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
    handleScrollBeginDrag,
    handleScroll,
    clearMessages,
    pendingToolCall,
    homePath,
    handleToolConfirm,
    reloadModel,
  };
}

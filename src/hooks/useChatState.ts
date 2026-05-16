import { useState, useRef, useCallback, useEffect } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent, FlatList } from 'react-native';
import { Message, Model, ToolCall, ContentBlock, AgentToolCall, ToolResult, InputAttachment, AgentProgressItem } from '../types';
import { modelStorage } from '../services/storage';
import { aiService, ChatMessage } from '../services/ai';
import { ToneMode, ReasoningEffort } from '../services/settings';
import { executeTool, needsConfirmation, getHomePath } from '../mcp/ToolExecutor';
import { agentToolManager } from '../mcp/AgentToolManager';
import { conversationStore } from '../services/conversation';
import { projectService } from '../services/ProjectService';
import { isDangerousShellCommand } from '../utils/shellSafety';
import { parseModelContext, formatContextSize } from '../utils/modelContext';
import {
  COMPACT_PROMPT,
  COMPACT_TRIGGER_RATIO,
  createCompactSummaryContent,
  toCompactTranscript,
} from '../services/contextCompaction';
import { getUserMessageRecallText } from '../utils/messageText';
import { MessageListStore, MessageUpdater } from '../chat/MessageListStore';
import { ContextMetricsService } from '../chat/ContextMetricsService';
import { ConversationPersistenceScheduler } from '../chat/persistence/ConversationPersistenceScheduler';
import { StreamBufferedUpdate, StreamUpdateBuffer } from '../chat/StreamUpdateBuffer';
import { ToolExecutionCoordinator } from '../chat/ToolExecutionCoordinator';

interface PendingToolCall {
  toolCalls: ToolCall[];
  localMessages: Message[];
  text: string;
  type?: 'delete' | 'shell';
  confirmResolve?: (confirmed: boolean) => void;
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

function markAgentItemsTerminated(items?: AgentProgressItem[]): AgentProgressItem[] | undefined {
  if (!items) return items;
  return items.map(item => {
    if (item.status !== 'running' && item.status !== 'waiting_unlock') return item;
    return {
      ...item,
      status: 'error' as const,
      output: item.output || TERMINATED_RESULT,
      toolCalls: markAgentToolCallsTerminated(item.toolCalls),
      waitingForUnlock: undefined,
      endTime: item.endTime || Date.now(),
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
    if (block.type === 'compact' && block.compactStatus === 'running') {
      changed = true;
      return {
        ...block,
        compactStatus: 'error' as const,
      };
    }

    if (block.type !== 'tool_use') return block;

    const hasRunningAgentItems = block.agentItems?.some(item =>
      item.status === 'running' || item.status === 'waiting_unlock'
    );

    if (block.agentStatus === 'running' || block.agentStatus === 'waiting_unlock' || hasRunningAgentItems) {
      changed = true;
      return {
        ...block,
        agentStatus: 'error' as const,
        agentOutput: block.agentOutput || TERMINATED_RESULT,
        agentToolCalls: markAgentToolCallsTerminated(block.agentToolCalls),
        agentItems: markAgentItemsTerminated(block.agentItems),
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

function composeUserContent(text: string, attachments: InputAttachment[]): string {
  const trimmed = text.trim();
  if (trimmed) return trimmed;
  return attachments.length > 0 ? '已附加文件' : '';
}

function getErrorText(err: any): string {
  if (!err) return '未知错误';
  if (typeof err?.message === 'string' && err.message.trim()) return err.message.trim();
  const text = String(err);
  return text.trim() || '未知错误';
}

function buildRequestFailedText(err: any): string {
  return `请求失败:\n\n${getErrorText(err)}`;
}

function markMessageRequestFailed(message: Message, errorText: string): Message {
  const existingContent = message.content?.trim() || '';
  const nextContent = existingContent
    ? `${existingContent}\n\n${errorText}`
    : errorText;

  if (message.blocks?.length) {
    const errorBlock: ContentBlock = {
      type: 'text',
      content: `${message.blocks.some(block => block.content?.trim()) ? '\n\n' : ''}${errorText}`,
    };
    return {
      ...message,
      content: nextContent,
      blocks: [...message.blocks, errorBlock],
      streaming: false,
      isError: true,
    };
  }

  return {
    ...message,
    content: nextContent,
    streaming: false,
    isError: true,
  };
}

export function useChatState(toneMode: ToneMode, reasoningEffort: ReasoningEffort, preserveReasoning: boolean) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null);
  const [homePath, setHomePath] = useState<string>('');
  const [streaming, setStreaming] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const streamingRef = useRef(false);
  const atBottomRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const localMessagesRef = useRef<Message[]>([]);
  const conversationIdRef = useRef<string | null>(null);
  const shellAutoApproveRef = useRef(false);
  const compactingRef = useRef(false);
  const messageStoreRef = useRef(new MessageListStore());
  const persistenceRef = useRef(new ConversationPersistenceScheduler());
  const contextMetricsRef = useRef(new ContextMetricsService());
  const streamBufferRef = useRef<StreamUpdateBuffer | null>(null);
  const toolExecutionCoordinatorRef = useRef(new ToolExecutionCoordinator());

  useEffect(() => {
    getHomePath().then(setHomePath);
    return projectService.subscribe((project) => {
      setHomePath(project.path);
    });
  }, []);

  const updateConversationId = useCallback((id: string | null) => {
    persistenceRef.current.flush(conversationIdRef.current).catch(() => {});
    conversationIdRef.current = id;
    persistenceRef.current.setConversationId(id);
    setConversationId(id);
    conversationStore.setCurrentConversationId(id).catch(() => {});
  }, []);

  const loadInitialData = useCallback(async () => {
    const [models, selectedId, convId] = await Promise.all([
      modelStorage.getModels(),
      modelStorage.getSelectedModelId(),
      conversationStore.getCurrentConversationId(),
    ]);

    const selectedModel = selectedId ? models.find(m => m.id === selectedId) : null;
    setModel(selectedModel || models[0] || null);

    if (convId) {
      const conv = await conversationStore.getConversation(convId);
      if (conv) {
        updateConversationId(conv.id);
        messageStoreRef.current.setMessages(conv.messages);
        persistenceRef.current.markPersisted(conv.messages);
        setMessages(conv.messages);
      }
    }

    setLoading(false);
  }, [updateConversationId]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const reloadModel = useCallback(async () => {
    const [models, selectedId] = await Promise.all([
      modelStorage.getModels(),
      modelStorage.getSelectedModelId(),
    ]);
    const selectedModel = selectedId ? models.find(m => m.id === selectedId) : null;
    setModel(selectedModel || models[0] || null);
  }, []);

  useEffect(() => {
    return modelStorage.subscribeSelectedModel(() => {
      reloadModel();
    });
  }, [reloadModel]);

  const syncMessages = useCallback((
    updater: MessageUpdater,
    convId: string | null = conversationIdRef.current,
    persist: 'schedule' | 'flush' | 'none' = 'schedule',
  ): Message[] => {
    const next = messageStoreRef.current.update(updater);
    setMessages(next);
    if (persist === 'flush') {
      persistenceRef.current.schedule(next, convId);
      persistenceRef.current.flush(convId).catch(() => {});
    } else if (persist === 'schedule') {
      persistenceRef.current.schedule(next, convId);
    }
    return next;
  }, []);

  useEffect(() => {
    messageStoreRef.current.setMessages(messages);
  }, [messages]);

  useEffect(() => {
    const persistence = persistenceRef.current;
    return () => {
      persistence.flush().catch(() => {});
    };
  }, []);

  const scrollToBottom = useCallback((animated = true) => {
    if (atBottomRef.current) {
      flatListRef.current?.scrollToEnd({ animated });
    }
  }, []);

  const applyStreamUpdates = useCallback((aiId: string, updates: StreamBufferedUpdate[], convId: string | null) => {
    if (updates.length === 0) return;
    syncMessages(prev => prev.map(message => {
      if (message.id !== aiId) return message;

      let nextMessage = message;
      for (const update of updates) {
        if (update.type === 'status') {
          if (!nextMessage.blocks?.length) {
            nextMessage = { ...nextMessage, content: update.status };
          }
          continue;
        }

        if (update.type === 'blocks') {
          nextMessage = {
            ...nextMessage,
            blocks: update.blocks,
            content: update.blocks.filter(block => block.type === 'text').map(block => block.content).join(''),
          };
          continue;
        }

        const existingBlocks = nextMessage.blocks || [];
        if (existingBlocks.some(block => block.type === 'tool_use' && block.id === update.toolCall.id)) {
          continue;
        }
        const newBlock: ContentBlock = {
          type: 'tool_use',
          id: update.toolCall.id,
          name: update.toolCall.name,
          content: '',
        };
        nextMessage = { ...nextMessage, blocks: [...existingBlocks, newBlock] };
      }
      return nextMessage;
    }), convId, 'none');
    scrollToBottom(false);
  }, [scrollToBottom, syncMessages]);

  const handleScrollBeginDrag = useCallback(() => {
    atBottomRef.current = false;
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 80;
    atBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  }, []);

  const summarizeTitle = useCallback(async (titleModel: Model, targetConversationId: string, firstUserMsg: string, firstAiMsg: string) => {
    try {
      const result = await aiService.sendMessage(titleModel, [
        { role: 'system', content: '用不超过10个字总结这段对话的主题，只输出标题，不要任何标点符号。' },
        { role: 'user', content: `用户: ${firstUserMsg}\n助手: ${firstAiMsg}` },
      ]);
      const title = result.text.trim().slice(0, 20);
      if (title) {
        conversationStore.updateConversation(targetConversationId, { title });
      }
    } catch {}
  }, []);

  const toChatMessages = useCallback((msgs: Message[]): ChatMessage[] => {
    return msgs.filter(m => !m.excludeFromContext).map(m => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments,
      toolCalls: m.toolCalls,
      toolCallId: m.toolCallId,
      toolName: m.toolName,
      isError: m.isError,
      reasoningContent: m.reasoningContent,
      reasoningDetails: m.reasoningDetails,
    }));
  }, []);

  const executeToolCall = useCallback(async (
    tc: ToolCall,
  ): Promise<{ toolMsg: Message; toolResult: ToolResult }> => {
    const toolResult = await executeTool(tc, {
      onProgress: (update: Partial<ContentBlock>) => {
        if (tc.name === 'agent' || tc.name === 'agent_pipeline') {
          syncMessages(prev => prev.map(m => {
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
      isError: toolResult.isError,
    };

    syncMessages(prev => [...prev, toolMsg]);
    return { toolMsg, toolResult };
  }, [syncMessages]);

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
    const { concurrentTasks, sequentialTasks } = toolExecutionCoordinatorRef.current.createPlan(toolCalls);

    if (concurrentTasks.length > 0) {
      const results = await Promise.all(
        concurrentTasks.map(tc => executeToolCall(tc))
      );

      for (const { toolMsg, toolResult } of results) {
        localMessages.push(toolMsg);
        syncMessages(prev => (
          prev.map(m => {
            if (m.role === 'assistant' && m.toolCalls?.some(t => t.id === toolMsg.toolCallId)) {
              const existingResults = m.toolResults || [];
              return {
                ...m,
                toolResults: [...existingResults, {
                  toolCallId: toolMsg.toolCallId!,
                  content: toolResult.content,
                  isError: toolResult.isError,
                  diffId: toolResult.diffId,
                }],
              };
            }
            return m;
          })
        ));
      }
    }

    for (const tc of sequentialTasks) {
      if (abortSignal.aborted) return false;

      const { toolMsg, toolResult } = await executeToolCall(tc);
      localMessages.push(toolMsg);
      syncMessages(prev => (
        prev.map(m => {
          if (m.role === 'assistant' && m.toolCalls?.some(t => t.id === tc.id)) {
            const existingResults = m.toolResults || [];
            return {
              ...m,
              toolResults: [...existingResults, {
                toolCallId: tc.id,
                content: toolResult.content,
                isError: toolResult.isError,
                diffId: toolResult.diffId,
              }],
            };
          }
          return m;
        })
      ));
    }

    return true;
  }, [executeToolCall, syncMessages]);

  const persistTerminatedMessages = useCallback(() => {
    const terminated = markMessagesTerminated(messageStoreRef.current.getSnapshot());
    syncMessages(terminated, conversationIdRef.current, 'flush');
  }, [syncMessages]);

  const runContextCompaction = useCallback(async (baseMessages: Message[], preservedTail: Message[] = []): Promise<Message[]> => {
    if (!model) return baseMessages;

    const contextMessages = baseMessages.filter(m => !m.excludeFromContext);
    const summarizableMessages = contextMessages.filter(m => m.content.trim() || m.toolCalls?.length || m.toolResults?.length);
    if (summarizableMessages.length < 4) {
      throw new Error('当前上下文不足，无需压缩');
    }

    const progressId = `compact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const progressMsg: Message = {
      id: progressId,
      role: 'assistant',
      content: '',
      blocks: [{ type: 'compact', content: '压缩', compactStatus: 'running' }],
      timestamp: Date.now(),
      streaming: true,
      excludeFromContext: true,
    };

    const withProgress = [...baseMessages, ...preservedTail, progressMsg];
    syncMessages(withProgress);
    scrollToBottom(false);

    const compactController = new AbortController();
    abortControllerRef.current = compactController;

    try {
      const transcript = toCompactTranscript(toChatMessages(contextMessages));
      const result = await aiService.sendMessage(model, [
        {
          role: 'user',
          content: `${COMPACT_PROMPT}\n\nConversation transcript:\n${transcript}`,
        },
      ], undefined, 'off', [], compactController.signal, false);

      const summaryMsg: Message = {
        id: `compact_summary_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        role: 'user',
        content: createCompactSummaryContent(result.text),
        timestamp: Date.now(),
        hidden: true,
      };

      const doneProgressMsg: Message = {
        ...progressMsg,
        streaming: false,
        blocks: [{ type: 'compact', content: '压缩', compactStatus: 'done' }],
      };

      const compacted = [
        ...baseMessages.map(m => ({ ...m, excludeFromContext: true })),
        summaryMsg,
        ...preservedTail,
        doneProgressMsg,
      ];
      syncMessages(compacted);
      scrollToBottom(false);
      return compacted;
    } catch (err) {
      syncMessages(prev => prev.map(m => m.id === progressId
        ? {
            ...m,
            streaming: false,
            blocks: [{ type: 'compact', content: '压缩', compactStatus: 'error' }],
          }
        : m
      ));
      throw err;
    } finally {
      if (abortControllerRef.current === compactController) {
        abortControllerRef.current = null;
      }
    }
  }, [model, scrollToBottom, syncMessages, toChatMessages]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    agentToolManager.abort();
    compactingRef.current = false;
    streamingRef.current = false;
    setCompacting(false);
    setStreaming(false);
    setPendingToolCall(prev => {
      if (prev?.confirmResolve) {
        prev.confirmResolve(false);
      }
      return null;
    });
    persistTerminatedMessages();
  }, [persistTerminatedMessages]);

  const recallUserMessage = useCallback((messageId: string): string => {
    const current = messageStoreRef.current.getSnapshot();
    const index = current.findIndex(m => m.id === messageId && m.role === 'user');
    if (index < 0) return '';

    if (streamingRef.current || compactingRef.current || abortControllerRef.current) {
      abortControllerRef.current?.abort();
      agentToolManager.abort();
      compactingRef.current = false;
      streamingRef.current = false;
      setCompacting(false);
      setStreaming(false);
      setPendingToolCall(prev => {
        if (prev?.confirmResolve) {
          prev.confirmResolve(false);
        }
        return null;
      });
      abortControllerRef.current = null;
    }

    const target = current[index];
    const recalledText = getUserMessageRecallText(target.content);
    const next = current.slice(0, index);
    localMessagesRef.current = next.filter(m => !m.excludeFromContext);
    syncMessages(next, conversationIdRef.current, 'flush');
    return recalledText;
  }, [syncMessages]);

  const handleSend = useCallback(async (text: string, attachments: InputAttachment[] = []) => {
    if (!model || streamingRef.current || compactingRef.current) return;
    const sentContent = composeUserContent(text, attachments);
    if (!sentContent.trim()) return;
    const currentMessages = messageStoreRef.current.getSnapshot();
    const wasNewConversation = currentMessages.length === 0;

    let convId = conversationId;
    if (!convId) {
      const conv = await conversationStore.createConversation();
      convId = conv.id;
      updateConversationId(conv.id);
    }

    const now = Date.now();
    const userMsg: Message = {
      id: String(now),
      role: 'user',
      content: sentContent,
      timestamp: now,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    atBottomRef.current = true;

    const initialMessages = [...currentMessages, userMsg];
    syncMessages(initialMessages, convId);
    if (wasNewConversation) {
      const fallbackTitle = sentContent.trim().replace(/\s+/g, ' ').slice(0, 20) || '新对话';
      conversationStore.updateConversation(convId, { title: fallbackTitle, messages: initialMessages })
        .then(() => persistenceRef.current.markPersisted(initialMessages))
        .catch(() => {});
    }
    streamingRef.current = true;
    setStreaming(true);

    const localMessages: Message[] = [...initialMessages];
    localMessagesRef.current = localMessages;
    let abortSignal: AbortSignal | null = null;

    try {
      const contextInfo = parseModelContext(model.modelId);
      const latestMessages = messageStoreRef.current.getSnapshot();
      const existingContextMessages = latestMessages.filter(m => !m.excludeFromContext);
      const canCompactExistingContext = existingContextMessages.length >= 4;
      if (canCompactExistingContext && contextMetricsRef.current.shouldCompact(localMessages, contextInfo.contextTokens, COMPACT_TRIGGER_RATIO)) {
        compactingRef.current = true;
        setCompacting(true);
        const compactedMessages = await runContextCompaction(latestMessages.filter(m => m.id !== userMsg.id), [userMsg]);
        localMessages.splice(0, localMessages.length, ...compactedMessages.filter(m => !m.excludeFromContext));
        localMessagesRef.current = localMessages;
        compactingRef.current = false;
        setCompacting(false);
      }

      abortControllerRef.current = new AbortController();
      const activeAbortSignal = abortControllerRef.current.signal;
      abortSignal = activeAbortSignal;

      while (true) {
        if (activeAbortSignal.aborted) {
          console.log('[LineCode] Aborted by user');
          break;
        }

        const aiId = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const aiPlaceholder: Message = {
          id: aiId, role: 'assistant', content: '', blocks: [], timestamp: Date.now(), streaming: true,
        };

        syncMessages(prev => [...prev, aiPlaceholder], convId);

        const chatMessages = await aiService.buildMessages('', toChatMessages(localMessages), toneMode, homePath);

        streamBufferRef.current?.cancel();
        const streamBuffer = new StreamUpdateBuffer(80, updates => {
          if (activeAbortSignal.aborted) return;
          applyStreamUpdates(aiId, updates, convId);
        });
        streamBufferRef.current = streamBuffer;

        const result = await aiService.sendMessage(model, chatMessages, {
          onStatus: (status) => {
            if (activeAbortSignal.aborted) return;
            streamBuffer.pushStatus(status);
          },
          onBlocks: (blocks) => {
            if (activeAbortSignal.aborted) return;
            streamBuffer.pushBlocks(blocks);
          },
          onToolCallDetected: (toolCall) => {
            if (activeAbortSignal.aborted) return;
            streamBuffer.pushToolCall(toolCall);
          },
        }, reasoningEffort, undefined, activeAbortSignal, preserveReasoning);
        streamBuffer.flush();
        if (streamBufferRef.current === streamBuffer) {
          streamBufferRef.current = null;
        }

        if (activeAbortSignal.aborted) {
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

        syncMessages(prev => prev.map(m => m.id === aiId ? assistantMsg : m), convId, 'flush');
        localMessages.push(assistantMsg);
        localMessagesRef.current = localMessages;

        if (activeAbortSignal.aborted) break;

        if (!result.toolCalls || result.toolCalls.length === 0) {
          if (wasNewConversation) {
            summarizeTitle(model, convId, sentContent, result.text);
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

        const continued = await executeToolCalls(normalToolCalls, localMessages, activeAbortSignal);
        if (!continued || activeAbortSignal.aborted) break;

        if (confirmToolCalls.length > 0) {
          const cancelToolCall = (tc: ToolCall) => {
            const cancelMsg = createToolResultMessage(tc, '用户取消了此操作', true);
            localMessages.push(cancelMsg);
            syncMessages(prev => {
              const updated = prev.some(m => m.id === cancelMsg.id) ? prev : [...prev, cancelMsg];
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
            }, convId);
          };

          for (const tc of confirmToolCalls) {
            if (activeAbortSignal.aborted) break;

            if (!shouldConfirmToolCall(tc)) {
              const autoContinued = await executeToolCalls([tc], localMessages, activeAbortSignal);
              if (!autoContinued || activeAbortSignal.aborted) break;
              continue;
            }

            const confirmed = await new Promise<boolean>((resolve) => {
              setPendingToolCall({
                toolCalls: [tc],
                localMessages: [...localMessages],
                text: sentContent,
                type: tc.name === 'shell_execute' ? 'shell' : 'delete',
                confirmResolve: (c: boolean) => {
                  setPendingToolCall(null);
                  resolve(c);
                },
              });
            });

            if (!confirmed || activeAbortSignal.aborted) {
              cancelToolCall(tc);
              if (activeAbortSignal.aborted) break;
              continue;
            }

            const confirmedContinued = await executeToolCalls([tc], localMessages, activeAbortSignal);
            if (!confirmedContinued || activeAbortSignal.aborted) break;
          }
          if (activeAbortSignal.aborted) break;
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[LineCode] Aborted by user');
      } else {
        console.error('[LineCode] sendMessage error:', err);
        const errorText = buildRequestFailedText(err);
        syncMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.streaming) {
            return prev.map(m => m.id === last.id
              ? markMessageRequestFailed(m, errorText)
              : m
            );
          }
          return [...prev, {
            id: `err_${Date.now()}`,
            role: 'assistant' as const,
            content: errorText,
            timestamp: Date.now(),
            isError: true,
          }];
        }, convId, 'flush');
        scrollToBottom(false);
      }
    } finally {
      streamBufferRef.current?.cancel();
      streamBufferRef.current = null;
      if (abortSignal?.aborted) {
        persistTerminatedMessages();
      }
      compactingRef.current = false;
      setCompacting(false);
      streamingRef.current = false;
      setStreaming(false);
      abortControllerRef.current = null;
      persistenceRef.current.flush(convId).catch(() => {});
    }
  }, [model, conversationId, applyStreamUpdates, summarizeTitle, toneMode, toChatMessages, homePath, reasoningEffort, preserveReasoning, executeToolCalls, persistTerminatedMessages, shouldConfirmToolCall, runContextCompaction, scrollToBottom, syncMessages, updateConversationId]);

  const resetShellAutoApprove = useCallback(() => {
    shellAutoApproveRef.current = false;
  }, []);

  const clearMessages = useCallback(() => {
    shellAutoApproveRef.current = false;
    syncMessages([], conversationIdRef.current, 'flush');
  }, [syncMessages]);

  const handleCompactContext = useCallback(async () => {
    if (streamingRef.current || compactingRef.current) return;
    const currentMessages = messageStoreRef.current.getSnapshot();
    if (currentMessages.filter(m => !m.excludeFromContext).length < 4) return;

    compactingRef.current = true;
    setCompacting(true);
    try {
      await runContextCompaction(currentMessages);
    } catch (err) {
      console.error('[LineCode] compact context error:', err);
    } finally {
      compactingRef.current = false;
      setCompacting(false);
    }
  }, [runContextCompaction]);

  const contextInfo = model ? parseModelContext(model.modelId) : null;
  const contextTokens = contextInfo?.contextTokens || 250_000;
  const contextUsedTokens = contextMetricsRef.current.estimateContextTokens(messages);
  const contextPercent = Math.min(100, Math.round((contextUsedTokens / contextTokens) * 100));
  const contextSizeLabel = formatContextSize(contextTokens);

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

  const handleToolReview = useCallback((toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => {
    syncMessages(prev => {
      const next = prev.map(m => {
        if (m.role !== 'assistant' || !m.toolResults?.some(r => r.toolCallId === toolCallId)) {
          return m;
        }
        return {
          ...m,
          toolResults: m.toolResults.map(r => r.toolCallId === toolCallId
            ? { ...r, reviewState: state, diffId: diffId || r.diffId }
            : r
          ),
        };
      });
      return next;
    });
  }, [syncMessages]);

  return {
    messages,
    setMessages: syncMessages,
    model,
    loading,
    compacting,
    contextSizeLabel,
    contextPercent,
    conversationId,
    setConversationId: updateConversationId,
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
    handleToolReview,
    resetShellAutoApprove,
    handleCompactContext,
    reloadModel,
    recallUserMessage,
  };
}

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Message, Model, ToolCall, ContentBlock, ToolResult, InputAttachment } from '../types';
import { modelStorage } from '../services/storage';
import { aiService, ChatMessage, SYSTEM_PROMPT } from '../services/ai';
import { ToneMode, ReasoningEffort, settingsService } from '../services/settings';
import { executeTool, needsConfirmation, getHomePath } from '../mcp/ToolExecutor';
import { agentToolManager } from '../mcp/AgentToolManager';
import { conversationStore } from '../services/conversation';
import { projectService } from '../services/ProjectService';
import { parseModelContext, formatContextSize } from '../utils/modelContext';
import {
  COMPACT_PROMPT,
  COMPACT_TRIGGER_RATIO,
  createCompactSummaryContent,
  toCompactTranscript,
} from '../services/contextCompaction';
import { getUserMessageRecallText } from '../utils/messageText';
import { MessageListStore, MessageUpdater } from './MessageListStore';
import { ContextMetricsService } from './ContextMetricsService';
import { ConversationPersistenceScheduler } from './persistence/ConversationPersistenceScheduler';
import { StreamBufferedUpdate, StreamUpdateBuffer } from './StreamUpdateBuffer';
import { ToolExecutionCoordinator } from './ToolExecutionCoordinator';
import { sanitizeToolCallForStorage } from '../utils/toolPayload';
import { chatHookManager } from '../plugins';
import { isAgentTool } from '../mcp/toolUtils';
import { useChatScrollState } from './useChatScrollState';
import { ConversationIndexer, evolutionDatabase, evolutionService } from '../services/evolution';
import { isLearningModeEnabled } from '../services/LearningModeService';
import {
  buildRequestFailedText,
  composeUserContent,
  createToolResultMessage,
  isDangerousShellToolCall,
  markMessageRequestFailed,
  markMessagesTerminated,
} from './messageLifecycle';

interface PendingToolCall {
  toolCalls: ToolCall[];
  localMessages: Message[];
  text: string;
  type?: 'delete' | 'shell';
  confirmResolve?: (confirmed: boolean) => void;
}

const CONTEXT_METRICS_DEBOUNCE_MS = 300;
const CONTEXT_LIMIT_RETRY_COUNT = 1;
const conversationIndexer = new ConversationIndexer(evolutionDatabase);

const CONTEXT_LIMIT_ERROR_PATTERNS = [
  /context[_\s-]*length/i,
  /context window/i,
  /maximum context/i,
  /max(?:imum)? tokens/i,
  /token limit/i,
  /too many tokens/i,
  /prompt is too long/i,
  /input is too long/i,
  /reduce (?:the )?(?:length|input)/i,
  /exceed(?:s|ed|ing)?.*(?:context|token)/i,
  /上下文.*(?:超|满|长度|限制)/i,
];

export function isContextLimitError(err: unknown): boolean {
  const parts = [
    err instanceof Error ? err.message : '',
    typeof err === 'object' && err ? String((err as any).code || '') : '',
    typeof err === 'object' && err ? String((err as any).status || '') : '',
    String(err || ''),
  ].filter(Boolean);
  const text = parts.join('\n');
  return CONTEXT_LIMIT_ERROR_PATTERNS.some(pattern => pattern.test(text));
}

function getAutoCompactPreservedTail(messages: Message[], activeUserMessageId?: string): Message[] {
  const contextMessages = messages.filter(message => !message.excludeFromContext);
  const last = contextMessages[contextMessages.length - 1];
  if (!last) return [];

  if (activeUserMessageId && last.id === activeUserMessageId && last.role === 'user') {
    return [last];
  }

  if (last.role === 'user') {
    return [last];
  }

  if (last.role === 'tool') {
    for (let index = contextMessages.length - 1; index >= 0; index -= 1) {
      const message = contextMessages[index];
      if (message.role === 'assistant' && message.toolCalls?.length) {
        return contextMessages.slice(index);
      }
    }
  }

  return [];
}

export interface UseChatControllerOptions {
  toneMode: ToneMode;
  reasoningEffort: ReasoningEffort;
  preserveReasoning: boolean;
}

export function useChatController({
  toneMode,
  reasoningEffort,
  preserveReasoning,
}: UseChatControllerOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null);
  const [homePath, setHomePath] = useState<string>('');
  const [streaming, setStreaming] = useState(false);
  const [compacting, setCompacting] = useState(false);
  const [contextPercent, setContextPercent] = useState(0);
  const {
    flatListRef,
    isAtBottom,
    enableBottomFollow,
    scrollToBottom,
    jumpToBottom,
    handleScrollBeginDrag,
    handleScroll,
    handleScrollEnd,
    handleContentSizeChange,
    handleListLayout,
  } = useChatScrollState();
  const streamingRef = useRef(false);
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
  const activeToolMessagesRef = useRef<Message[]>([]);

  useEffect(() => {
    getHomePath().then(setHomePath);
    return projectService.subscribe((project) => {
      setHomePath(project.path);
    });
  }, []);

  const updateConversationId = useCallback((id: string | null) => {
    enableBottomFollow();
    persistenceRef.current.flush(conversationIdRef.current).catch(() => {});
    conversationIdRef.current = id;
    persistenceRef.current.setConversationId(id);
    setConversationId(id);
    conversationStore.setCurrentConversationId(id).catch(() => {});
  }, [enableBottomFollow]);

  const loadInitialData = useCallback(async () => {
    const [models, selectedId, restoreLastConversation] = await Promise.all([
      modelStorage.getModels(),
      modelStorage.getSelectedModelId(),
      settingsService.getRestoreLastConversationOnStartup(),
    ]);
    const selectedModel = selectedId ? models.find(m => m.id === selectedId) : null;
    setModel(selectedModel || models[0] || null);

    if (restoreLastConversation) {
      const convId = await conversationStore.getCurrentConversationId();
      if (convId) {
        const conv = await conversationStore.getConversation(convId);
        if (conv) {
          updateConversationId(conv.id);
          messageStoreRef.current.setMessages(conv.messages);
          persistenceRef.current.markPersisted(conv.messages);
          setMessages(conv.messages);
        }
      }
    } else {
      updateConversationId(null);
      messageStoreRef.current.setMessages([]);
      persistenceRef.current.markPersisted([]);
      setMessages([]);
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
    if (next.length === 0) {
      enableBottomFollow();
    }
    setMessages(next);
    if (persist === 'flush') {
      persistenceRef.current.schedule(next, convId);
      persistenceRef.current.flush(convId).catch(() => {});
    } else if (persist === 'schedule') {
      persistenceRef.current.schedule(next, convId);
    }
    return next;
  }, [enableBottomFollow]);

  useEffect(() => {
    messageStoreRef.current.setMessages(messages);
  }, [messages]);

  useEffect(() => {
    const persistence = persistenceRef.current;
    return () => {
      persistence.flush().catch(() => {});
    };
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
    const contextMessages = msgs.filter(m => !m.excludeFromContext);
    const standaloneToolResultIds = new Set(
      contextMessages
        .filter(m => m.role === 'tool' && m.toolCallId)
        .map(m => m.toolCallId!),
    );
    const chatMessages: ChatMessage[] = [];

    for (const m of contextMessages) {
      chatMessages.push({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
        toolCalls: m.toolCalls,
        toolCallId: m.toolCallId,
        toolName: m.toolName,
        isError: m.isError,
        reasoningContent: m.reasoningContent,
        reasoningDetails: m.reasoningDetails,
      });

      if (m.role !== 'assistant' || !m.toolCalls?.length || !m.toolResults?.length) {
        continue;
      }

      for (const result of m.toolResults) {
        if (standaloneToolResultIds.has(result.toolCallId)) continue;
        const toolCall = m.toolCalls.find(tc => tc.id === result.toolCallId);
        chatMessages.push({
          role: 'tool',
          content: result.content,
          toolCallId: result.toolCallId,
          toolName: toolCall?.name,
          isError: result.isError,
        });
      }
    }

    return chatMessages;
  }, []);

  const executeToolCall = useCallback(async (
    tc: ToolCall,
  ): Promise<{ toolMsg: Message; toolResult: ToolResult }> => {
    const toolResult = await executeTool(tc, {
      onProgress: (update: Partial<ContentBlock>) => {
        if (isAgentTool(tc.name) || tc.name === 'shell_execute') {
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

    activeToolMessagesRef.current = [
      ...activeToolMessagesRef.current.filter(message => message.toolCallId !== tc.id),
      toolMsg,
    ];
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
    const current = messageStoreRef.current.getSnapshot();
    const existingToolIds = new Set(current.filter(m => m.role === 'tool').map(m => m.id));
    const missingToolMessages = activeToolMessagesRef.current.filter(m => !existingToolIds.has(m.id));
    const terminated = markMessagesTerminated([
      ...current,
      ...missingToolMessages,
    ]);
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

  const runAutoContextCompaction = useCallback(async (
    sourceMessages: Message[],
    contextTokens: number,
    options: { activeUserMessageId?: string; force?: boolean } = {},
  ): Promise<Message[]> => {
    const contextMessages = sourceMessages.filter(m => !m.excludeFromContext);
    if (!options.force && !contextMetricsRef.current.shouldCompact(contextMessages, contextTokens, COMPACT_TRIGGER_RATIO)) {
      return sourceMessages;
    }

    const preservedTail = getAutoCompactPreservedTail(sourceMessages, options.activeUserMessageId);
    const preservedIds = new Set(preservedTail.map(message => message.id));
    const baseMessages = sourceMessages.filter(message => !preservedIds.has(message.id));
    if (baseMessages.filter(m => !m.excludeFromContext).length < 4) {
      return sourceMessages;
    }

    compactingRef.current = true;
    setCompacting(true);
    try {
      const compacted = await runContextCompaction(baseMessages, preservedTail);
      contextMetricsRef.current.clear();
      return compacted;
    } finally {
      compactingRef.current = false;
      setCompacting(false);
    }
  }, [runContextCompaction]);

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

  const performSend = useCallback(async (text: string, attachments: InputAttachment[] = []) => {
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

    enableBottomFollow();

    const initialMessages = [...currentMessages, userMsg];
    syncMessages(initialMessages, convId);
    activeToolMessagesRef.current = [];
    if (wasNewConversation) {
      const fallbackTitle = sentContent.trim().replace(/\s+/g, ' ').slice(0, 20) || '新对话';
      conversationStore.updateConversation(convId, { title: fallbackTitle, messages: initialMessages })
        .then(() => persistenceRef.current.markPersisted(initialMessages))
        .catch(() => {});
    }
    const localMessages: Message[] = [...initialMessages];
    localMessagesRef.current = localMessages;
    let abortSignal: AbortSignal | null = null;

    try {
      const contextInfo = parseModelContext(model.modelId);
      const preparedMessages = await runAutoContextCompaction(
        messageStoreRef.current.getSnapshot(),
        contextInfo.contextTokens,
        { activeUserMessageId: userMsg.id },
      );
      if (preparedMessages !== initialMessages) {
        localMessages.splice(0, localMessages.length, ...preparedMessages.filter(m => !m.excludeFromContext));
        localMessagesRef.current = localMessages;
      }

      streamingRef.current = true;
      setStreaming(true);
      const requestController = new AbortController();
      abortControllerRef.current = requestController;
      const activeAbortSignal = requestController.signal;
      abortSignal = activeAbortSignal;
      let contextLimitRetries = 0;

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

        const learningEnabled = await isLearningModeEnabled(model);
        const learningContext = learningEnabled
          ? await evolutionService.buildLearningContext({
            learningMode: true,
            userInput: sentContent,
            homePath,
            modelId: model.id,
          }).catch(() => '')
          : '';
        const chatMessages = await aiService.buildMessages(SYSTEM_PROMPT, toChatMessages(localMessages), toneMode, homePath, learningContext);

        streamBufferRef.current?.cancel();
        const streamBuffer = new StreamUpdateBuffer(80, updates => {
          if (activeAbortSignal.aborted) return;
          applyStreamUpdates(aiId, updates, convId);
        });
        streamBufferRef.current = streamBuffer;

        let result: Awaited<ReturnType<typeof aiService.sendMessage>>;
        try {
          result = await aiService.sendMessage(model, chatMessages, {
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
        } catch (err) {
          streamBuffer.cancel();
          if (streamBufferRef.current === streamBuffer) {
            streamBufferRef.current = null;
          }

          if (
            !activeAbortSignal.aborted &&
            contextLimitRetries < CONTEXT_LIMIT_RETRY_COUNT &&
            isContextLimitError(err)
          ) {
            contextLimitRetries += 1;
            syncMessages(prev => prev.filter(message => message.id !== aiId), convId, 'none');
            abortControllerRef.current = null;
            const beforeCompaction = messageStoreRef.current.getSnapshot();
            const compactedMessages = await runAutoContextCompaction(
              beforeCompaction,
              contextInfo.contextTokens,
              { force: true },
            );
            if (compactedMessages === beforeCompaction) {
              throw err;
            }
            localMessages.splice(0, localMessages.length, ...compactedMessages.filter(m => !m.excludeFromContext));
            localMessagesRef.current = localMessages;
            if (!activeAbortSignal.aborted) {
              abortControllerRef.current = requestController;
              continue;
            }
          }

          throw err;
        }
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
          toolCalls: result.toolCalls?.map(sanitizeToolCallForStorage),
          timestamp: Date.now(),
          streaming: false,
          reasoningContent: result.reasoningContent,
          reasoningDetails: result.reasoningDetails,
        };

        syncMessages(prev => prev.map(m => m.id === aiId ? assistantMsg : m), convId, 'flush');
        localMessages.push(assistantMsg);
        localMessagesRef.current = localMessages;
        if (learningEnabled) {
          conversationIndexer.indexConversation({
            projectId: homePath,
            conversationId: convId,
            title: wasNewConversation ? sentContent.trim().replace(/\s+/g, ' ').slice(0, 20) || '新对话' : undefined,
            messages: [userMsg, assistantMsg],
          }).catch(() => {});
        }

        if (activeAbortSignal.aborted) break;

        if (!result.toolCalls || result.toolCalls.length === 0) {
          activeToolMessagesRef.current = [];
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
  }, [model, conversationId, applyStreamUpdates, summarizeTitle, toneMode, toChatMessages, homePath, reasoningEffort, preserveReasoning, executeToolCalls, persistTerminatedMessages, shouldConfirmToolCall, runAutoContextCompaction, scrollToBottom, syncMessages, updateConversationId, enableBottomFollow]);

  const handleSend = useCallback(async (text: string, attachments: InputAttachment[] = []) => {
    await chatHookManager.invoke(
      'chat.send',
      { text, attachments },
      async event => performSend(event.text, event.attachments),
    );
  }, [performSend]);

  const resetShellAutoApprove = useCallback(() => {
    shellAutoApproveRef.current = false;
  }, []);

  const clearMessages = useCallback(() => {
    shellAutoApproveRef.current = false;
    syncMessages([], conversationIdRef.current, 'flush');
  }, [syncMessages]);

  const handleNewConversation = useCallback(async () => {
    shellAutoApproveRef.current = false;
    const conv = await conversationStore.createConversation();
    updateConversationId(conv.id);
    messageStoreRef.current.setMessages([]);
    persistenceRef.current.markPersisted([], conv.id);
    setMessages([]);
    return conv;
  }, [updateConversationId]);

  const handleSelectConversation = useCallback(async (id: string) => {
    shellAutoApproveRef.current = false;
    const conv = await conversationStore.getConversation(id);
    if (conv) {
      updateConversationId(conv.id);
      messageStoreRef.current.setMessages(conv.messages);
      persistenceRef.current.markPersisted(conv.messages, conv.id);
      setMessages(conv.messages);
    }
    return conv;
  }, [updateConversationId]);

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

  const contextInfo = useMemo(() => model ? parseModelContext(model.modelId) : null, [model]);
  const contextTokens = contextInfo?.contextTokens || 250_000;
  const contextSizeLabel = formatContextSize(contextTokens);

  useEffect(() => {
    if (messages.length === 0) {
      contextMetricsRef.current.clear();
      setContextPercent(0);
      return;
    }

    const timeout = setTimeout(() => {
      const contextUsedTokens = contextMetricsRef.current.estimateContextTokens(messages);
      const nextPercent = Math.min(100, Math.round((contextUsedTokens / contextTokens) * 100));
      setContextPercent(prev => prev === nextPercent ? prev : nextPercent);
    }, CONTEXT_METRICS_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [messages, contextTokens]);

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
    state: {
      messages,
      model,
      loading,
      compacting,
      contextSizeLabel,
      contextPercent,
      conversationId,
      isAtBottom,
      streaming,
      pendingToolCall,
      homePath,
    },
    actions: {
      setMessages: syncMessages,
      setConversationId: updateConversationId,
      handleSend,
      handleStop,
      scrollToBottom,
      jumpToBottom,
      clearMessages,
      handleNewConversation,
      handleSelectConversation,
      handleToolConfirm,
      handleToolReview,
      resetShellAutoApprove,
      handleCompactContext,
      reloadModel,
      recallUserMessage,
    },
    list: {
      flatListRef,
      handleScrollBeginDrag,
      handleScroll,
      handleScrollEnd,
      handleContentSizeChange,
      handleListLayout,
    },
  };
}

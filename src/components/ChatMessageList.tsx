import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import MessageBubble from './MessageBubble';
import { Message } from '../types';
import { DisplayMode } from '../services/settings';
import { fontSizes, radius, spacing } from '../constants/theme';
import { ContainedScrollProvider } from './ContainedScrollContext';
import { MessageActionsContext, MessageActionsValue } from '../contexts/MessageActionsContext';
import { useTheme } from '../theme';

interface Props {
  messages: Message[];
  listRef: React.RefObject<FlatList | null>;
  codeWrap?: boolean;
  displayMode?: DisplayMode;
  mathFormulaRenderingEnabled?: boolean;
  thinkingAutoExpand?: boolean;
  thinkingScrollable?: boolean;
  homePath?: string;
  shellConfirmToolCallId?: string;
  onShellCancel?: () => void;
  onShellConfirm?: () => void;
  onShellDefaultExecute?: () => void;
  onViewShellCommand: (command: string) => void;
  onToolReview: (toolCallId: string, state: 'accepted' | 'rejected', diffId?: string) => void;
  onRecallUserMessage: (message: Message) => void;
  onScrollBeginDrag: () => void;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEnd: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: (width: number, height: number) => void;
  onLayout: (e: LayoutChangeEvent) => void;
  onJumpToBottom: (animated?: boolean) => void;
  showScrollToBottom: boolean;
}

const LONG_ASSISTANT_MESSAGE_THRESHOLD = 12000;
const VIRTUALIZED_CHUNK_SIZE = 5000;
const CHUNK_OVERLAP = 80;

type ChatListItem =
  | { type: 'message'; key: string; message: Message }
  | {
      type: 'message-chunk';
      key: string;
      message: Message;
      content: string;
      chunkIndex: number;
      chunkCount: number;
      isFirstChunk: boolean;
      isLastChunk: boolean;
    };

const keyExtractor = (item: ChatListItem) => item.key;

function ChatMessageList({
  messages,
  listRef,
  codeWrap,
  displayMode,
  mathFormulaRenderingEnabled,
  thinkingAutoExpand,
  thinkingScrollable,
  homePath,
  shellConfirmToolCallId,
  onShellCancel,
  onShellConfirm,
  onShellDefaultExecute,
  onViewShellCommand,
  onToolReview,
  onRecallUserMessage,
  onScrollBeginDrag,
  onScroll,
  onScrollEnd,
  onContentSizeChange,
  onLayout,
  onJumpToBottom,
  showScrollToBottom,
}: Props) {
  const { colors } = useTheme();
  const visibleMessages = useMemo(
    () => messages.filter(message => !message.hidden),
    [messages],
  );
  const listData = useMemo(() => createVirtualizedMessageItems(visibleMessages), [visibleMessages]);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  const handleOuterScrollEnabled = useCallback((enabled: boolean) => {
    setListScrollEnabled(prev => prev === enabled ? prev : enabled);
  }, []);

  const actionsValue = useMemo<MessageActionsValue>(() => ({
    codeWrap,
    displayMode,
    mathFormulaRenderingEnabled,
    thinkingAutoExpand,
    thinkingScrollable,
    homePath,
    shellConfirmToolCallId,
    onShellCancel,
    onShellConfirm,
    onShellDefaultExecute,
    onViewShellCommand,
    onToolReview,
    onRecallUserMessage,
  }), [
    codeWrap,
    displayMode,
    mathFormulaRenderingEnabled,
    thinkingAutoExpand,
    thinkingScrollable,
    homePath,
    shellConfirmToolCallId,
    onShellCancel,
    onShellConfirm,
    onShellDefaultExecute,
    onViewShellCommand,
    onToolReview,
    onRecallUserMessage,
  ]);

  const renderItem = useCallback(({ item }: { item: ChatListItem }) => {
    if (item.type === 'message') {
      return <MessageBubble message={item.message} />;
    }

    return (
      <View>
        {!item.isFirstChunk ? (
          <ChunkDivider
            label={`继续第 ${item.chunkIndex + 1}/${item.chunkCount} 段`}
            color={colors.textTertiary}
            backgroundColor={colors.surfaceLight}
            borderColor={colors.borderLight}
          />
        ) : null}
        <MessageBubble
          message={item.message}
          contentOverride={item.content}
          streamingOverride={item.isLastChunk ? item.message.streaming : false}
          showActionBar={item.isLastChunk}
        />
      </View>
    );
  }, [colors.borderLight, colors.surfaceLight, colors.textTertiary]);

  return (
    <ContainedScrollProvider setOuterScrollEnabled={handleOuterScrollEnabled}>
      <MessageActionsContext.Provider value={actionsValue}>
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <FlatList
            ref={listRef}
            data={listData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            style={[styles.list, { backgroundColor: colors.bg }]}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={onContentSizeChange}
            onLayout={onLayout}
            onScrollBeginDrag={onScrollBeginDrag}
            onScroll={onScroll}
            onScrollEndDrag={onScrollEnd}
            onMomentumScrollEnd={onScrollEnd}
            scrollEnabled={listScrollEnabled}
            scrollEventThrottle={32}
            removeClippedSubviews
            initialNumToRender={10}
            maxToRenderPerBatch={5}
            updateCellsBatchingPeriod={80}
            windowSize={5}
          />
          {showScrollToBottom && visibleMessages.length > 0 ? (
            <TouchableOpacity
              accessibilityLabel="滚动到底部"
              accessibilityRole="button"
              activeOpacity={0.78}
              onPress={() => onJumpToBottom(true)}
              style={[styles.scrollToBottomButton, { backgroundColor: colors.accent }]}
            >
              <ChevronDown size={24} color={colors.textOnColor} strokeWidth={2.5} />
            </TouchableOpacity>
          ) : null}
        </View>
      </MessageActionsContext.Provider>
    </ContainedScrollProvider>
  );
}

export default React.memo(ChatMessageList);

function createVirtualizedMessageItems(messages: Message[]): ChatListItem[] {
  const items: ChatListItem[] = [];

  for (const message of messages) {
    if (!shouldVirtualizeMessage(message)) {
      items.push({ type: 'message', key: message.id, message });
      continue;
    }

    const chunks = splitMarkdownIntoChunks(message.content);
    if (chunks.length <= 1) {
      items.push({ type: 'message', key: message.id, message });
      continue;
    }

    chunks.forEach((content, chunkIndex) => {
      items.push({
        type: 'message-chunk',
        key: `${message.id}:chunk:${chunkIndex}`,
        message,
        content,
        chunkIndex,
        chunkCount: chunks.length,
        isFirstChunk: chunkIndex === 0,
        isLastChunk: chunkIndex === chunks.length - 1,
      });
    });
  }

  return items;
}

function shouldVirtualizeMessage(message: Message): boolean {
  return message.role === 'assistant'
    && !message.blocks?.length
    && !message.toolCalls?.length
    && message.content.length > LONG_ASSISTANT_MESSAGE_THRESHOLD;
}

function splitMarkdownIntoChunks(content: string): string[] {
  const lines = content.split('\n');
  const chunks: string[] = [];
  let currentLines: string[] = [];
  let currentLength = 0;
  let insideFence = false;
  let fenceMarker = '';

  const pushCurrent = () => {
    if (currentLines.length === 0) return;
    chunks.push(currentLines.join('\n').trimEnd());
    currentLines = [];
    currentLength = 0;
  };

  for (const line of lines) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/);
    const lineLength = line.length + 1;

    if (!insideFence && currentLength >= VIRTUALIZED_CHUNK_SIZE && isSafeMarkdownBoundary(line)) {
      pushCurrent();
    }

    currentLines.push(line);
    currentLength += lineLength;

    if (fenceMatch) {
      const marker = fenceMatch[1];
      if (!insideFence) {
        insideFence = true;
        fenceMarker = marker.slice(0, 3);
      } else if (marker.startsWith(fenceMarker)) {
        insideFence = false;
        fenceMarker = '';
      }
    }

    if (!insideFence && currentLength >= VIRTUALIZED_CHUNK_SIZE + CHUNK_OVERLAP) {
      pushCurrent();
    }
  }

  pushCurrent();
  return chunks;
}

function isSafeMarkdownBoundary(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.length === 0 || /^#{1,6}\s+/.test(trimmed) || /^[-*_]{3,}$/.test(trimmed);
}

function ChunkDivider({
  label,
  color,
  backgroundColor,
  borderColor,
}: {
  label: string;
  color: string;
  backgroundColor: string;
  borderColor: string;
}) {
  return (
    <View style={styles.chunkDividerWrap}>
      <View style={[styles.chunkDivider, { backgroundColor, borderColor }]}>
        <Text style={[styles.chunkDividerText, { color }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.sm },
  chunkDividerWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  chunkDivider: {
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  chunkDividerText: {
    fontSize: fontSizes.xs,
    fontWeight: '600',
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 44,
    height: 44,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 2,
  },
});

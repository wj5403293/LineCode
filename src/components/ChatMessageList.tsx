import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, NativeScrollEvent, NativeSyntheticEvent, StyleSheet } from 'react-native';
import MessageBubble from './MessageBubble';
import { Message } from '../types';
import { DisplayMode } from '../services/settings';
import { spacing } from '../constants/theme';
import { ContainedScrollProvider } from './ContainedScrollContext';

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
  onScrollToBottom: (animated?: boolean) => void;
}

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
  onScrollToBottom,
}: Props) {
  const visibleMessages = useMemo(
    () => messages.filter(message => !message.hidden),
    [messages],
  );
  const [listScrollEnabled, setListScrollEnabled] = useState(true);

  const handleOuterScrollEnabled = useCallback((enabled: boolean) => {
    setListScrollEnabled(prev => prev === enabled ? prev : enabled);
  }, []);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      codeWrap={codeWrap}
      displayMode={displayMode}
      mathFormulaRenderingEnabled={mathFormulaRenderingEnabled}
      thinkingAutoExpand={thinkingAutoExpand}
      thinkingScrollable={thinkingScrollable}
      homePath={homePath}
      shellConfirmToolCallId={shellConfirmToolCallId}
      onShellCancel={onShellCancel}
      onShellConfirm={onShellConfirm}
      onShellDefaultExecute={onShellDefaultExecute}
      onViewShellCommand={onViewShellCommand}
      onToolReview={onToolReview}
      onRecallUserMessage={onRecallUserMessage}
    />
  ), [
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

  const keyExtractor = useCallback((item: Message) => item.id, []);

  return (
    <ContainedScrollProvider setOuterScrollEnabled={handleOuterScrollEnabled}>
      <FlatList
        ref={listRef}
        data={visibleMessages}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => onScrollToBottom(false)}
        onScrollBeginDrag={onScrollBeginDrag}
        onScroll={onScroll}
        onScrollEndDrag={onScroll}
        onMomentumScrollEnd={onScroll}
        scrollEnabled={listScrollEnabled}
        scrollEventThrottle={32}
        removeClippedSubviews
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        windowSize={8}
      />
    </ContainedScrollProvider>
  );
}

export default React.memo(ChatMessageList);

const styles = StyleSheet.create({
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.sm },
});

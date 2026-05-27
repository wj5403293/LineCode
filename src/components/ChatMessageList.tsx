import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import MessageBubble from './MessageBubble';
import { Message } from '../types';
import { DisplayMode } from '../services/settings';
import { radius, spacing } from '../constants/theme';
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

const renderItem = ({ item }: { item: Message }) => <MessageBubble message={item} />;
const keyExtractor = (item: Message) => item.id;

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

  return (
    <ContainedScrollProvider setOuterScrollEnabled={handleOuterScrollEnabled}>
      <MessageActionsContext.Provider value={actionsValue}>
        <View style={[styles.container, { backgroundColor: colors.bg }]}>
          <FlatList
            ref={listRef}
            data={visibleMessages}
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
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            windowSize={8}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.sm },
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

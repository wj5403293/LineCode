import React, { useCallback, useMemo } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../components/Header';
import MessageBubble from '../components/MessageBubble';
import InputBar from '../components/InputBar';
import Dialog from '../components/Dialog';
import EmptyState from '../components/EmptyState';
import Sidebar from '../components/Sidebar';
import BatchDeleteConfirm from '../components/BatchDeleteConfirm';
import { Message } from '../types';
import { colors, spacing } from '../constants/theme';
import { PERMISSIONS, MORE_OPTIONS } from '../constants/options';
import { useChatState } from '../hooks/useChatState';
import { useDialog } from '../hooks/useDialog';
import { useSettings } from '../hooks/useSettings';
import { useConversationManager } from '../hooks/useConversationManager';
import { useProjectSelection } from '../hooks/useProjectSelection';

interface Props {
  onGoSettings: () => void;
}

export default function ChatScreen({ onGoSettings }: Props) {
  const insets = useSafeAreaInsets();
  const { codeWrap, displayMode, toneMode, thinkingScrollable, thinkingAutoExpand } = useSettings();
  const chat = useChatState(toneMode);
  const { dialog, openDialog, closeDialog } = useDialog();
  const conversation = useConversationManager();
  const { projects, selectedProject, handleProjectSelect } = useProjectSelection();

  const containerStyle = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);

  const renderItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      codeWrap={codeWrap}
      displayMode={displayMode}
      thinkingAutoExpand={thinkingAutoExpand}
      thinkingScrollable={thinkingScrollable}
      homePath={chat.homePath}
    />
  ), [codeWrap, displayMode, thinkingAutoExpand, thinkingScrollable, chat.homePath]);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const handleMoreSelect = useCallback((id: string) => {
    closeDialog();
    if (id === 'settings') onGoSettings();
    if (id === 'clear') chat.clearMessages();
  }, [onGoSettings, closeDialog, chat.clearMessages]);

  const handleProjectDialogSelect = useCallback((id: string) => {
    handleProjectSelect(id);
    closeDialog();
  }, [handleProjectSelect, closeDialog]);

  const handleNewConversation = useCallback(async () => {
    await conversation.handleNewConversation();
    chat.setMessages([]);
  }, [conversation.handleNewConversation, chat.setMessages]);

  const handleSelectConversation = useCallback(async (id: string) => {
    const conv = await conversation.handleSelectConversation(id);
    if (conv) {
      chat.setConversationId(conv.id);
      chat.setMessages(conv.messages);
    }
  }, [conversation.handleSelectConversation, chat.setConversationId, chat.setMessages]);

  if (!chat.model && !chat.loading) {
    return (
      <>
        <View style={containerStyle}>
          <Header
            projectLabel={selectedProject.label}
            onPressMenu={conversation.openSidebar}
            onPressProject={() => openDialog('project')}
            onPressPermission={() => openDialog('permission')}
            onPressAdd={handleNewConversation}
            onPressMore={() => openDialog('more')}
          />
          <EmptyState onGoSettings={onGoSettings} />
          <Dialog visible={dialog === 'more'} title="更多" options={MORE_OPTIONS} selectedId="" onSelect={handleMoreSelect} onClose={closeDialog} />
        </View>
        <Sidebar
          visible={conversation.sidebarVisible}
          currentId={conversation.conversationId}
          onClose={conversation.closeSidebar}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
        />
      </>
    );
  }

  return (
    <>
      <View style={containerStyle}>
        <Header
          projectLabel={selectedProject.label}
          onPressMenu={conversation.openSidebar}
          onPressProject={() => openDialog('project')}
          onPressPermission={() => openDialog('permission')}
          onPressAdd={handleNewConversation}
          onPressMore={() => openDialog('more')}
        />

        <FlatList
          ref={chat.flatListRef}
          data={chat.messages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => chat.scrollToBottom()}
          onScroll={chat.handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
        />

        <InputBar onSend={chat.handleSend} onStop={chat.handleStop} streaming={chat.streaming} />

        <Dialog visible={dialog === 'project'} title="项目" options={projects} selectedId={selectedProject.id} onSelect={handleProjectDialogSelect} onClose={closeDialog} />
        <Dialog visible={dialog === 'permission'} title="权限设置" options={PERMISSIONS} selectedId="" onSelect={() => {}} onClose={closeDialog} />
        <Dialog visible={dialog === 'more'} title="更多" options={MORE_OPTIONS} selectedId="" onSelect={handleMoreSelect} onClose={closeDialog} />

        <Sidebar
          visible={conversation.sidebarVisible}
          currentId={conversation.conversationId}
          onClose={conversation.closeSidebar}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
        />

        <BatchDeleteConfirm
          visible={!!chat.pendingToolCall}
          toolCalls={chat.pendingToolCall?.toolCalls || []}
          homePath={chat.homePath}
          onConfirm={chat.handleToolConfirm}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.sm },
});

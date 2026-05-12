import React, { useCallback, useMemo, useEffect } from 'react';
import { Alert, View, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../components/Header';
import MessageBubble from '../components/MessageBubble';
import InputBar from '../components/InputBar';
import Dialog from '../components/Dialog';
import EmptyState from '../components/EmptyState';
import Sidebar from '../components/Sidebar';
import BatchDeleteConfirm from '../components/BatchDeleteConfirm';
import { Message } from '../types';
import { spacing } from '../constants/theme';
import { useTheme } from '../theme';
import { PERMISSIONS, MORE_OPTIONS } from '../constants/options';
import { useChatState } from '../hooks/useChatState';
import { useDialog } from '../hooks/useDialog';
import { useSettings } from '../hooks/useSettings';
import { useConversationManager } from '../hooks/useConversationManager';
import { useProjectSelection } from '../hooks/useProjectSelection';
import { PermissionMode } from '../services/settings';
import { permissionService } from '../services/PermissionService';
import { setKeepAwake } from '../utils/keepAwake';

interface Props {
  onGoSettings: () => void;
  onViewShellCommand: (command: string) => void;
}

export default function ChatScreen({ onGoSettings, onViewShellCommand }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const {
    codeWrap,
    displayMode,
    toneMode,
    thinkingScrollable,
    thinkingAutoExpand,
    reasoningEffort,
    preserveReasoning,
    permissionMode,
    mcpExecutionMode,
    updatePermissionMode,
  } = useSettings();
  const chat = useChatState(toneMode, reasoningEffort, preserveReasoning);
  const {
    reloadModel,
    streaming,
    homePath,
    clearMessages,
    setMessages,
    setConversationId,
    flatListRef,
    messages,
    handleSend,
    handleStop,
    pendingToolCall,
    handleToolConfirm,
    handleToolReview,
    model,
    loading,
    scrollToBottom,
    handleScrollBeginDrag,
    handleScroll,
    resetShellAutoApprove,
    handleCompactContext,
    contextSizeLabel,
    contextPercent,
    compacting,
  } = chat;
  const { dialog, openDialog, closeDialog } = useDialog();
  const conversation = useConversationManager();
  const {
    openSidebar,
    closeSidebar,
    sidebarVisible,
    conversationId,
    handleNewConversation: createConversation,
    handleSelectConversation: selectConversation,
  } = conversation;
  const { projects, selectedProject, handleProjectSelect } = useProjectSelection();

  useFocusEffect(
    useCallback(() => {
      reloadModel();
    }, [reloadModel])
  );

  const containerStyle = useMemo(() => [styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }], [insets.top, colors.bg]);

  useEffect(() => {
    permissionService.setMode(permissionMode);
  }, [permissionMode]);

  useEffect(() => {
    setKeepAwake(streaming || compacting);
    return () => setKeepAwake(false);
  }, [streaming, compacting]);

  const handlePermissionSelect = useCallback(async (id: string) => {
    const mode = id as PermissionMode;
    await updatePermissionMode(mode);
    permissionService.setMode(mode);
    closeDialog();
  }, [closeDialog, updatePermissionMode]);

  const shellConfirmToolCallId = pendingToolCall?.type === 'shell'
    ? pendingToolCall.toolCalls.find(tc => tc.name === 'shell_execute')?.id
    : undefined;

  const handleShellAutoExecute = useCallback(() => {
    Alert.alert(
      '自动运行 shell 命令',
      '本轮对话后续非危险 shell 命令会自动执行。应用会继续拦截明显危险命令，但模型生成的命令仍可能修改文件、安装依赖或产生网络请求。请确认你信任当前任务。',
      [
        { text: '取消', style: 'cancel' },
        { text: '确认自动运行', style: 'destructive', onPress: () => handleToolConfirm(true, true) },
      ],
    );
  }, [handleToolConfirm]);

  const renderItem = useCallback(({ item }: { item: Message }) => (
      <MessageBubble
      message={item}
      codeWrap={codeWrap}
      displayMode={displayMode}
      thinkingAutoExpand={thinkingAutoExpand}
      thinkingScrollable={thinkingScrollable}
      homePath={homePath}
      shellConfirmToolCallId={shellConfirmToolCallId}
      onShellCancel={() => handleToolConfirm(false)}
      onShellConfirm={() => handleToolConfirm(true)}
      onShellDefaultExecute={handleShellAutoExecute}
      onViewShellCommand={onViewShellCommand}
      onToolReview={handleToolReview}
    />
  ), [
    codeWrap,
    displayMode,
    thinkingAutoExpand,
    thinkingScrollable,
    homePath,
    shellConfirmToolCallId,
    handleToolConfirm,
    handleShellAutoExecute,
    onViewShellCommand,
    handleToolReview,
  ]);

  const keyExtractor = useCallback((item: Message) => item.id, []);

  const handleMoreSelect = useCallback((id: string) => {
    closeDialog();
    if (id === 'settings') onGoSettings();
    if (id === 'clear') clearMessages();
    if (id === 'compact') {
      Alert.alert(
        '压缩上下文',
        '压缩会把当前对话的早期上下文总结成一条隐藏摘要，旧消息仍保留在历史中，但后续请求会使用压缩后的上下文继续。是否继续？',
        [
          { text: '取消', style: 'cancel' },
          { text: '确认压缩', onPress: handleCompactContext },
        ],
      );
    }
  }, [onGoSettings, closeDialog, clearMessages, handleCompactContext]);

  const handleProjectDialogSelect = useCallback((id: string) => {
    handleProjectSelect(id);
    closeDialog();
  }, [handleProjectSelect, closeDialog]);

  const handleNewConversation = useCallback(async () => {
    resetShellAutoApprove();
    await createConversation();
    setMessages([]);
  }, [createConversation, resetShellAutoApprove, setMessages]);

  const handleSelectConversation = useCallback(async (id: string) => {
    resetShellAutoApprove();
    const conv = await selectConversation(id);
    if (conv) {
      setConversationId(conv.id);
      setMessages(conv.messages);
    }
  }, [resetShellAutoApprove, selectConversation, setConversationId, setMessages]);

  if (!model && !loading) {
    return (
      <>
        <View style={containerStyle}>
          <Header
            projectLabel={selectedProject.label}
            onPressMenu={openSidebar}
            onPressProject={() => openDialog('project')}
            onPressPermission={() => openDialog('permission')}
            onPressAdd={handleNewConversation}
            onPressMore={() => openDialog('more')}
          />
          <EmptyState onGoSettings={onGoSettings} />
          <Dialog visible={dialog === 'more'} title="更多" options={MORE_OPTIONS} selectedId="" onSelect={handleMoreSelect} onClose={closeDialog} />
        </View>
        <Sidebar
          visible={sidebarVisible}
          currentId={conversationId}
          onClose={closeSidebar}
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
          onPressMenu={openSidebar}
          onPressProject={() => openDialog('project')}
          onPressPermission={() => openDialog('permission')}
          onPressAdd={handleNewConversation}
          onPressMore={() => openDialog('more')}
        />

        <FlatList
          ref={flatListRef}
          data={messages.filter(message => !message.hidden)}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => scrollToBottom(false)}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          onScrollEndDrag={handleScroll}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
        />

        <InputBar
          onSend={handleSend}
          onStop={handleStop}
          streaming={streaming || compacting}
          mode={mcpExecutionMode}
          homePath={homePath}
          modelId={model?.modelId || ''}
          contextSizeLabel={contextSizeLabel}
          contextPercent={contextPercent}
        />

        <Dialog visible={dialog === 'project'} title="项目" options={projects} selectedId={selectedProject.id} onSelect={handleProjectDialogSelect} onClose={closeDialog} />
        <Dialog visible={dialog === 'permission'} title="权限设置" options={PERMISSIONS} selectedId={permissionMode} onSelect={handlePermissionSelect} onClose={closeDialog} />
        <Dialog visible={dialog === 'more'} title="更多" options={MORE_OPTIONS} selectedId="" onSelect={handleMoreSelect} onClose={closeDialog} />

        <Sidebar
          visible={sidebarVisible}
          currentId={conversationId}
          onClose={closeSidebar}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
        />

        <BatchDeleteConfirm
          visible={!!pendingToolCall && pendingToolCall.type !== 'shell' && pendingToolCall.toolCalls.some(tc => tc.name === 'file_delete')}
          toolCalls={pendingToolCall?.toolCalls.filter(tc => tc.name === 'file_delete') || []}
          homePath={homePath}
          onConfirm={handleToolConfirm}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: { paddingVertical: spacing.sm },
});

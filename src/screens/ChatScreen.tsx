import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../components/Header';
import InputBar from '../components/InputBar';
import Dialog from '../components/Dialog';
import EmptyState from '../components/EmptyState';
import Sidebar from '../components/Sidebar';
import BatchDeleteConfirm from '../components/BatchDeleteConfirm';
import { useTheme } from '../theme';
import { PERMISSIONS, MORE_OPTIONS } from '../constants/options';
import { useChatState } from '../hooks/useChatState';
import { useDialog } from '../hooks/useDialog';
import { useSettings } from '../hooks/useSettings';
import { useConversationManager } from '../hooks/useConversationManager';
import { useProjectSelection } from '../hooks/useProjectSelection';
import { PermissionMode } from '../services/settings';
import { permissionService } from '../services/PermissionService';
import { setFakeMusicPlayback, setForegroundCodingService, setKeepAwake } from '../utils/keepAwake';
import { projectService } from '../services/ProjectService';
import ChatMessageList from '../components/ChatMessageList';
import CreateProjectModal from '../components/CreateProjectModal';

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
    mathFormulaRenderingEnabled,
    permissionMode,
    mcpExecutionMode,
    keepAliveSettings,
    updatePermissionMode,
    reloadSettings,
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
    recallUserMessage,
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
  const { projects, selectedProject, handleProjectSelect, handleOpenProject, handleCreateProject } = useProjectSelection();
  const projectOptions = useMemo(
    () => projects.map(project => ({
      ...project,
      desc: projectService.getProjectDisplayPath(project),
    })),
    [projects],
  );
  const [createProjectVisible, setCreateProjectVisible] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [recalledDraft, setRecalledDraft] = useState<string | undefined>();

  useFocusEffect(
    useCallback(() => {
      reloadModel();
      reloadSettings();
    }, [reloadModel, reloadSettings])
  );

  const containerStyle = useMemo(() => [styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }], [insets.top, colors.bg]);

  useEffect(() => {
    permissionService.setMode(permissionMode);
  }, [permissionMode]);

  useEffect(() => {
    const active = streaming || compacting;
    setKeepAwake(keepAliveSettings.wakeLock && active);
    setForegroundCodingService(keepAliveSettings.foregroundService);
    setFakeMusicPlayback(keepAliveSettings.fakeMusic);
    return () => {
      setKeepAwake(false);
    };
  }, [streaming, compacting, keepAliveSettings]);

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

  const handleRecallUserMessage = useCallback((messageId: string) => {
    const draft = recallUserMessage(messageId);
    setRecalledDraft(draft);
  }, [recallUserMessage]);

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
    if (id === '__open_project') {
      closeDialog();
      handleOpenProject().catch((err: any) => Alert.alert('打开项目失败', err?.message || String(err)));
      return;
    }
    if (id === '__create_project') {
      closeDialog();
      setProjectName('');
      setCreateProjectVisible(true);
      return;
    }
    handleProjectSelect(id).catch((err: any) => Alert.alert('切换项目失败', err?.message || String(err)));
    closeDialog();
  }, [handleProjectSelect, handleOpenProject, closeDialog]);

  const handleOpenProjectAction = useCallback(() => {
    handleOpenProject().catch((err: any) => Alert.alert('打开项目失败', err?.message || String(err)));
  }, [handleOpenProject]);

  const handleCreateProjectAction = useCallback(() => {
    setProjectName('');
    setCreateProjectVisible(true);
  }, []);

  const submitCreateProject = useCallback(async () => {
    try {
      const name = projectName.trim();
      if (!name) return;
      await handleCreateProject(name);
      setCreateProjectVisible(false);
      setProjectName('');
    } catch (err: any) {
      Alert.alert('创建项目失败', err?.message || String(err));
    }
  }, [handleCreateProject, projectName]);

  const handleNewConversation = useCallback(async () => {
    resetShellAutoApprove();
    const conv = await createConversation();
    setConversationId(conv.id);
    setMessages([]);
  }, [createConversation, resetShellAutoApprove, setConversationId, setMessages]);

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
          <Dialog
            visible={dialog === 'project'}
            title="项目"
            options={[
              ...projectOptions,
              { id: '__open_project', label: '打开项目', desc: '选择外部目录并使用真实路径' },
              { id: '__create_project', label: '创建项目', desc: '在 .linecode/project 下创建目录' },
            ]}
            selectedId={selectedProject.id}
            onSelect={handleProjectDialogSelect}
            onClose={closeDialog}
          />
          <Dialog visible={dialog === 'permission'} title="权限设置" options={PERMISSIONS} selectedId={permissionMode} onSelect={handlePermissionSelect} onClose={closeDialog} />
          <Dialog visible={dialog === 'more'} title="更多" options={MORE_OPTIONS} selectedId="" onSelect={handleMoreSelect} onClose={closeDialog} />
        </View>
        <Sidebar
          visible={sidebarVisible}
          currentId={conversationId}
          onClose={closeSidebar}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          homePath={homePath}
          projectLabel={selectedProject.label}
          onOpenProject={handleOpenProjectAction}
          onCreateProject={handleCreateProjectAction}
        />
        <CreateProjectModal
          visible={createProjectVisible}
          value={projectName}
          onChangeText={setProjectName}
          onCancel={() => setCreateProjectVisible(false)}
          onConfirm={submitCreateProject}
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

        <ChatMessageList
          listRef={flatListRef}
          messages={messages}
          codeWrap={codeWrap}
          displayMode={displayMode}
          mathFormulaRenderingEnabled={mathFormulaRenderingEnabled}
          thinkingAutoExpand={thinkingAutoExpand}
          thinkingScrollable={thinkingScrollable}
          homePath={homePath}
          shellConfirmToolCallId={shellConfirmToolCallId}
          onShellCancel={() => handleToolConfirm(false)}
          onShellConfirm={() => handleToolConfirm(true)}
          onShellDefaultExecute={handleShellAutoExecute}
          onViewShellCommand={onViewShellCommand}
          onToolReview={handleToolReview}
          onRecallUserMessage={(message) => handleRecallUserMessage(message.id)}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          onScrollToBottom={scrollToBottom}
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
          draftText={recalledDraft}
          onDraftConsumed={() => setRecalledDraft(undefined)}
        />

        <Dialog
          visible={dialog === 'project'}
          title="项目"
          options={[
            ...projectOptions,
            { id: '__open_project', label: '打开项目', desc: '选择外部目录并使用真实路径' },
            { id: '__create_project', label: '创建项目', desc: '在 .linecode/project 下创建目录' },
          ]}
          selectedId={selectedProject.id}
          onSelect={handleProjectDialogSelect}
          onClose={closeDialog}
        />
        <Dialog visible={dialog === 'permission'} title="权限设置" options={PERMISSIONS} selectedId={permissionMode} onSelect={handlePermissionSelect} onClose={closeDialog} />
        <Dialog visible={dialog === 'more'} title="更多" options={MORE_OPTIONS} selectedId="" onSelect={handleMoreSelect} onClose={closeDialog} />

        <Sidebar
          visible={sidebarVisible}
          currentId={conversationId}
          onClose={closeSidebar}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
          homePath={homePath}
          projectLabel={selectedProject.label}
          onOpenProject={handleOpenProjectAction}
          onCreateProject={handleCreateProjectAction}
        />

        <BatchDeleteConfirm
          visible={!!pendingToolCall && pendingToolCall.type !== 'shell' && pendingToolCall.toolCalls.some(tc => tc.name === 'file_delete')}
          toolCalls={pendingToolCall?.toolCalls.filter(tc => tc.name === 'file_delete') || []}
          homePath={homePath}
          onConfirm={handleToolConfirm}
        />
      </View>
      <CreateProjectModal
        visible={createProjectVisible}
        value={projectName}
        onChangeText={setProjectName}
        onCancel={() => setCreateProjectVisible(false)}
        onConfirm={submitCreateProject}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});

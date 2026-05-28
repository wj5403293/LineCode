import React, { useCallback, useMemo, useEffect, useState } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Header from '../components/Header';
import InputBar, { NativeKeyboardFrame } from '../components/InputBar';
import Dialog from '../components/Dialog';
import EmptyState from '../components/EmptyState';
import Sidebar from '../components/Sidebar';
import BatchDeleteConfirm from '../components/BatchDeleteConfirm';
import { useTheme } from '../theme';
import { PERMISSIONS, MORE_OPTIONS } from '../constants/options';
import { useChatController } from '../chat/useChatController';
import { useDialog } from '../hooks/useDialog';
import { useSettings } from '../hooks/useSettings';
import { useProjectSelection } from '../hooks/useProjectSelection';
import type { TutorialVariant } from '../constants/tutorial';
import { PermissionMode } from '../services/settings';
import { permissionService } from '../services/PermissionService';
import { setFakeMusicPlayback, setForegroundCodingService, setKeepAwake } from '../utils/keepAwake';
import { projectService } from '../services/ProjectService';
import ChatMessageList from '../components/ChatMessageList';
import CreateProjectModal from '../components/CreateProjectModal';
import { Message } from '../types';
import { addAndroidKeyboardFrameListener } from '../utils/androidKeyboardFrame';

interface Props {
  onGoSettings: () => void;
  onOpenTutorial: (variant: TutorialVariant) => void;
  onViewShellCommand: (command: string) => void;
}

export default function ChatScreen({ onGoSettings, onOpenTutorial, onViewShellCommand }: Props) {
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
    experimentalAndroidKeyboardAvoidanceEnabled,
    updatePermissionMode,
    reloadSettings,
  } = useSettings();
  const chat = useChatController({ toneMode, reasoningEffort, preserveReasoning });
  const {
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
  } = chat.state;
  const {
    reloadModel,
    clearMessages,
    handleSend,
    handleStop,
    handleToolConfirm,
    handleToolReview,
    jumpToBottom,
    resetShellAutoApprove,
    handleCompactContext,
    recallUserMessage,
    handleNewConversation: createConversation,
    handleSelectConversation: selectConversation,
  } = chat.actions;
  const {
    flatListRef,
    handleScrollBeginDrag,
    handleScroll,
    handleScrollEnd,
    handleContentSizeChange,
    handleListLayout,
  } = chat.list;
  const { dialog, openDialog, closeDialog } = useDialog();
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
  const [keyboardFrame, setKeyboardFrame] = useState<NativeKeyboardFrame | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const openSidebar = useCallback(() => setSidebarVisible(true), []);
  const closeSidebar = useCallback(() => setSidebarVisible(false), []);

  useFocusEffect(
    useCallback(() => {
      reloadModel();
      reloadSettings();
    }, [reloadModel, reloadSettings])
  );

  const containerStyle = useMemo(() => [styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }], [insets.top, colors.bg]);

  useEffect(() => {
    if (!experimentalAndroidKeyboardAvoidanceEnabled) {
      setKeyboardFrame(null);
      return;
    }
    return addAndroidKeyboardFrameListener(setKeyboardFrame);
  }, [experimentalAndroidKeyboardAvoidanceEnabled]);

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

  const handleShellCancel = useCallback(() => {
    handleToolConfirm(false);
  }, [handleToolConfirm]);

  const handleShellConfirm = useCallback(() => {
    handleToolConfirm(true);
  }, [handleToolConfirm]);

  const handleRecallUserMessage = useCallback((messageId: string) => {
    const draft = recallUserMessage(messageId);
    setRecalledDraft(draft);
  }, [recallUserMessage]);

  const handleMessageRecall = useCallback((message: Message) => {
    handleRecallUserMessage(message.id);
  }, [handleRecallUserMessage]);

  const handleMoreSelect = useCallback((id: string) => {
    closeDialog();
    if (id === 'tutorial') onOpenTutorial('beginner');
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
  }, [onOpenTutorial, onGoSettings, closeDialog, clearMessages, handleCompactContext]);

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
    await createConversation();
    closeSidebar();
  }, [closeSidebar, createConversation, resetShellAutoApprove]);

  const handleSelectConversation = useCallback(async (id: string) => {
    resetShellAutoApprove();
    await selectConversation(id);
    closeSidebar();
  }, [closeSidebar, resetShellAutoApprove, selectConversation]);

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
          onShellCancel={handleShellCancel}
          onShellConfirm={handleShellConfirm}
          onShellDefaultExecute={handleShellAutoExecute}
          onViewShellCommand={onViewShellCommand}
          onToolReview={handleToolReview}
          onRecallUserMessage={handleMessageRecall}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          onScrollEnd={handleScrollEnd}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleListLayout}
          onJumpToBottom={jumpToBottom}
          showScrollToBottom={!isAtBottom}
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
          keyboardFrame={experimentalAndroidKeyboardAvoidanceEnabled ? keyboardFrame : null}
          bottomInset={insets.bottom}
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

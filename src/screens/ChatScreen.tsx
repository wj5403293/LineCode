import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, FlatList, StyleSheet, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../components/Header';
import MessageBubble from '../components/MessageBubble';
import InputBar from '../components/InputBar';
import Dialog from '../components/Dialog';
import EmptyState from '../components/EmptyState';
import Sidebar from '../components/Sidebar';
import { Message, Model } from '../types';
import { colors, spacing } from '../constants/theme';
import { getModels, getSelectedModelId } from '../services/storage';
import { sendMessage, buildMessages, SYSTEM_PROMPT } from '../services/ai';
import {
  Conversation, getConversations, getCurrentConversationId,
  createConversation, updateConversation, setCurrentConversationId,
} from '../services/conversation';
import {
  getCodeWrap, getDisplayMode, getToneMode,
  getThinkingScroll, getThinkingAutoExpand,
  DisplayMode, ToneMode,
} from '../services/settings';

const PERMISSIONS = [
  { id: 'read', label: '只读', desc: '仅查看文件' },
  { id: 'write', label: '读写', desc: '可修改文件' },
  { id: 'full', label: '完全', desc: '包括执行命令' },
];

const MORE_OPTIONS = [
  { id: 'settings', label: '设置' },
  { id: 'clear', label: '清空对话' },
];

type DialogType = 'project' | 'permission' | 'more' | null;

const renderItem = ({ item, codeWrap, displayMode, thinkingAutoExpand, thinkingScrollable }: {
  item: Message; codeWrap?: boolean; displayMode?: DisplayMode;
  thinkingAutoExpand?: boolean; thinkingScrollable?: boolean;
}) => (
  <MessageBubble
    message={item}
    codeWrap={codeWrap}
    displayMode={displayMode}
    thinkingAutoExpand={thinkingAutoExpand}
    thinkingScrollable={thinkingScrollable}
  />
);
const keyExtractor = (item: Message) => item.id;

interface Props {
  onGoSettings: () => void;
}

export default function ChatScreen({ onGoSettings }: Props) {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<Model | null>(null);
  const [loading, setLoading] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const streamingRef = useRef(false);
  const atBottomRef = useRef(true);

  const [dialog, setDialog] = useState<DialogType>(null);
  const [codeWrap, setCodeWrap] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('fullscreen');
  const [toneMode, setToneMode] = useState<ToneMode>('coding');
  const [thinkingScrollable, setThinkingScrollable] = useState(true);
  const [thinkingAutoExpand, setThinkingAutoExpand] = useState(false);

  const containerStyle = useMemo(() => [styles.container, { paddingTop: insets.top }], [insets.top]);

  // Load model and conversation on mount
  useEffect(() => {
    (async () => {
      const [models, selectedId, convId, wrap, display, tone, scroll, autoExpand] = await Promise.all([
        getModels(),
        getSelectedModelId(),
        getCurrentConversationId(),
        getCodeWrap(),
        getDisplayMode(),
        getToneMode(),
        getThinkingScroll(),
        getThinkingAutoExpand(),
      ]);

      if (selectedId) {
        setModel(models.find(m => m.id === selectedId) || null);
      } else if (models.length > 0) {
        setModel(models[0]);
      }

      if (convId) {
        const conversations = await getConversations();
        const conv = conversations.find(c => c.id === convId);
        if (conv) {
          setConversationId(conv.id);
          setMessages(conv.messages);
        }
      }

      setCodeWrap(wrap);
      setDisplayMode(display);
      setToneMode(tone);
      setThinkingScrollable(scroll);
      setThinkingAutoExpand(autoExpand);
      setLoading(false);
    })();
  }, []);

  // Auto-save messages
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      updateConversation(conversationId, { messages });
    }
  }, [conversationId, messages]);

  const scrollToBottom = useCallback((animated = true) => {
    if (atBottomRef.current) {
      flatListRef.current?.scrollToEnd({ animated });
    }
  }, []);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 80;
    atBottomRef.current = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const handleMoreSelect = useCallback((id: string) => {
    setDialog(null);
    if (id === 'settings') onGoSettings();
    if (id === 'clear') setMessages([]);
  }, [onGoSettings]);

  // Summarize conversation title
  const summarizeTitle = useCallback(async (model: Model, firstUserMsg: string, firstAiMsg: string) => {
    try {
      const result = await sendMessage(model, [
        { role: 'system', content: '用不超过10个字总结这段对话的主题，只输出标题，不要任何标点符号。' },
        { role: 'user', content: `用户: ${firstUserMsg}\n助手: ${firstAiMsg}` },
      ]);
      const title = result.text.trim().slice(0, 20);
      if (title && conversationId) {
        updateConversation(conversationId, { title });
      }
    } catch {}
  }, [conversationId]);

  const handleSend = useCallback(async (text: string) => {
    if (!model || streamingRef.current) return;

    // Create conversation if needed
    let convId = conversationId;
    if (!convId) {
      const conv = await createConversation();
      convId = conv.id;
      setConversationId(conv.id);
    }

    const now = Date.now();
    const userMsg: Message = { id: String(now), role: 'user', content: text, timestamp: now };
    const aiId = String(now + 1);

    atBottomRef.current = true;
    setMessages(prev => [...prev, userMsg, {
      id: aiId, role: 'assistant', content: '', blocks: [], timestamp: now + 1, streaming: true,
    }]);

    streamingRef.current = true;

    try {
      const chatMessages = buildMessages(
        SYSTEM_PROMPT,
        [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        toneMode,
      );

      const result = await sendMessage(model, chatMessages, {
        onBlocks: (blocks) => {
          setMessages(prev => prev.map(m =>
            m.id === aiId ? { ...m, blocks, content: blocks.filter(b => b.type === 'text').map(b => b.content).join('') } : m,
          ));
          scrollToBottom(false);
        },
      });

      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === aiId ? { ...m, content: result.text, blocks: result.blocks, streaming: false } : m,
        );
        // Summarize title after first AI response
        if (messages.length === 0) {
          summarizeTitle(model, text, result.text);
        }
        return updated;
      });
    } catch (err: any) {
      console.error('[LineAI] sendMessage error:', err);
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, content: `错误: ${err.message || '请求失败'}`, streaming: false } : m,
      ));
    } finally {
      streamingRef.current = false;
    }
  }, [model, messages, conversationId, scrollToBottom, summarizeTitle]);

  const handleNewConversation = useCallback(async () => {
    const conv = await createConversation();
    setConversationId(conv.id);
    setMessages([]);
    setSidebarVisible(false);
  }, []);

  const handleSelectConversation = useCallback(async (id: string) => {
    const conversations = await getConversations();
    const conv = conversations.find(c => c.id === id);
    if (conv) {
      setConversationId(conv.id);
      setMessages(conv.messages);
      await setCurrentConversationId(id);
    }
    setSidebarVisible(false);
  }, []);

  const PROJECTS = [
    { id: '1', label: 'LineAI 主项目' },
    { id: '2', label: '移动端 App' },
    { id: '3', label: '后端服务' },
    { id: '4', label: '组件库' },
  ];

  const [selectedProject, setSelectedProject] = useState(PROJECTS[0]);

  const handleProjectSelect = useCallback((id: string) => {
    setSelectedProject(PROJECTS.find(p => p.id === id) || PROJECTS[0]);
    setDialog(null);
  }, []);

  if (!model && !loading) {
    return (
      <>
        <View style={containerStyle}>
          <Header
            projectLabel={selectedProject.label}
            onPressMenu={() => {
            console.log('[LineAI] Menu pressed');
            setSidebarVisible(true);
          }}
            onPressProject={() => setDialog('project')}
            onPressPermission={() => setDialog('permission')}
            onPressAdd={handleNewConversation}
            onPressMore={() => setDialog('more')}
          />
          <EmptyState onGoSettings={onGoSettings} />
          <Dialog visible={dialog === 'more'} title="更多" options={MORE_OPTIONS} selectedId="" onSelect={handleMoreSelect} onClose={closeDialog} />
        </View>
        <Sidebar
          visible={sidebarVisible}
          currentId={conversationId}
          onClose={() => setSidebarVisible(false)}
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
          onPressMenu={() => {
            console.log('[LineAI] Menu pressed');
            setSidebarVisible(true);
          }}
          onPressProject={() => setDialog('project')}
          onPressPermission={() => setDialog('permission')}
          onPressAdd={handleNewConversation}
          onPressMore={() => setDialog('more')}
        />

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={(props) => renderItem({
            ...props, codeWrap, displayMode, thinkingAutoExpand, thinkingScrollable,
          })}
          keyExtractor={keyExtractor}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => scrollToBottom()}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={10}
        />

        <InputBar onSend={handleSend} streaming={streamingRef.current} />

        <Dialog visible={dialog === 'project'} title="项目" options={PROJECTS} selectedId={selectedProject.id} onSelect={handleProjectSelect} onClose={closeDialog} />
        <Dialog visible={dialog === 'permission'} title="权限设置" options={PERMISSIONS} selectedId="" onSelect={() => {}} onClose={closeDialog} />
        <Dialog visible={dialog === 'more'} title="更多" options={MORE_OPTIONS} selectedId="" onSelect={handleMoreSelect} onClose={closeDialog} />

        <Sidebar
          visible={sidebarVisible}
          currentId={conversationId}
          onClose={() => setSidebarVisible(false)}
          onSelect={handleSelectConversation}
          onNew={handleNewConversation}
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

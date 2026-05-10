import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Modal, Animated as RNAnimated,
} from 'react-native';
import { Plus, X, Trash2, MessageSquare, FolderOpen, Archive } from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { Conversation, conversationStore } from '../services/conversation';
import { colors, spacing, fontSizes, radius } from '../constants/theme';
import FileTree from './FileTree';

const SIDEBAR_WIDTH = 300;

type TabType = 'conversations' | 'files';

interface Props {
  visible: boolean;
  currentId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
}

const HOME_DIR = `${RNFS.DocumentDirectoryPath}/.linecode/home`;

const ConversationItem = React.memo(function ConversationItem({
  item, isActive, onSelect, onDelete,
}: {
  item: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const date = new Date(item.updatedAt);
  const timeStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  return (
    <TouchableOpacity
      style={[styles.item, isActive && styles.itemActive]}
      onPress={onSelect}
      activeOpacity={0.7}
    >
      <View style={styles.itemIcon}>
        <MessageSquare size={16} color={isActive ? colors.accent : colors.textTertiary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, isActive && styles.itemTitleActive]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemTime}>{timeStr}</Text>
      </View>
      <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
        <Trash2 size={14} color={colors.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

export default function Sidebar({ visible, currentId, onClose, onSelect, onNew }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const slideAnim = useRef(new RNAnimated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      conversationStore.getConversations().then(setConversations);
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        RNAnimated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(-SIDEBAR_WIDTH);
      backdropAnim.setValue(0);
    }
  }, [visible]);

  const handleDelete = useCallback(async (id: string) => {
    await conversationStore.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportZip = useCallback(async () => {
    try {
      const zipPath = `${RNFS.DocumentDirectoryPath}/linecode_home_export.zip`;
      const { zip } = require('react-native-zip-archive');
      await zip(HOME_DIR, zipPath);
      setExportResult(zipPath);
      setExportError(null);
    } catch (err: any) {
      setExportError(err.message);
      setExportResult(null);
    }
  }, []);

  const renderItem = useCallback(({ item }: { item: Conversation }) => (
    <ConversationItem
      item={item}
      isActive={item.id === currentId}
      onSelect={() => onSelect(item.id)}
      onDelete={() => handleDelete(item.id)}
    />
  ), [currentId, onSelect, handleDelete]);

  const keyExtractor = useCallback((item: Conversation) => item.id, []);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <RNAnimated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
        </RNAnimated.View>
        <RNAnimated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {activeTab === 'conversations' ? '对话历史' : '文件管理器'}
            </Text>
            <View style={styles.headerActions}>
              {activeTab === 'files' && (
                <TouchableOpacity onPress={handleExportZip} style={styles.exportBtn}>
                  <Archive size={16} color={colors.accent} />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'conversations' && styles.tabActive]}
              onPress={() => setActiveTab('conversations')}
            >
              <MessageSquare size={14} color={activeTab === 'conversations' ? colors.accent : colors.textTertiary} />
              <Text style={[styles.tabText, activeTab === 'conversations' && styles.tabTextActive]}>对话</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'files' && styles.tabActive]}
              onPress={() => setActiveTab('files')}
            >
              <FolderOpen size={14} color={activeTab === 'files' ? colors.accent : colors.textTertiary} />
              <Text style={[styles.tabText, activeTab === 'files' && styles.tabTextActive]}>文件</Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'conversations' ? (
            <>
              <TouchableOpacity style={styles.newBtn} onPress={onNew} activeOpacity={0.7}>
                <Plus size={18} color="#000" />
                <Text style={styles.newBtnText}>新建对话</Text>
              </TouchableOpacity>

              {conversations.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>暂无对话记录</Text>
                </View>
              ) : (
                <FlatList
                  data={conversations}
                  renderItem={renderItem}
                  keyExtractor={keyExtractor}
                  contentContainerStyle={styles.list}
                />
              )}
            </>
          ) : (
            <FileTree homePath={HOME_DIR} onExport={handleExportZip} />
          )}
        </RNAnimated.View>
      </View>

      {/* 导出结果弹窗 */}
      <Modal visible={!!exportResult || !!exportError} transparent animationType="fade" onRequestClose={() => { setExportResult(null); setExportError(null); }}>
        <View style={styles.exportOverlay}>
          <View style={styles.exportModal}>
            <Text style={styles.exportTitle}>{exportError ? '导出失败' : '导出成功'}</Text>
            <Text style={styles.exportPath}>{exportError || exportResult}</Text>
            <TouchableOpacity style={styles.exportCloseBtn} onPress={() => { setExportResult(null); setExportError(null); }}>
              <Text style={styles.exportCloseText}>确定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.surfaceElevated,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  closeBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.sm,
    padding: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm - 2,
  },
  tabActive: {
    backgroundColor: colors.surfaceElevated,
  },
  tabText: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  newBtnText: {
    color: '#000',
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
    gap: spacing.sm,
  },
  itemActive: {
    backgroundColor: 'rgba(48,209,88,0.08)',
  },
  itemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    color: colors.text,
    fontSize: fontSizes.sm,
  },
  itemTitleActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  itemTime: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
  },
  exportBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  exportModal: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  exportTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  exportPath: {
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
    textAlign: 'center',
    marginBottom: spacing.lg,
    fontFamily: 'monospace',
  },
  exportCloseBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  exportCloseText: {
    color: '#FFF',
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});

import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated as RNAnimated, Platform } from 'react-native';
import { X, Archive, FolderOpen, FolderPlus } from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { createDocument, copyFile } from 'react-native-saf-x';
import { ConversationMeta, conversationStore } from '../services/conversation';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import FileTree from './FileTree';
import { ConversationList } from './sidebar/ConversationList';
import { SidebarTabs } from './sidebar/SidebarTabs';
import { ExportModal } from './sidebar/ExportModal';
import { LineCodePluginContributionItem } from '../services/LineCodePluginService';
import { workspaceFs } from '../services/WorkspaceFileSystem';

const SIDEBAR_WIDTH = 300;

type TabType = 'conversations' | 'files';

interface Props {
  visible: boolean;
  currentId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  homePath: string;
  projectLabel: string;
  onOpenProject: () => void;
  onCreateProject: () => void;
  pluginItems?: LineCodePluginContributionItem[];
  onPluginItemPress?: (item: LineCodePluginContributionItem) => void;
}

function SidebarInner({
  visible,
  currentId,
  onClose,
  onSelect,
  onNew,
  homePath,
  projectLabel,
  onOpenProject,
  onCreateProject,
  pluginItems = [],
  onPluginItemPress,
}: Props) {
  const { colors } = useTheme();
  const displayHomePath = workspaceFs.toDisplayPath(homePath);
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const slideAnim = useRef(new RNAnimated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = useRef(new RNAnimated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      conversationStore.getConversationMetas().then(setConversations);
      RNAnimated.parallel([
        RNAnimated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 30,
          stiffness: 350,
          mass: 0.8,
        }),
        RNAnimated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      RNAnimated.parallel([
        RNAnimated.timing(slideAnim, {
          toValue: -SIDEBAR_WIDTH,
          duration: 180,
          useNativeDriver: true,
        }),
        RNAnimated.timing(backdropAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
      });
    }
  }, [backdropAnim, slideAnim, visible]);

  const handleDelete = useCallback(async (id: string) => {
    await conversationStore.deleteConversation(id);
    setConversations(prev => prev.filter(c => c.id !== id));
  }, []);

  const handleExportZip = useCallback(async () => {
    try {
      const zipPath = `${RNFS.DocumentDirectoryPath}/linecode_home_export.zip`;
      const { zip } = require('react-native-zip-archive');
      await zip(homePath, zipPath);

      if (Platform.OS === 'android') {
        const fileName = `linecode_home_export_${Date.now()}.zip`;
        const destDoc = await createDocument('', {
          initialName: fileName,
          mimeType: 'application/zip',
        });
        if (!destDoc) {
          setExportError('用户取消选择保存位置');
          setExportResult(null);
          return;
        }
        await copyFile(`file://${zipPath}`, destDoc.uri, { replaceIfDestinationExists: true });
        setExportResult(`已保存到: ${destDoc.name}`);
      } else {
        setExportResult(zipPath);
      }
      setExportError(null);
    } catch (err: any) {
      setExportError(err.message);
      setExportResult(null);
    }
  }, [homePath]);

  const closeExportModal = useCallback(() => {
    setExportResult(null);
    setExportError(null);
  }, []);

  if (!mounted) return null;

  return (
    <View style={styles.overlay} pointerEvents={visible ? 'auto' : 'none'}>
      <RNAnimated.View style={[styles.backdrop, { opacity: backdropAnim, backgroundColor: colors.overlay }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </RNAnimated.View>
      <RNAnimated.View style={[styles.sidebar, { backgroundColor: colors.surfaceElevated }, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {activeTab === 'conversations' ? '对话历史' : '文件管理器'}
          </Text>
          <View style={styles.headerActions}>
            {activeTab === 'files' && (
              <>
                <TouchableOpacity onPress={onOpenProject} style={styles.exportBtn}>
                  <FolderOpen size={16} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={onCreateProject} style={styles.exportBtn}>
                  <FolderPlus size={16} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleExportZip} style={styles.exportBtn}>
                  <Archive size={16} color={colors.accent} />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>

        <SidebarTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {pluginItems.length > 0 && (
          <View style={[styles.pluginSection, { borderColor: colors.borderLight }]}> 
            {pluginItems.map(item => (
              <TouchableOpacity
                key={`${item.pluginId}:${item.itemId}`}
                style={styles.pluginItem}
                activeOpacity={0.75}
                onPress={() => onPluginItemPress?.(item)}
              >
                <Text style={[styles.pluginItemText, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'files' && (
          <View style={[styles.projectStrip, { borderColor: colors.borderLight, backgroundColor: colors.surfaceLight }]}>
            <Text style={[styles.projectStripLabel, { color: colors.text }]} numberOfLines={1}>
              {projectLabel}
            </Text>
            <Text style={[styles.projectStripPath, { color: colors.textTertiary }]} numberOfLines={1} ellipsizeMode="middle">
              {displayHomePath}
            </Text>
          </View>
        )}

        {activeTab === 'conversations' ? (
          <ConversationList
            conversations={conversations}
            currentId={currentId}
            onSelect={onSelect}
            onDelete={handleDelete}
            onNew={onNew}
          />
        ) : (
          <FileTree homePath={homePath} onExport={handleExportZip} />
        )}
      </RNAnimated.View>

      <ExportModal
        visible={!!exportResult || !!exportError}
        result={exportResult}
        error={exportError}
        onClose={closeExportModal}
      />
    </View>
  );
}

const SidebarMemo = memo(SidebarInner);

export default function Sidebar(props: Props) {
  return (
    <Modal visible={props.visible} transparent animationType="none" onRequestClose={props.onClose}>
      <SidebarMemo {...props} />
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
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
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
  exportBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pluginSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  pluginItem: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pluginItemText: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  projectStrip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  projectStripLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  projectStripPath: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});

import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated as RNAnimated, Platform } from 'react-native';
import { X, Archive } from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { createDocument, copyFile } from 'react-native-saf-x';
import { Conversation, conversationStore } from '../services/conversation';
import { colors, spacing, fontSizes } from '../constants/theme';
import FileTree from './FileTree';
import { ConversationList } from './sidebar/ConversationList';
import { SidebarTabs } from './sidebar/SidebarTabs';
import { ExportModal } from './sidebar/ExportModal';

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

export default function Sidebar({ visible, currentId, onClose, onSelect, onNew }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('conversations');
  const slideAnim = React.useRef(new RNAnimated.Value(-SIDEBAR_WIDTH)).current;
  const backdropAnim = React.useRef(new RNAnimated.Value(0)).current;

  const [exportResult, setExportResult] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

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

  const handleExportZip = useCallback(async () => {
    try {
      const zipPath = `${RNFS.DocumentDirectoryPath}/linecode_home_export.zip`;
      const { zip } = require('react-native-zip-archive');
      await zip(HOME_DIR, zipPath);

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
  }, []);

  const closeExportModal = useCallback(() => {
    setExportResult(null);
    setExportError(null);
  }, []);

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

          <SidebarTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {activeTab === 'conversations' ? (
            <ConversationList
              conversations={conversations}
              currentId={currentId}
              onSelect={onSelect}
              onDelete={handleDelete}
              onNew={onNew}
            />
          ) : (
            <FileTree homePath={HOME_DIR} onExport={handleExportZip} />
          )}
        </RNAnimated.View>
      </View>

      <ExportModal
        visible={!!exportResult || !!exportError}
        result={exportResult}
        error={exportError}
        onClose={closeExportModal}
      />
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
  exportBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

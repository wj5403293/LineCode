import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Trash2, Edit3, FilePlus, FolderPlus, Archive } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import { useFileTree } from '../hooks/useFileTree';
import FileTreeItem from './FileTreeItem';

interface Props {
  homePath: string;
  onFileSelect?: (path: string) => void;
  onExport?: () => void;
}

type ModalType = 'create_file' | 'create_folder' | 'rename' | 'delete' | 'context_menu' | 'root_menu' | null;

export default React.memo(function FileTree({ homePath, onFileSelect, onExport }: Props) {
  const { colors } = useTheme();
  const { tree, loadTree, expandNode, createItem, deleteItem, renameItem } = useFileTree(homePath);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalTarget, setModalTarget] = useState('');
  const [modalTargetName, setModalTargetName] = useState('');
  const [modalTargetIsDir, setModalTargetIsDir] = useState(false);
  const [modalValue, setModalValue] = useState('');
  const [modalParent, setModalParent] = useState('');

  useEffect(() => {
    loadTree();
  }, [loadTree]);

  const handleSelect = useCallback((path: string) => {
    onFileSelect?.(path);
  }, [onFileSelect]);

  const handleContextMenu = useCallback((path: string, name: string, isDir: boolean) => {
    setModalType('context_menu');
    setModalTarget(path);
    setModalTargetName(name);
    setModalTargetIsDir(isDir);
  }, []);

  const handleRootAction = useCallback(() => {
    setModalType('root_menu');
  }, []);

  const openRename = useCallback(() => {
    setModalType('rename');
    setModalValue(modalTargetName);
  }, [modalTargetName]);

  const openDelete = useCallback(() => {
    setModalType('delete');
  }, []);

  const openCreate = useCallback((type: 'file' | 'folder') => {
    setModalType(type === 'file' ? 'create_file' : 'create_folder');
    setModalParent(modalTargetIsDir ? modalTarget : homePath);
    setModalValue('');
  }, [modalTarget, modalTargetIsDir, homePath]);

  const handleModalConfirm = useCallback(async () => {
    try {
      if (modalType === 'delete') {
        await deleteItem(modalTarget);
      } else if (modalType === 'rename') {
        if (modalValue) await renameItem(modalTarget, modalValue);
      } else if (modalType === 'create_file') {
        if (modalValue) await createItem(modalParent, modalValue, false);
      } else if (modalType === 'create_folder') {
        if (modalValue) await createItem(modalParent, modalValue, true);
      }
    } catch (err: any) {}
    setModalType(null);
    setModalValue('');
  }, [modalType, modalTarget, modalValue, modalParent, deleteItem, renameItem, createItem]);

  if (!tree) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textTertiary }]}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FileTreeItem
        node={tree}
        depth={0}
        isRoot
        onExpand={expandNode}
        onSelect={handleSelect}
        onDelete={(path) => { setModalTarget(path); setModalTargetName(path.split('/').pop() || ''); setModalType('delete'); }}
        onRename={(path, name) => { setModalTarget(path); setModalTargetName(name); setModalType('rename'); setModalValue(name); }}
        onCreate={(parentPath, type) => { setModalTarget(parentPath); setModalType(type === 'file' ? 'create_file' : 'create_folder'); setModalParent(parentPath); setModalValue(''); }}
        onRootAction={handleRootAction}
        onContextMenu={handleContextMenu}
      />

      <Modal visible={modalType === 'context_menu'} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <TouchableOpacity style={[styles.menuOverlay, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={() => setModalType(null)}>
          <View style={[styles.menuContent, { backgroundColor: colors.surfaceElevated }]}>
            {modalTargetIsDir && (
              <>
                <MenuItem icon={<FilePlus size={16} color={colors.text} />} label="新建文件" onPress={() => openCreate('file')} />
                <MenuItem icon={<FolderPlus size={16} color={colors.text} />} label="新建文件夹" onPress={() => openCreate('folder')} />
              </>
            )}
            <MenuItem icon={<Edit3 size={16} color={colors.text} />} label="重命名" onPress={openRename} />
            <MenuItem icon={<Trash2 size={16} color={colors.danger} />} label="删除" labelStyle={{ color: colors.danger }} onPress={openDelete} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modalType === 'root_menu'} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <TouchableOpacity style={[styles.menuOverlay, { backgroundColor: colors.overlay }]} activeOpacity={1} onPress={() => setModalType(null)}>
          <View style={[styles.menuContent, { backgroundColor: colors.surfaceElevated }]}>
            <MenuItem icon={<FilePlus size={16} color={colors.text} />} label="新建文件" onPress={() => { setModalTarget(homePath); openCreate('file'); }} />
            <MenuItem icon={<FolderPlus size={16} color={colors.text} />} label="新建文件夹" onPress={() => { setModalTarget(homePath); openCreate('folder'); }} />
            <MenuItem icon={<Archive size={16} color={colors.accent} />} label="导出 ZIP" onPress={() => { setModalType(null); onExport?.(); }} />
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modalType === 'create_file' || modalType === 'create_folder' || modalType === 'rename'} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {modalType === 'rename' ? '重命名' : modalType === 'create_file' ? '新建文件' : '新建文件夹'}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceLight, color: colors.text, borderColor: colors.borderLight }]}
              value={modalValue}
              onChangeText={setModalValue}
              placeholder={modalType === 'rename' ? '输入新名称' : '输入名称'}
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: colors.accent }]} onPress={handleModalConfirm}>
                <Text style={[styles.modalConfirmText, { color: colors.textOnColor }]}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalType === 'delete'} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>确认删除</Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>确定要删除 "{modalTargetName}" 吗？此操作不可撤销。</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: colors.danger }]} onPress={handleModalConfirm}>
                <Text style={[styles.modalConfirmText, { color: colors.textOnColor }]}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

function MenuItem({ icon, label, labelStyle, onPress }: { icon: React.ReactNode; label: string; labelStyle?: any; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={[styles.menuLabel, { color: colors.text }, labelStyle]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSizes.sm,
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  menuContent: {
    borderRadius: radius.md,
    padding: spacing.sm,
    width: 200,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  menuLabel: {
    fontSize: fontSizes.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  modalDesc: {
    fontSize: fontSizes.md,
    marginBottom: spacing.lg,
  },
  modalInput: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSizes.md,
    borderWidth: 1,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  modalCancelBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  modalCancelText: {
    fontSize: fontSizes.md,
  },
  modalConfirmBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  modalConfirmText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});

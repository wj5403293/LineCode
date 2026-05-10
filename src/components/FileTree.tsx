import React, { useEffect, useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { Trash2, Edit3, FilePlus, FolderPlus, Archive } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../constants/theme';
import { useFileTree } from '../hooks/useFileTree';
import FileTreeItem from './FileTreeItem';

interface Props {
  homePath: string;
  onFileSelect?: (path: string) => void;
  onExport?: () => void;
}

type ModalType = 'create_file' | 'create_folder' | 'rename' | 'delete' | 'context_menu' | 'root_menu' | null;

export default React.memo(function FileTree({ homePath, onFileSelect, onExport }: Props) {
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
    } catch (err: any) {
      // 静默处理
    }
    setModalType(null);
    setModalValue('');
  }, [modalType, modalTarget, modalValue, modalParent, deleteItem, renameItem, createItem]);

  if (!tree) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>加载中...</Text>
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

      {/* 右键菜单 */}
      <Modal visible={modalType === 'context_menu'} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setModalType(null)}>
          <View style={styles.menuContent}>
            {modalTargetIsDir && (
              <>
                <MenuItem icon={<FilePlus size={16} color={colors.text} />} label="新建文件" onPress={() => openCreate('file')} />
                <MenuItem icon={<FolderPlus size={16} color={colors.text} />} label="新建文件夹" onPress={() => openCreate('folder')} />
              </>
            )}
            <MenuItem icon={<Edit3 size={16} color={colors.text} />} label="重命名" onPress={openRename} />
            <MenuItem icon={<Trash2 size={16} color="#F85149" />} label="删除" labelStyle={{ color: '#F85149' }} onPress={openDelete} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 根目录菜单 */}
      <Modal visible={modalType === 'root_menu'} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setModalType(null)}>
          <View style={styles.menuContent}>
            <MenuItem icon={<FilePlus size={16} color={colors.text} />} label="新建文件" onPress={() => { setModalTarget(homePath); openCreate('file'); }} />
            <MenuItem icon={<FolderPlus size={16} color={colors.text} />} label="新建文件夹" onPress={() => { setModalTarget(homePath); openCreate('folder'); }} />
            <MenuItem icon={<Archive size={16} color={colors.accent} />} label="导出 ZIP" onPress={() => { setModalType(null); onExport?.(); }} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 输入弹窗 */}
      <Modal visible={modalType === 'create_file' || modalType === 'create_folder' || modalType === 'rename'} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalType === 'rename' ? '重命名' : modalType === 'create_file' ? '新建文件' : '新建文件夹'}
            </Text>
            <TextInput
              style={styles.modalInput}
              value={modalValue}
              onChangeText={setModalValue}
              placeholder={modalType === 'rename' ? '输入新名称' : '输入名称'}
              placeholderTextColor={colors.textTertiary}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleModalConfirm}>
                <Text style={styles.modalConfirmText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 删除确认 */}
      <Modal visible={modalType === 'delete'} transparent animationType="fade" onRequestClose={() => setModalType(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>确认删除</Text>
            <Text style={styles.modalDesc}>确定要删除 "{modalTargetName}" 吗？此操作不可撤销。</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalType(null)}>
                <Text style={styles.modalCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#FF453A' }]} onPress={handleModalConfirm}>
                <Text style={styles.modalConfirmText}>删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
});

function MenuItem({ icon, label, labelStyle, onPress }: { icon: React.ReactNode; label: string; labelStyle?: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      {icon}
      <Text style={[styles.menuLabel, labelStyle]}>{label}</Text>
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
    color: colors.textTertiary,
    fontSize: fontSizes.sm,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  menuContent: {
    backgroundColor: colors.surfaceElevated,
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
    color: colors.text,
    fontSize: fontSizes.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.lg,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 300,
  },
  modalTitle: {
    color: colors.text,
    fontSize: fontSizes.lg,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  modalDesc: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    marginBottom: spacing.lg,
  },
  modalInput: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: fontSizes.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
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
    color: colors.textSecondary,
    fontSize: fontSizes.md,
  },
  modalConfirmBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.accent,
  },
  modalConfirmText: {
    color: '#FFF',
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});

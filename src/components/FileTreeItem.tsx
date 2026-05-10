import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Folder, FolderOpen, FileText, FileCode, FileJson, File,
  Image, Settings as SettingsIcon, Plus,
} from 'lucide-react-native';
import { colors, spacing, fontSizes } from '../constants/theme';
import { FileTreeNode } from '../hooks/useFileTree';

interface Props {
  node: FileTreeNode;
  depth: number;
  isRoot?: boolean;
  onExpand: (path: string) => void;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
  onRename: (path: string, oldName: string) => void;
  onCreate: (parentPath: string, type: 'file' | 'folder') => void;
  onRootAction?: () => void;
  onContextMenu?: (path: string, name: string, isDir: boolean) => void;
}

function getFileIcon(name: string, isDir: boolean, expanded?: boolean) {
  if (isDir) {
    return expanded
      ? <FolderOpen size={16} color={colors.accent} />
      : <Folder size={16} color={colors.textSecondary} />;
  }

  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  switch (ext) {
    case 'js': case 'jsx': case 'ts': case 'tsx':
      return <FileCode size={14} color='#F0DB4F' />;
    case 'json':
      return <FileJson size={14} color='#F0DB4F' />;
    case 'html': case 'htm':
      return <FileCode size={14} color='#E34C26' />;
    case 'css': case 'scss':
      return <FileCode size={14} color='#264DE4' />;
    case 'png': case 'jpg': case 'jpeg': case 'svg': case 'gif':
      return <Image size={14} color='#A855F7' />;
    case 'md':
      return <FileText size={14} color={colors.textSecondary} />;
    default:
      return <File size={14} color={colors.textTertiary} />;
  }
}

export default React.memo(function FileTreeItem({ node, depth, isRoot, onExpand, onSelect, onDelete, onRename, onCreate, onRootAction, onContextMenu }: Props) {
  const handlePress = () => {
    if (node.isDirectory) {
      onExpand(node.path);
    } else {
      onSelect(node.path);
    }
  };

  const handleLongPress = () => {
    if (isRoot) {
      onRootAction?.();
      return;
    }
    onContextMenu?.(node.path, node.name, node.isDirectory);
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.item, { paddingLeft: spacing.sm + depth * 16 }]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
      >
        {getFileIcon(node.name, node.isDirectory, node.expanded)}
        <Text style={styles.name} numberOfLines={1}>{node.name}</Text>
        {isRoot && (
          <TouchableOpacity onPress={() => onRootAction?.()} style={styles.addBtn}>
            <Plus size={14} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {node.isDirectory && node.expanded && node.children?.map(child => (
        <FileTreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          onExpand={onExpand}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
          onCreate={onCreate}
          onRootAction={onRootAction}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 4,
    paddingRight: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: fontSizes.sm,
    flex: 1,
  },
  addBtn: {
    padding: 4,
  },
});

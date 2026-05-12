import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Folder, FolderOpen, FileText, FileCode, FileJson, File,
  Image, Settings as SettingsIcon, Plus,
} from 'lucide-react-native';
import { spacing, fontSizes } from '../constants/theme';
import { useTheme } from '../theme';
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

const FILE_ICON_COLORS: Record<string, string> = {
  js: '#F0DB4F', jsx: '#F0DB4F', ts: '#F0DB4F', tsx: '#F0DB4F',
  json: '#F0DB4F',
  html: '#E34C26', htm: '#E34C26',
  css: '#264DE4', scss: '#264DE4',
  png: '#A855F7', jpg: '#A855F7', jpeg: '#A855F7', svg: '#A855F7', gif: '#A855F7',
};

function getFileIcon(name: string, isDir: boolean, expanded: boolean | undefined, accentColor: string, textSecondary: string, textTertiary: string) {
  if (isDir) {
    return expanded
      ? <FolderOpen size={16} color={accentColor} />
      : <Folder size={16} color={textSecondary} />;
  }

  const ext = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  if (ext && FILE_ICON_COLORS[ext]) {
    return <FileCode size={14} color={FILE_ICON_COLORS[ext]} />;
  }
  if (ext === 'md') {
    return <FileText size={14} color={textSecondary} />;
  }
  return <File size={14} color={textTertiary} />;
}

export default React.memo(function FileTreeItem({ node, depth, isRoot, onExpand, onSelect, onDelete, onRename, onCreate, onRootAction, onContextMenu }: Props) {
  const { colors } = useTheme();

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
        {getFileIcon(node.name, node.isDirectory, node.expanded, colors.accent, colors.textSecondary, colors.textTertiary)}
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{node.name}</Text>
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
    fontSize: fontSizes.sm,
    flex: 1,
  },
  addBtn: {
    padding: 4,
  },
});

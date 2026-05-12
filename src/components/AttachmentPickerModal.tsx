import React, { useMemo } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, ChevronDown, ChevronRight, File, Folder, Plus, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import { FileTreeNode } from '../hooks/useFileTree';

interface PickerAction {
  label: string;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title: string;
  tree: FileTreeNode | null;
  selectedPaths: string[];
  loading?: boolean;
  message?: string;
  action?: PickerAction;
  onClose: () => void;
  onExpand: (path: string) => void;
  onToggleFile: (node: FileTreeNode) => void;
}

export default React.memo(function AttachmentPickerModal({
  visible,
  title,
  tree,
  selectedPaths,
  loading,
  message,
  action,
  onClose,
  onExpand,
  onToggleFile,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const selectedSet = useMemo(() => new Set(selectedPaths), [selectedPaths]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surfaceElevated, paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
                已选择 {selectedPaths.length} 个文件
              </Text>
            </View>
            <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.surfaceLight }]} onPress={onClose} activeOpacity={0.7}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

          {loading ? (
            <View style={styles.status}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>{message || '加载中...'}</Text>
            </View>
          ) : !tree ? (
            <View style={styles.status}>
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>{message || '没有可选择的文件'}</Text>
              {action && (
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={action.onPress} activeOpacity={0.75}>
                  <Text style={[styles.primaryText, { color: colors.textOnColor }]}>{action.label}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <ScrollView style={styles.tree} contentContainerStyle={styles.treeContent}>
              <TreeNodeRow
                node={tree}
                depth={0}
                selectedSet={selectedSet}
                onExpand={onExpand}
                onToggleFile={onToggleFile}
              />
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
});

function TreeNodeRow({
  node,
  depth,
  selectedSet,
  onExpand,
  onToggleFile,
}: {
  node: FileTreeNode;
  depth: number;
  selectedSet: Set<string>;
  onExpand: (path: string) => void;
  onToggleFile: (node: FileTreeNode) => void;
}) {
  const { colors } = useTheme();
  const selected = selectedSet.has(node.path);
  const isRoot = depth === 0;
  const hasChildren = !!node.children && node.children.length > 0;

  const handlePress = () => {
    if (node.isDirectory) {
      onExpand(node.path);
    } else {
      onToggleFile(node);
    }
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.row, { paddingLeft: spacing.md + depth * 18 }]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {node.isDirectory ? (
          node.expanded ? <ChevronDown size={16} color={colors.textTertiary} /> : <ChevronRight size={16} color={colors.textTertiary} />
        ) : (
          <View style={styles.chevronSpace} />
        )}
        {node.isDirectory ? <Folder size={17} color={colors.accent} /> : <File size={17} color={colors.textSecondary} />}
        <View style={styles.nameWrap}>
          <Text
            style={[styles.name, { color: isRoot ? colors.text : colors.textSecondary }]}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {node.name}
          </Text>
          {isRoot && (
            <Text style={[styles.path, { color: colors.textTertiary }]} numberOfLines={1} ellipsizeMode="middle">
              {node.path}
            </Text>
          )}
        </View>
        {!node.isDirectory && (
          <View style={[styles.pickBadge, { backgroundColor: selected ? colors.accent : colors.surfaceLight }]}>
            {selected ? <Check size={14} color={colors.textOnColor} /> : <Plus size={14} color={colors.textSecondary} />}
          </View>
        )}
      </TouchableOpacity>
      {node.isDirectory && node.expanded && hasChildren && node.children?.map(child => (
        <TreeNodeRow
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedSet={selectedSet}
          onExpand={onExpand}
          onToggleFile={onToggleFile}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  tree: {
    flex: 1,
  },
  treeContent: {
    paddingVertical: spacing.sm,
  },
  row: {
    minHeight: 44,
    paddingRight: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chevronSpace: {
    width: 16,
  },
  nameWrap: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: fontSizes.md,
  },
  path: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  pickBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    minHeight: 220,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  statusText: {
    fontSize: fontSizes.md,
    textAlign: 'center',
    lineHeight: 21,
  },
  primaryBtn: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  primaryText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});

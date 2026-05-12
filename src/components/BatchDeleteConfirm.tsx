import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, ScrollView } from 'react-native';
import { Trash2, AlertTriangle, Check, X } from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import RNFS from 'react-native-fs';
import { ToolCall } from '../types';

interface Props {
  visible: boolean;
  toolCalls: ToolCall[];
  homePath: string;
  onConfirm: (confirmed: boolean) => void;
}

interface PathInfo {
  path: string;
  isDirectory: boolean | null;
  itemCount: number;
}

export default React.memo(function BatchDeleteConfirm({ visible, toolCalls, homePath, onConfirm }: Props) {
  const { colors } = useTheme();
  const [pathInfos, setPathInfos] = useState<PathInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const allPaths: string[] = [];
  for (const tc of toolCalls) {
    try {
      const input = JSON.parse(tc.arguments);
      if (Array.isArray(input.paths)) {
        allPaths.push(...input.paths);
      }
    } catch {}
  }

  useEffect(() => {
    if (visible && homePath && allPaths.length > 0) {
      setLoading(true);
      const checkPaths = async () => {
        const infos: PathInfo[] = [];
        for (const path of allPaths) {
          const fullPath = path.startsWith('/') ? path : `${homePath}/${path}`;
          let isDirectory: boolean | null = null;
          let itemCount = 0;

          try {
            const exists = await RNFS.exists(fullPath);
            if (exists) {
              try {
                const items = await RNFS.readDir(fullPath);
                isDirectory = true;
                itemCount = items.length;
              } catch {
                isDirectory = false;
              }
            }
          } catch {}

          infos.push({ path, isDirectory, itemCount });
        }
        setPathInfos(infos);
        setLoading(false);
      };
      checkPaths();
    }
  }, [visible, homePath]);

  const handleConfirm = useCallback(() => {
    onConfirm(true);
  }, [onConfirm]);

  const handleCancel = useCallback(() => {
    onConfirm(false);
  }, [onConfirm]);

  const fileCount = pathInfos.filter(p => p.isDirectory === false).length;
  const dirCount = pathInfos.filter(p => p.isDirectory === true).length;
  const totalItems = pathInfos.reduce((sum, p) => sum + (p.isDirectory ? p.itemCount + 1 : 1), 0);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.dangerMuted2 }]}>
          <View style={[styles.header, { backgroundColor: colors.dangerMuted }]}>
            <View style={styles.deleteBadge}>
              <Trash2 size={16} color={colors.danger} />
              <Text style={[styles.deleteText, { color: colors.danger }]}>批量删除确认</Text>
            </View>
            <Text style={[styles.countText, { color: colors.textSecondary }]}>
              {allPaths.length} 个项目
            </Text>
          </View>

          <View style={styles.warningSection}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={20} color={colors.danger} />
              <Text style={[styles.warningTitle, { color: colors.danger }]}>永久删除警告</Text>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.danger} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>正在检查文件...</Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.pathList} nestedScrollEnabled>
                  {pathInfos.map((info, i) => (
                    <Text key={i} style={[styles.pathItem, { color: colors.text }]} numberOfLines={1}>
                      {info.isDirectory === true ? '📁 ' : info.isDirectory === false ? '📄 ' : '❓ '}
                      {info.path}
                      {info.isDirectory && info.itemCount > 0 && ` (${info.itemCount} 项)`}
                    </Text>
                  ))}
                </ScrollView>

                <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                  即将删除: {fileCount > 0 && `${fileCount} 个文件`}
                  {fileCount > 0 && dirCount > 0 && ', '}
                  {dirCount > 0 && `${dirCount} 个目录`}
                  {totalItems > allPaths.length && ` (共 ${totalItems} 项)`}
                </Text>

                <Text style={[styles.warningPermanent, { color: colors.danger }]}>
                  此操作不可撤销，将永久删除！
                </Text>
              </>
            )}

            <View style={styles.confirmActions}>
              <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: colors.codeBorder }]} onPress={handleCancel} activeOpacity={0.7}>
                <X size={16} color={colors.textSecondary} />
                <Text style={[styles.cancelText, { color: colors.textSecondary }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmDeleteBtn, { backgroundColor: colors.danger }]} onPress={handleConfirm} activeOpacity={0.7} disabled={loading}>
                <Trash2 size={16} color={colors.textOnColor} />
                <Text style={[styles.confirmDeleteText, { color: colors.textOnColor }]}>确认删除</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    borderRadius: radius.md,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  deleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  countText: {
    fontSize: fontSizes.sm,
  },
  warningSection: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  warningTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: fontSizes.sm,
  },
  pathList: {
    maxHeight: 200,
    marginBottom: spacing.sm,
  },
  pathItem: {
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    paddingVertical: 2,
  },
  summaryText: {
    fontSize: fontSizes.xs,
    marginBottom: spacing.xs,
  },
  warningPermanent: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  cancelText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  confirmDeleteText: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});

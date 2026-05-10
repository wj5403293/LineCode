import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, ScrollView } from 'react-native';
import { Trash2, AlertTriangle, Check, X } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../constants/theme';
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
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.deleteBadge}>
              <Trash2 size={16} color="#F85149" />
              <Text style={styles.deleteText}>批量删除确认</Text>
            </View>
            <Text style={styles.countText}>
              {allPaths.length} 个项目
            </Text>
          </View>

          <View style={styles.warningSection}>
            <View style={styles.warningHeader}>
              <AlertTriangle size={20} color="#F85149" />
              <Text style={styles.warningTitle}>永久删除警告</Text>
            </View>
            
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#F85149" />
                <Text style={styles.loadingText}>正在检查文件...</Text>
              </View>
            ) : (
              <>
                <ScrollView style={styles.pathList} nestedScrollEnabled>
                  {pathInfos.map((info, i) => (
                    <Text key={i} style={styles.pathItem} numberOfLines={1}>
                      {info.isDirectory === true ? '📁 ' : info.isDirectory === false ? '📄 ' : '❓ '}
                      {info.path}
                      {info.isDirectory && info.itemCount > 0 && ` (${info.itemCount} 项)`}
                    </Text>
                  ))}
                </ScrollView>

                <Text style={styles.summaryText}>
                  即将删除: {fileCount > 0 && `${fileCount} 个文件`}
                  {fileCount > 0 && dirCount > 0 && ', '}
                  {dirCount > 0 && `${dirCount} 个目录`}
                  {totalItems > allPaths.length && ` (共 ${totalItems} 项)`}
                </Text>
                
                <Text style={styles.warningPermanent}>
                  此操作不可撤销，将永久删除！
                </Text>
              </>
            )}

            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.7}>
                <X size={16} color={colors.textSecondary} />
                <Text style={styles.cancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleConfirm} activeOpacity={0.7} disabled={loading}>
                <Trash2 size={16} color="#FFF" />
                <Text style={styles.confirmDeleteText}>确认删除</Text>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(248,81,73,0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    backgroundColor: 'rgba(248,81,73,0.1)',
  },
  deleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteText: {
    color: '#F85149',
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  countText: {
    color: colors.textSecondary,
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
    color: '#F85149',
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
    color: colors.textSecondary,
    fontSize: fontSizes.sm,
  },
  pathList: {
    maxHeight: 200,
    marginBottom: spacing.sm,
  },
  pathItem: {
    color: colors.text,
    fontSize: fontSizes.xs,
    fontFamily: 'monospace',
    paddingVertical: 2,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    marginBottom: spacing.xs,
  },
  warningPermanent: {
    color: '#F85149',
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  cancelText: {
    color: colors.textSecondary,
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  confirmDeleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F85149',
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.sm,
  },
  confirmDeleteText: {
    color: '#FFF',
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
});

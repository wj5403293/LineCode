import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archive, Download, RefreshCw, Upload } from 'lucide-react-native';
import RNFS from 'react-native-fs';
import { copyFile, createDocument, openDocument } from 'react-native-saf-x';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SwitchRow from '../components/SwitchRow';
import UpdatePromptModal from '../components/UpdatePromptModal';
import { spacing, fontSizes, radius } from '../constants/theme';
import { dataArchiveService } from '../services/DataArchiveService';
import { HotUpdateInfo, hotUpdateService } from '../services/HotUpdateService';
import { useTheme } from '../theme';

interface Props {
  onBack: () => void;
}

type BusyAction = 'checking' | 'updating' | 'exporting' | 'importing' | null;

export default function DataSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [updateInfo, setUpdateInfo] = useState<HotUpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    hotUpdateService.isAutoUpdateEnabled().then(setAutoUpdateEnabled).catch(() => {});
  }, []);

  const handleToggleAutoUpdate = useCallback(async (enabled: boolean) => {
    await hotUpdateService.setAutoUpdateEnabled(enabled);
    setAutoUpdateEnabled(enabled);
  }, []);

  const handleCheckUpdate = useCallback(async () => {
    if (busyAction) return;
    setBusyAction('checking');
    setUpdateError(null);
    try {
      const info = await hotUpdateService.checkForUpdate();
      if (info) {
        setUpdateInfo(info);
      } else {
        Alert.alert('已是最新版本', '当前没有可用的热更新。');
      }
    } catch (err: any) {
      Alert.alert('检查失败', err?.message || String(err));
    } finally {
      setBusyAction(null);
    }
  }, [busyAction]);

  const handleInstallUpdate = useCallback(async () => {
    if (!updateInfo || busyAction) return;
    setBusyAction('updating');
    setUpdateError(null);
    try {
      await hotUpdateService.install(updateInfo);
      setUpdateInfo(null);
      Alert.alert('更新完成', '热更新包已安装，重启应用后生效。');
    } catch (err: any) {
      setUpdateError(err?.message || String(err));
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, updateInfo]);

  const handleExport = useCallback(async () => {
    if (busyAction) return;
    setBusyAction('exporting');
    try {
      const archivePath = await dataArchiveService.exportAllData();
      if (Platform.OS === 'android') {
        const doc = await createDocument('', {
          initialName: `linecode_backup_${Date.now()}.linecode`,
          mimeType: 'application/octet-stream',
        });
        if (!doc) {
          Alert.alert('导出取消', '未选择保存位置。');
          return;
        }
        await copyFile(`file://${archivePath}`, doc.uri, { replaceIfDestinationExists: true });
        Alert.alert('导出完成', `已保存到: ${doc.name}`);
      } else {
        Alert.alert('导出完成', archivePath);
      }
    } catch (err: any) {
      Alert.alert('导出失败', err?.message || String(err));
    } finally {
      setBusyAction(null);
    }
  }, [busyAction]);

  const handleImport = useCallback(async () => {
    if (busyAction) return;
    Alert.alert('导入数据', '导入会覆盖当前聊天记录、设置、模型配置和 home 目录。是否继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '导入',
        style: 'destructive',
        onPress: async () => {
          setBusyAction('importing');
          try {
            const docs = await openDocument({ persist: false, multiple: false });
            const doc = docs?.[0];
            if (!doc) {
              Alert.alert('导入取消', '未选择 .linecode 文件。');
              return;
            }
            const localPath = `${RNFS.DocumentDirectoryPath}/linecode_import_${Date.now()}.linecode`;
            await copyFile(doc.uri, `file://${localPath}`, { replaceIfDestinationExists: true });
            await dataArchiveService.importAllData(localPath);
            Alert.alert('导入完成', '数据已恢复，建议重启应用后继续使用。');
          } catch (err: any) {
            Alert.alert('导入失败', err?.message || String(err));
          } finally {
            setBusyAction(null);
          }
        },
      },
    ]);
  }, [busyAction]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="数据与更新" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionHeader title="热更新" />
          <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
            <SwitchRow
              icon={<RefreshCw size={20} color={colors.textSecondary} />}
              label="自动检查更新"
              desc="启动时读取 base.zip 详情"
              value={autoUpdateEnabled}
              onValueChange={handleToggleAutoUpdate}
            />
            <ActionRow
              icon={<Download size={20} color={colors.accent} />}
              label="检查热更新"
              desc="获取版本详情并下载安装包"
              busy={busyAction === 'checking'}
              onPress={handleCheckUpdate}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="全量数据" />
          <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
            <ActionRow
              icon={<Archive size={20} color={colors.accent} />}
              label="导出所有数据"
              desc="导出聊天、设置、配置和 home 目录为 .linecode"
              busy={busyAction === 'exporting'}
              onPress={handleExport}
            />
            <ActionRow
              icon={<Upload size={20} color={colors.accent} />}
              label="导入 .linecode"
              desc="恢复完整聊天记录、配置和 home 文件"
              busy={busyAction === 'importing'}
              onPress={handleImport}
            />
          </View>
        </View>
      </ScrollView>

      <UpdatePromptModal
        visible={!!updateInfo}
        update={updateInfo}
        autoUpdateEnabled={autoUpdateEnabled}
        installing={busyAction === 'updating'}
        error={updateError}
        onToggleAutoUpdate={handleToggleAutoUpdate}
        onUpdate={handleInstallUpdate}
        onCancel={() => {
          if (busyAction !== 'updating') {
            setUpdateInfo(null);
            setUpdateError(null);
          }
        }}
      />
    </View>
  );
}

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  busy: boolean;
  onPress: () => void;
}

function ActionRow({ icon, label, desc, busy, onPress }: ActionRowProps) {
  const { colors } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.actionRow, { borderBottomColor: colors.borderLight }]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={busy}
    >
      <View style={styles.actionContent}>
        {icon}
        <View style={styles.actionText}>
          <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.actionDesc, { color: colors.textTertiary }]}>{desc}</Text>
        </View>
      </View>
      {busy && <ActivityIndicator size="small" color={colors.accent} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  section: { paddingTop: spacing.xl },
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  actionDesc: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
});

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Code2, User, MessageCircle, FileText, ChevronRight, Bug, Download, RefreshCw } from 'lucide-react-native';
import { copyFile, createDocument } from 'react-native-saf-x';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import { APP_VERSION } from '../constants/appInfo';
import { errorReporter } from '../services/ErrorReporter';
import UpdatePromptModal from '../components/UpdatePromptModal';
import { HotUpdateInfo, hotUpdateService } from '../services/HotUpdateService';

interface AboutItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  hiddenPress?: boolean;
}

function AboutItem({ icon, label, value, onPress, hiddenPress }: AboutItemProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: colors.surfaceElevated }]}
      onPress={onPress}
      activeOpacity={onPress && !hiddenPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.accentMuted }]}>{icon}</View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemLabel, { color: colors.text }]}>{label}</Text>
        {value && <Text style={[styles.itemValue, { color: colors.textSecondary }]}>{value}</Text>}
      </View>
      {onPress && !hiddenPress && <ChevronRight size={18} color={colors.textTertiary} />}
    </TouchableOpacity>
  );
}

interface Props {
  onOpenLicenses: () => void;
  onOpenDebug: () => void;
}

const AUTHOR_UNLOCK_TAPS = 5;
const QQ_UNLOCK_TAPS = 4;

export default function AboutScreen({ onOpenLicenses, onOpenDebug }: Props) {
  const { colors } = useTheme();
  const [authorTaps, setAuthorTaps] = useState(0);
  const [qqTaps, setQqTaps] = useState(0);
  const [exportingCrashLog, setExportingCrashLog] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<HotUpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const debugUnlocked = authorTaps === AUTHOR_UNLOCK_TAPS && qqTaps === QQ_UNLOCK_TAPS;

  const handleAuthorPress = useCallback(() => {
    setAuthorTaps(count => (count >= AUTHOR_UNLOCK_TAPS ? 0 : count + 1));
  }, []);

  const handleQqPress = useCallback(() => {
    setQqTaps(count => (count >= QQ_UNLOCK_TAPS ? 0 : count + 1));
  }, []);

  const handleExportCrashLog = useCallback(async () => {
    if (exportingCrashLog) return;
    setExportingCrashLog(true);
    try {
      const log = await errorReporter.exportLastCrashLog();
      if (Platform.OS === 'android') {
        const doc = await createDocument('', {
          initialName: log.fileName,
          mimeType: 'text/plain',
        });
        if (!doc) {
          Alert.alert('导出取消', '未选择保存位置。');
          return;
        }
        await copyFile(`file://${log.path}`, doc.uri, { replaceIfDestinationExists: true });
        Alert.alert('导出完成', `已保存到: ${doc.name || log.fileName}`);
      } else {
        await Share.share({
          title: log.fileName,
          url: `file://${log.path}`,
        });
      }
    } catch (err: any) {
      Alert.alert('导出失败', err?.message || String(err));
    } finally {
      setExportingCrashLog(false);
    }
  }, [exportingCrashLog]);

  const handleCheckUpdate = useCallback(async () => {
    if (checkingUpdate || installingUpdate) return;
    setCheckingUpdate(true);
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
      setCheckingUpdate(false);
    }
  }, [checkingUpdate, installingUpdate]);

  const handleInstallUpdate = useCallback(async () => {
    if (!updateInfo || installingUpdate) return;
    setInstallingUpdate(true);
    setUpdateError(null);
    try {
      await hotUpdateService.install(updateInfo);
      setUpdateInfo(null);
      Alert.alert('更新完成', '热更新包已安装，重启应用后生效。');
    } catch (err: any) {
      setUpdateError(err?.message || String(err));
    } finally {
      setInstallingUpdate(false);
    }
  }, [installingUpdate, updateInfo]);

  return (
    <>
      <ScrollView style={[styles.container, { backgroundColor: colors.surface }]} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconContainer, { backgroundColor: colors.accentMuted }]}>
            <Code2 size={48} color={colors.accent} />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>LineCode</Text>
          <Text style={[styles.version, { color: colors.textSecondary }]}>v{APP_VERSION}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>版本</Text>
          <AboutItem
            icon={checkingUpdate
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <RefreshCw size={20} color={colors.accent} />}
            label="检查更新"
            value={checkingUpdate ? '正在检查...' : '手动检查热更新包'}
            onPress={handleCheckUpdate}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>开发者</Text>
          <AboutItem
            icon={<User size={20} color={colors.accent} />}
            label="作者"
            value="LangLang03"
            onPress={handleAuthorPress}
            hiddenPress
          />
          <AboutItem
            icon={<MessageCircle size={20} color={colors.accent} />}
            label="QQ"
            value="3772548978"
            onPress={handleQqPress}
            hiddenPress
          />
        </View>

        {debugUnlocked && (
          <View style={styles.section}>
            <AboutItem
              icon={<Bug size={20} color={colors.accent} />}
              label="调试模式"
              value="错误处理器测试和最近错误报告"
              onPress={onOpenDebug}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>诊断</Text>
          <AboutItem
            icon={exportingCrashLog
              ? <ActivityIndicator size="small" color={colors.accent} />
              : <Download size={20} color={colors.accent} />}
            label="导出最近一次崩溃日志"
            value={exportingCrashLog ? '正在导出...' : '保存本机最后一份崩溃文本'}
            onPress={handleExportCrashLog}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>法律信息</Text>
          <AboutItem
            icon={<FileText size={20} color={colors.accent} />}
            label="开源许可列表"
            onPress={onOpenLicenses}
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.textTertiary }]}>
            Copyright 2025 LangLang. All rights reserved.
          </Text>
        </View>
      </ScrollView>
      <UpdatePromptModal
        visible={!!updateInfo}
        update={updateInfo}
        installing={installingUpdate}
        error={updateError}
        onUpdate={handleInstallUpdate}
        onCancel={() => {
          if (!installingUpdate) {
            setUpdateInfo(null);
            setUpdateError(null);
          }
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    fontSize: fontSizes.xl,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  version: {
    fontSize: fontSizes.md,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSizes.sm,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  itemContent: {
    flex: 1,
  },
  itemLabel: {
    fontSize: fontSizes.md,
  },
  itemValue: {
    fontSize: fontSizes.sm,
    marginTop: 2,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: fontSizes.xs,
  },
});

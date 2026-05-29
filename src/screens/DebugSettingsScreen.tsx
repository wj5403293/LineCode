import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Bug,
  FileText,
  RefreshCw,
  Terminal,
  Timer,
  Trash2,
  Zap,
} from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import { spacing, fontSizes, radius } from '../constants/theme';
import { ErrorReport, errorReporter } from '../services/ErrorReporter';
import { useTheme } from '../theme';
import { ActionRow } from '../components/ui';

interface Props {
  onBack: () => void;
}

type DebugAction = {
  id: string;
  label: string;
  desc: string;
  destructive?: boolean;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  run: () => void;
};

function ReactRenderCrash({ nonce }: { nonce: number }): React.ReactElement {
  throw new Error(`[Debug] React render error ${nonce}`);
}

export default function DebugSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [reports, setReports] = useState<ErrorReport[]>([]);
  const [renderCrashNonce, setRenderCrashNonce] = useState<number | null>(null);

  const loadReports = useCallback(() => {
    errorReporter.getRecentReports()
      .then(setReports)
      .catch(err => {
        Alert.alert('读取失败', err?.message || String(err));
      });
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const confirmRun = useCallback((action: DebugAction) => {
    Alert.alert(action.label, `${action.desc}\n\n该操作会故意触发异常，用于验证错误处理器。`, [
      { text: '取消', style: 'cancel' },
      {
        text: '触发',
        style: action.destructive ? 'destructive' : 'default',
        onPress: action.run,
      },
    ]);
  }, []);

  const debugActions = useMemo<DebugAction[]>(() => [
    {
      id: 'manual-report',
      label: '直接上报 Error',
      desc: '调用 ErrorReporter.report，验证报告创建、持久化和错误报告页。',
      icon: Bug,
      run: () => {
        errorReporter.report(new Error('[Debug] Manual ErrorReporter.report test'), 'global', { fatal: false });
      },
    },
    {
      id: 'react-render',
      label: 'React 渲染期抛错',
      desc: '组件 render 阶段 throw，验证 AppErrorBoundary 是否接管。',
      destructive: true,
      icon: AlertTriangle,
      run: () => setRenderCrashNonce(Date.now()),
    },
    {
      id: 'event-throw',
      label: '事件回调抛 TypeError',
      desc: '在按钮确认回调里直接 throw，验证全局 JS 异常处理。',
      destructive: true,
      icon: Zap,
      run: () => {
        throw new TypeError('[Debug] Event callback TypeError test');
      },
    },
    {
      id: 'timer-throw',
      label: '异步 setTimeout 抛错',
      desc: '在定时器回调中 throw RangeError，验证异步全局异常处理。',
      destructive: true,
      icon: Timer,
      run: () => {
        setTimeout(() => {
          throw new RangeError('[Debug] setTimeout RangeError test');
        }, 0);
      },
    },
    {
      id: 'promise-rejection',
      label: '未处理 Promise 拒绝',
      desc: '触发 Promise.reject，验证 promise rejection tracker。',
      destructive: true,
      icon: FileText,
      run: () => {
        Promise.reject(new SyntaxError('[Debug] Unhandled Promise rejection test'));
      },
    },
    {
      id: 'global-handler',
      label: '调用 ErrorUtils 全局处理器',
      desc: '直接调用当前全局 handler，验证 fatal 标记和原始 handler 委托链。',
      destructive: true,
      icon: Terminal,
      run: () => {
        const errorUtils = (globalThis as any).ErrorUtils;
        const handler = errorUtils?.getGlobalHandler?.();
        const error = new Error('[Debug] ErrorUtils global handler test');
        if (typeof handler === 'function') {
          handler(error, false);
        } else {
          errorReporter.report(error, 'global', { fatal: false });
        }
      },
    },
    {
      id: 'console-error',
      label: 'console.error 来源',
      desc: '生产环境走 console.error 捕获；开发环境会额外模拟 console 来源报告。',
      icon: Terminal,
      run: () => {
        const error = new Error('[Debug] console.error capture test');
        console.error(error);
        if ((globalThis as any).__DEV__) {
          errorReporter.report(error, 'console', { fatal: false });
        }
      },
    },
  ], []);

  const handleClearReports = useCallback(() => {
    Alert.alert('清空错误记录', '会删除本机保存的最近错误报告。', [
      { text: '取消', style: 'cancel' },
      {
        text: '清空',
        style: 'destructive',
        onPress: () => {
          errorReporter.clearRecentReports()
            .then(() => setReports([]))
            .catch(err => Alert.alert('清空失败', err?.message || String(err)));
        },
      },
    ]);
  }, []);

  if (renderCrashNonce !== null) {
    return <ReactRenderCrash nonce={renderCrashNonce} />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="调试模式" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <SectionHeader title="错误处理器测试" />
          <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
            {debugActions.map(action => (
              <ActionRow
                key={action.id}
                icon={<action.icon size={20} color={action.destructive ? colors.danger : colors.accent} />}
                label={action.label}
                desc={action.desc}
                destructive={action.destructive}
                onPress={() => confirmRun(action)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <SectionHeader title="最近错误记录" />
            <View style={styles.recordActions}>
              <TouchableOpacity style={styles.iconButton} onPress={loadReports} activeOpacity={0.7}>
                <RefreshCw size={18} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} onPress={handleClearReports} activeOpacity={0.7}>
                <Trash2 size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          </View>

          {reports.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>暂无错误记录</Text>
              <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>
                触发测试后，错误报告会保存在这里。
              </Text>
            </View>
          ) : (
            reports.map(report => (
              <View key={report.id} style={[styles.reportCard, { backgroundColor: colors.surfaceElevated }]}>
                <View style={styles.reportHeader}>
                  <Text style={[styles.reportSource, { color: colors.danger }]}>{report.source}</Text>
                  <Text style={[styles.reportTime, { color: colors.textTertiary }]}>
                    {new Date(report.timestamp).toLocaleString()}
                  </Text>
                </View>
                <Text style={[styles.reportName, { color: colors.text }]} numberOfLines={1}>
                  {report.name || 'Error'}
                </Text>
                <Text style={[styles.reportMessage, { color: colors.textSecondary }]} numberOfLines={3}>
                  {report.message}
                </Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingBottom: 100 },
  section: { paddingTop: spacing.xl },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  recordActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  iconButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  emptyState: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
  emptyTitle: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  emptyDesc: {
    fontSize: fontSizes.xs,
    lineHeight: 18,
    marginTop: spacing.xs,
  },
  reportCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  reportSource: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  reportTime: {
    flex: 1,
    fontSize: fontSizes.xs,
    textAlign: 'right',
  },
  reportName: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
  },
  reportMessage: {
    fontSize: fontSizes.xs,
    lineHeight: 17,
    marginTop: 3,
  },
});

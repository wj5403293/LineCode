import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { AlertTriangle, Copy, RotateCcw } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import { ErrorReport, errorReporter } from '../services/ErrorReporter';

interface Props {
  report: ErrorReport;
  onBack: () => void;
}

export default function ErrorReportScreen({ report, onBack }: Props) {
  const { colors } = useTheme();
  const reportText = useMemo(() => errorReporter.format(report), [report]);
  const deviceRows = useMemo(() => Object.entries(report.device), [report.device]);

  const handleCopy = () => {
    Clipboard.setString(reportText);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="错误报告"
        onBack={onBack}
        rightAction={
          <TouchableOpacity style={styles.headerBtn} onPress={handleCopy} activeOpacity={0.75}>
            <Copy size={18} color={colors.text} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: colors.dangerMuted, borderColor: colors.dangerMuted2 }]}>
          <AlertTriangle size={26} color={colors.danger} />
          <View style={styles.heroText}>
            <Text style={[styles.title, { color: colors.text }]}>应用捕获到异常</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              没有直接闪退。可以复制下面的报告用于排查。
            </Text>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>错误</Text>
          <Text style={[styles.errorName, { color: colors.danger }]}>{report.name || 'Error'}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]} selectable>{report.message}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>设备信息</Text>
          {deviceRows.map(([key, value]) => (
            <View key={key} style={styles.infoRow}>
              <Text style={[styles.infoKey, { color: colors.textTertiary }]}>{key}</Text>
              <Text style={[styles.infoValue, { color: colors.textSecondary }]} selectable>{String(value)}</Text>
            </View>
          ))}
        </View>

        {!!report.stack && (
          <View style={[styles.card, { backgroundColor: colors.codeBg, borderColor: colors.codeBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>错误堆栈</Text>
            <Text style={[styles.stack, { color: colors.textSecondary }]} selectable>{report.stack}</Text>
          </View>
        )}

        {!!report.componentStack && (
          <View style={[styles.card, { backgroundColor: colors.codeBg, borderColor: colors.codeBorder }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>组件堆栈</Text>
            <Text style={[styles.stack, { color: colors.textSecondary }]} selectable>{report.componentStack}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accent }]} onPress={onBack} activeOpacity={0.8}>
          <RotateCcw size={18} color={colors.textOnColor} />
          <Text style={[styles.primaryText, { color: colors.textOnColor }]}>返回应用</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  hero: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSizes.sm,
    marginTop: 4,
    lineHeight: 19,
  },
  card: {
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  sectionTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  errorName: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  message: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: 4,
  },
  infoKey: {
    fontSize: fontSizes.xs,
    width: 120,
  },
  infoValue: {
    flex: 1,
    fontSize: fontSizes.xs,
    textAlign: 'right',
  },
  stack: {
    fontSize: fontSizes.xs,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  primaryBtn: {
    height: 44,
    borderRadius: radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryText: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
});

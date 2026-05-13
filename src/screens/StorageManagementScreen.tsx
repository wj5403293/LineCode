import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Database, FileJson, Folder, MessageSquare, RefreshCw, Settings, GitCompare } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import { StorageAnalysis, StorageCategory, storageAnalysisService } from '../services/StorageAnalysisService';
import { formatBytes } from '../utils/formatBytes';

interface Props {
  onBack: () => void;
}

const ICONS: Record<string, typeof Database> = {
  diffs: GitCompare,
  chats: MessageSquare,
  config: Settings,
  home: Folder,
  linecode: FileJson,
};

export default function StorageManagementScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAnalysis(await storageAnalysisService.analyze());
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="存储管理"
        onBack={onBack}
        rightAction={
          <TouchableOpacity style={styles.headerBtn} onPress={load} activeOpacity={0.7}>
            <RefreshCw size={18} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={[styles.summary, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.summaryLabel, { color: colors.textTertiary }]}>已统计使用量</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{formatBytes(analysis?.totalBytes || 0)}</Text>
          {analysis && (
            <Text style={[styles.summaryTime, { color: colors.textTertiary }]}>
              {new Date(analysis.generatedAt).toLocaleString()}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>正在分析存储...</Text>
          </View>
        ) : error ? (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerMuted, borderColor: colors.dangerMuted2 }]}>
            <Text style={[styles.statusText, { color: colors.danger }]}>{error}</Text>
          </View>
        ) : (
          analysis?.categories.map(category => (
            <StorageRow key={category.id} category={category} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function StorageRow({ category }: { category: StorageCategory }) {
  const { colors } = useTheme();
  const Icon = ICONS[category.id] || Database;
  return (
    <View style={[styles.row, { backgroundColor: colors.surfaceElevated }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.accentMuted }]}>
        <Icon size={19} color={colors.accent} />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: colors.text }]}>{category.label}</Text>
        <Text style={[styles.rowDesc, { color: colors.textTertiary }]}>{category.desc}</Text>
      </View>
      <View style={styles.sizeBox}>
        <Text style={[styles.sizeText, { color: colors.text }]}>{formatBytes(category.bytes)}</Text>
        <Text style={[styles.itemText, { color: colors.textTertiary }]}>{category.items} 项</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summary: {
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  summaryValue: {
    fontSize: fontSizes.xxl,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  summaryTime: {
    fontSize: fontSizes.xs,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  rowDesc: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  sizeBox: {
    alignItems: 'flex-end',
  },
  sizeText: {
    fontSize: fontSizes.md,
    fontWeight: '800',
  },
  itemText: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  status: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  statusText: {
    fontSize: fontSizes.sm,
  },
  errorBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
});

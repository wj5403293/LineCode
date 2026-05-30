import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, ToastAndroid, View } from 'react-native';
import { spacing, fontSizes } from '../constants/theme';
import { LineMLRenderer, PluginToastApi } from '../plugins';
import { lineCodePluginService, LineCodePluginPageInstance } from '../services/LineCodePluginService';
import { useTheme } from '../theme';
import { ScreenScaffold } from '../components/ui';

interface Props {
  pluginId: string;
  pageId: string;
  title?: string;
  onBack: () => void;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function showHostToast(message: string): void {
  const text = String(message ?? '');
  if (Platform.OS === 'android') {
    ToastAndroid.show(text, ToastAndroid.SHORT);
    return;
  }
  Alert.alert('插件提示', text);
}

function shouldRetryAfterReload(error: unknown): boolean {
  return toErrorMessage(error).includes('插件未启用或未加载');
}

export default function PluginPageScreen({ pluginId, pageId, title, onBack }: Props) {
  const { colors } = useTheme();
  const [page, setPage] = useState<LineCodePluginPageInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toast = useMemo<PluginToastApi>(() => ({
    show: async message => {
      showHostToast(message);
    },
  }), []);

  const handleRuntimeError = useCallback((runtimeError: unknown) => {
    Alert.alert('插件运行失败', toErrorMessage(runtimeError));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const open = () => lineCodePluginService.openPluginPage(pluginId, pageId, { toast });

    const load = async () => {
      setLoading(true);
      setError(null);
      setPage(null);
      try {
        let nextPage: LineCodePluginPageInstance;
        try {
          nextPage = await open();
        } catch (openError) {
          if (!shouldRetryAfterReload(openError)) {
            throw openError;
          }
          await lineCodePluginService.reloadActivePlugins();
          nextPage = await open();
        }
        if (!cancelled) {
          setPage(nextPage);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(toErrorMessage(loadError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [pageId, pluginId, toast]);

  return (
    <ScreenScaffold title={page?.title || title || '插件页面'} onBack={onBack} scroll={false}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>正在打开插件页面...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>插件页面打开失败</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        </View>
      ) : page ? (
        <View style={styles.renderer}>
          <LineMLRenderer document={page.document} onRuntimeError={handleRuntimeError} />
        </View>
      ) : null}
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  statusText: {
    fontSize: fontSizes.sm,
  },
  errorTitle: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  errorText: {
    fontSize: fontSizes.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  renderer: {
    flex: 1,
  },
});

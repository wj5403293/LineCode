import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './src/theme';
import RootNavigator, { type RootStackParamList } from './src/navigation/RootNavigator';
import FirstLaunchGuideModal from './src/components/FirstLaunchGuideModal';
import FirstLaunchPromoModal from './src/components/FirstLaunchPromoModal';
import AppErrorBoundary from './src/components/AppErrorBoundary';
import ErrorReportScreen from './src/screens/ErrorReportScreen';
import { ErrorReport, errorReporter } from './src/services/ErrorReporter';
import UpdatePromptModal from './src/components/UpdatePromptModal';
import { HotUpdateInfo, hotUpdateService } from './src/services/HotUpdateService';
import { settingsService } from './src/services/settings';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AppContent() {
  const { isDark, colors } = useTheme();
  const [guideComplete, setGuideComplete] = useState(false);
  const [errorReport, setErrorReport] = useState<ErrorReport | null>(null);
  const [pendingUpdate, setPendingUpdate] = useState<HotUpdateInfo | null>(null);
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    errorReporter.install();
    return errorReporter.subscribe(setErrorReport);
  }, []);

  useEffect(() => {
    let mounted = true;
    hotUpdateService.isAutoUpdateEnabled()
      .then(enabled => {
        if (!mounted) return;
        setAutoUpdateEnabled(enabled);
        if (!enabled) return null;
        return hotUpdateService.checkForUpdate();
      })
      .then(info => {
        if (mounted && info) setPendingUpdate(info);
      })
      .catch(err => {
        console.warn('[LineCode] hot update check failed:', err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const reloadAutoUpdate = () => {
      hotUpdateService.isAutoUpdateEnabled()
        .then(enabled => {
          if (mounted) setAutoUpdateEnabled(enabled);
        })
        .catch(() => {});
    };
    const unsubscribe = settingsService.subscribe(reloadAutoUpdate);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleNavigateUrl = useCallback((url: string) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('InAppBrowser', { url });
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }, []);

  const handleToggleAutoUpdate = useCallback(async (enabled: boolean) => {
    await hotUpdateService.setAutoUpdateEnabled(enabled);
    setAutoUpdateEnabled(enabled);
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    if (!pendingUpdate || installingUpdate) return;
    setInstallingUpdate(true);
    setUpdateError(null);
    try {
      await hotUpdateService.install(pendingUpdate);
      setPendingUpdate(null);
      Alert.alert('更新完成', '热更新包已安装，重启应用后生效。');
    } catch (err: any) {
      setUpdateError(err?.message || String(err));
    } finally {
      setInstallingUpdate(false);
    }
  }, [installingUpdate, pendingUpdate]);

  if (errorReport) {
    return (
      <>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={colors.bg}
        />
        <ErrorReportScreen report={errorReport} onBack={() => setErrorReport(null)} />
      </>
    );
  }

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <AppErrorBoundary onError={setErrorReport}>
        <NavigationContainer ref={navigationRef}>
          <RootNavigator />
        </NavigationContainer>
        <FirstLaunchGuideModal onDone={() => setGuideComplete(true)} />
        <FirstLaunchPromoModal navigateToUrl={handleNavigateUrl} enabled={guideComplete} />
        <UpdatePromptModal
          visible={!!pendingUpdate}
          update={pendingUpdate}
          autoUpdateEnabled={autoUpdateEnabled}
          installing={installingUpdate}
          error={updateError}
          onToggleAutoUpdate={handleToggleAutoUpdate}
          onUpdate={handleInstallUpdate}
          onCancel={() => {
            if (!installingUpdate) {
              setPendingUpdate(null);
              setUpdateError(null);
            }
          }}
        />
      </AppErrorBoundary>
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

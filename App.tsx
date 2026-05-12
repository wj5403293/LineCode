import React, { useCallback, useEffect, useState } from 'react';
import { Linking, StatusBar, StyleSheet } from 'react-native';
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

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AppContent() {
  const { isDark, colors } = useTheme();
  const [guideComplete, setGuideComplete] = useState(false);
  const [errorReport, setErrorReport] = useState<ErrorReport | null>(null);

  useEffect(() => {
    errorReporter.install();
    return errorReporter.subscribe(setErrorReport);
  }, []);

  const handleNavigateUrl = useCallback((url: string) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('InAppBrowser', { url });
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }, []);

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

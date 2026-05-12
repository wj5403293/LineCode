import React, { useCallback, useState } from 'react';
import { Linking, StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { ThemeProvider, useTheme } from './src/theme';
import RootNavigator, { type RootStackParamList } from './src/navigation/RootNavigator';
import FirstLaunchGuideModal from './src/components/FirstLaunchGuideModal';
import FirstLaunchPromoModal from './src/components/FirstLaunchPromoModal';

const navigationRef = createNavigationContainerRef<RootStackParamList>();

function AppContent() {
  const { isDark, colors } = useTheme();
  const [guideComplete, setGuideComplete] = useState(false);
  const handleNavigateUrl = useCallback((url: string) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('InAppBrowser', { url });
    } else {
      Linking.openURL(url).catch(() => {});
    }
  }, []);

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <NavigationContainer ref={navigationRef}>
        <RootNavigator />
      </NavigationContainer>
      <FirstLaunchGuideModal onDone={() => setGuideComplete(true)} />
      <FirstLaunchPromoModal navigateToUrl={handleNavigateUrl} enabled={guideComplete} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

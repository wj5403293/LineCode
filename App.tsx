import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar, BackHandler, Alert } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ModelListScreen from './src/screens/ModelListScreen';
import ModelAddScreen from './src/screens/ModelAddScreen';
import OutputSettingsScreen from './src/screens/OutputSettingsScreen';
import LLMSettingsScreen from './src/screens/LLMSettingsScreen';
import { Screen } from './src/types';

export default function App() {
  const [screen, setScreen] = useState<Screen>('chat');
  const [history, setHistory] = useState<Screen[]>(['chat']);

  const navigate = useCallback((newScreen: Screen) => {
    setScreen(newScreen);
    setHistory(prev => [...prev, newScreen]);
  }, []);

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setScreen(newHistory[newHistory.length - 1]);
      return true;
    }
    return false;
  }, [history]);

  const goChat = useCallback(() => {
    setScreen('chat');
    setHistory(['chat']);
  }, []);

  const goSettings = useCallback(() => navigate('settings'), [navigate]);
  const goModelList = useCallback(() => navigate('model-list'), [navigate]);
  const goModelAdd = useCallback(() => navigate('model-add'), [navigate]);
  const goOutputSettings = useCallback(() => navigate('output-settings'), [navigate]);
  const goLLMSettings = useCallback(() => navigate('llm-settings'), [navigate]);

  // Handle Android back button
  useEffect(() => {
    const backAction = () => {
      if (screen !== 'chat') {
        goBack();
        return true;
      }

      // On chat screen, show confirmation
      Alert.alert('退出应用', '确定要退出 LineAI 吗？', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [screen, goBack]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        {screen === 'chat' && <ChatScreen onGoSettings={goSettings} />}
        {screen === 'settings' && (
          <SettingsScreen
            onBack={goBack}
            onModels={goModelList}
            onOutput={goOutputSettings}
            onLLM={goLLMSettings}
          />
        )}
        {screen === 'model-list' && <ModelListScreen onBack={goBack} onAdd={goModelAdd} onSelect={goChat} />}
        {screen === 'model-add' && <ModelAddScreen onBack={goBack} />}
        {screen === 'output-settings' && <OutputSettingsScreen onBack={goBack} />}
        {screen === 'llm-settings' && <LLMSettingsScreen onBack={goBack} />}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

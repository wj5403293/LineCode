import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ModelListScreen from '../screens/ModelListScreen';
import ModelAddScreen from '../screens/ModelAddScreen';
import OutputSettingsScreen from '../screens/OutputSettingsScreen';
import LLMSettingsScreen from '../screens/LLMSettingsScreen';
import MCPSettingsScreen from '../screens/MCPSettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import LicensesScreen from '../screens/LicensesScreen';

export type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
  ModelList: undefined;
  ModelAdd: undefined;
  OutputSettings: undefined;
  LLMSettings: undefined;
  MCPSettings: undefined;
  About: undefined;
  Licenses: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Chat">
        {({ navigation }) => (
          <ChatScreen onGoSettings={() => navigation.navigate('Settings')} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Settings">
        {({ navigation }) => (
          <SettingsScreen
            onBack={() => navigation.goBack()}
            onModels={() => navigation.navigate('ModelList')}
            onOutput={() => navigation.navigate('OutputSettings')}
            onLLM={() => navigation.navigate('LLMSettings')}
            onMCP={() => navigation.navigate('MCPSettings')}
            onAbout={() => navigation.navigate('About')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ModelList">
        {({ navigation }) => (
          <ModelListScreen
            onBack={() => navigation.goBack()}
            onAdd={() => navigation.navigate('ModelAdd')}
            onSelect={() => navigation.navigate('Chat')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ModelAdd">
        {({ navigation }) => (
          <ModelAddScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="OutputSettings">
        {({ navigation }) => (
          <OutputSettingsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="LLMSettings">
        {({ navigation }) => (
          <LLMSettingsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="MCPSettings">
        {({ navigation }) => (
          <MCPSettingsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="About">
        {({ navigation }) => (
          <AboutScreen onOpenLicenses={() => navigation.navigate('Licenses')} />
        )}
      </Stack.Screen>
      <Stack.Screen name="Licenses">
        {({ navigation }) => (
          <LicensesScreen />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

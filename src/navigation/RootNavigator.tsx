import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ModelListScreen from '../screens/ModelListScreen';
import ModelAddScreen from '../screens/ModelAddScreen';
import ModelAddOptionsScreen from '../screens/ModelAddOptionsScreen';
import OutputSettingsScreen from '../screens/OutputSettingsScreen';
import LLMSettingsScreen from '../screens/LLMSettingsScreen';
import MCPSettingsScreen from '../screens/MCPSettingsScreen';
import AboutScreen from '../screens/AboutScreen';
import LicensesScreen from '../screens/LicensesScreen';
import ThemeSettingsScreen from '../screens/ThemeSettingsScreen';
import InAppBrowserScreen from '../screens/InAppBrowserScreen';
import ShellCommandScreen from '../screens/ShellCommandScreen';
import DataSettingsScreen from '../screens/DataSettingsScreen';

export type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
  ModelList: undefined;
  ModelAddOptions: undefined;
  ModelAdd: { presetId?: string } | undefined;
  OutputSettings: undefined;
  LLMSettings: undefined;
  MCPSettings: undefined;
  About: undefined;
  Licenses: undefined;
  ThemeSettings: undefined;
  DataSettings: undefined;
  InAppBrowser: { url: string };
  ShellCommand: { command: string };
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
          <ChatScreen
            onGoSettings={() => navigation.navigate('Settings')}
            onViewShellCommand={(command) => navigation.navigate('ShellCommand', { command })}
          />
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
            onTheme={() => navigation.navigate('ThemeSettings')}
            onData={() => navigation.navigate('DataSettings')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="DataSettings">
        {({ navigation }) => (
          <DataSettingsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="ThemeSettings">
        {({ navigation }) => (
          <ThemeSettingsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="ModelList">
        {({ navigation }) => (
          <ModelListScreen
            onBack={() => navigation.goBack()}
            onAdd={() => navigation.navigate('ModelAddOptions')}
            onSelect={() => navigation.navigate('Chat')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ModelAddOptions">
        {({ navigation }) => (
          <ModelAddOptionsScreen
            onBack={() => navigation.goBack()}
            onCustom={() => navigation.navigate('ModelAdd')}
            onProvider={(presetId) => navigation.navigate('ModelAdd', { presetId })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ModelAdd">
        {({ navigation, route }) => (
          <ModelAddScreen
            presetId={route.params?.presetId}
            onBack={() => navigation.goBack()}
          />
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
        {() => (
          <LicensesScreen />
        )}
      </Stack.Screen>
      <Stack.Screen name="InAppBrowser">
        {({ navigation, route }) => (
          <InAppBrowserScreen
            url={route.params.url}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ShellCommand">
        {({ navigation, route }) => (
          <ShellCommandScreen
            command={route.params.command}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

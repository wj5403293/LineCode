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
import StorageManagementScreen from '../screens/StorageManagementScreen';
import KeepAliveSettingsScreen from '../screens/KeepAliveSettingsScreen';
import DebugSettingsScreen from '../screens/DebugSettingsScreen';
import ExperimentalSettingsScreen from '../screens/ExperimentalSettingsScreen';
import ExtensionsScreen from '../screens/ExtensionsScreen';
import ExtensionDetailScreen from '../screens/ExtensionDetailScreen';
import AgentExtensionEditScreen from '../screens/AgentExtensionEditScreen';
import McpExtensionEditScreen from '../screens/McpExtensionEditScreen';
import type { ExtensionKind } from '../services/ExtensionService';

export type RootStackParamList = {
  Chat: undefined;
  Settings: undefined;
  ModelList: undefined;
  ModelAddOptions: undefined;
  ModelAdd: { presetId?: string; modelId?: string; local?: boolean } | undefined;
  OutputSettings: undefined;
  LLMSettings: undefined;
  MCPSettings: undefined;
  Extensions: undefined;
  ExtensionDetail: { kind: ExtensionKind };
  AgentExtensionEdit: { agentId?: string } | undefined;
  McpExtensionEdit: { mcpId?: string } | undefined;
  About: undefined;
  Licenses: undefined;
  ThemeSettings: undefined;
  DataSettings: undefined;
  StorageManagement: undefined;
  KeepAliveSettings: undefined;
  ExperimentalSettings: undefined;
  DebugSettings: undefined;
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
            onExtensions={() => navigation.navigate('Extensions')}
            onAbout={() => navigation.navigate('About')}
            onTheme={() => navigation.navigate('ThemeSettings')}
            onData={() => navigation.navigate('DataSettings')}
            onStorage={() => navigation.navigate('StorageManagement')}
            onKeepAlive={() => navigation.navigate('KeepAliveSettings')}
            onExperimental={() => navigation.navigate('ExperimentalSettings')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Extensions">
        {({ navigation }) => (
          <ExtensionsScreen
            onBack={() => navigation.goBack()}
            onOpen={(kind) => navigation.navigate('ExtensionDetail', { kind })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ExtensionDetail">
        {({ navigation, route }) => (
          <ExtensionDetailScreen
            kind={route.params.kind}
            onBack={() => navigation.goBack()}
            onAddAgent={() => navigation.navigate('AgentExtensionEdit')}
            onEditAgent={(agentId) => navigation.navigate('AgentExtensionEdit', { agentId })}
            onAddMcp={() => navigation.navigate('McpExtensionEdit')}
            onEditMcp={(mcpId) => navigation.navigate('McpExtensionEdit', { mcpId })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AgentExtensionEdit">
        {({ navigation, route }) => (
          <AgentExtensionEditScreen
            agentId={route.params?.agentId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="McpExtensionEdit">
        {({ navigation, route }) => (
          <McpExtensionEditScreen
            mcpId={route.params?.mcpId}
            onBack={() => navigation.goBack()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ExperimentalSettings">
        {({ navigation }) => (
          <ExperimentalSettingsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="DebugSettings">
        {({ navigation }) => (
          <DebugSettingsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="KeepAliveSettings">
        {({ navigation }) => (
          <KeepAliveSettingsScreen onBack={() => navigation.goBack()} />
        )}
      </Stack.Screen>
      <Stack.Screen name="StorageManagement">
        {({ navigation }) => (
          <StorageManagementScreen onBack={() => navigation.goBack()} />
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
            onEdit={(modelId) => navigation.navigate('ModelAdd', { modelId })}
            onSelect={() => navigation.navigate('Chat')}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ModelAddOptions">
        {({ navigation }) => (
          <ModelAddOptionsScreen
            onBack={() => navigation.goBack()}
            onCustom={() => navigation.navigate('ModelAdd')}
            onLocal={() => navigation.navigate('ModelAdd', { local: true })}
            onProvider={(presetId) => navigation.navigate('ModelAdd', { presetId })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ModelAdd">
        {({ navigation, route }) => (
          <ModelAddScreen
            presetId={route.params?.presetId}
            modelId={route.params?.modelId}
            local={route.params?.local}
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
          <AboutScreen
            onOpenLicenses={() => navigation.navigate('Licenses')}
            onOpenDebug={() => navigation.navigate('DebugSettings')}
          />
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

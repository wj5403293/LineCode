import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Box,
  Monitor,
  Cpu,
  Brain,
  Wrench,
  Palette,
  Archive,
  Database,
  BatteryCharging,
  FlaskConical,
} from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import ScreenHeader from '../components/ScreenHeader';

interface Props {
  onBack: () => void;
  onModels: () => void;
  onOutput: () => void;
  onLLM: () => void;
  onMCP: () => void;
  onAbout: () => void;
  onTheme: () => void;
  onData: () => void;
  onStorage: () => void;
  onKeepAlive: () => void;
  onExperimental: () => void;
}

type SettingsItemId =
  | 'models'
  | 'llm'
  | 'mcp'
  | 'theme'
  | 'output'
  | 'storage'
  | 'keepAlive'
  | 'experimental'
  | 'data'
  | 'about';

type SettingsItem = {
  id: SettingsItemId;
  label: string;
  icon: typeof Box;
};

const SETTINGS_ITEMS: SettingsItem[] = [
  { id: 'models', label: '模型管理', icon: Box },
  { id: 'llm', label: 'AI 行为', icon: Brain },
  { id: 'mcp', label: '工具与执行', icon: Wrench },
  { id: 'theme', label: '主题与外观', icon: Palette },
  { id: 'output', label: '输出与浏览', icon: Monitor },
  { id: 'experimental', label: '实验性渲染', icon: FlaskConical },
  { id: 'storage', label: '存储管理', icon: Database },
  { id: 'data', label: '数据与更新', icon: Archive },
  { id: 'keepAlive', label: '后台保活', icon: BatteryCharging },
  { id: 'about', label: '关于 LineCode', icon: Cpu },
];

const SETTINGS_ROWS = Array.from({ length: Math.ceil(SETTINGS_ITEMS.length / 2) }, (_, index) =>
  SETTINGS_ITEMS.slice(index * 2, index * 2 + 2),
);

export default function SettingsScreen({
  onBack,
  onModels,
  onOutput,
  onLLM,
  onMCP,
  onAbout,
  onTheme,
  onData,
  onStorage,
  onKeepAlive,
  onExperimental,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handlePress = (id: SettingsItemId) => {
    switch (id) {
      case 'models':
        onModels();
        break;
      case 'output':
        onOutput();
        break;
      case 'llm':
        onLLM();
        break;
      case 'mcp':
        onMCP();
        break;
      case 'theme':
        onTheme();
        break;
      case 'data':
        onData();
        break;
      case 'storage':
        onStorage();
        break;
      case 'keepAlive':
        onKeepAlive();
        break;
      case 'experimental':
        onExperimental();
        break;
      case 'about':
        onAbout();
        break;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="设置" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {SETTINGS_ROWS.map(row => (
          <View key={row.map(item => item.id).join(':')} style={styles.row}>
            {row.map(item => {
              const Icon = item.icon;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.borderLight,
                    },
                  ]}
                  onPress={() => handlePress(item.id)}
                  activeOpacity={0.78}
                >
                  <View style={[styles.iconPlate, { backgroundColor: colors.accentMuted }]}>
                    <Icon size={24} color={colors.accent} />
                  </View>
                  <Text
                    style={[styles.cardLabel, { color: colors.text }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                    minimumFontScale={0.86}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {row.length === 1 && <View style={styles.cardSpacer} />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 100,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  cardSpacer: {
    flex: 1,
    aspectRatio: 1,
  },
  iconPlate: {
    width: 42,
    height: 42,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardLabel: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    maxWidth: '78%',
    textAlign: 'right',
    fontSize: fontSizes.lg,
    fontWeight: '700',
    lineHeight: 22,
  },
});

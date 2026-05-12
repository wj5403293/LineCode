import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Box, Monitor, Cpu, Brain, Wrench, Palette } from 'lucide-react-native';
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
}

const SETTINGS_ITEMS = [
  { id: 'models', label: '模型管理', desc: '添加、删除和切换模型', icon: Box },
  { id: 'llm', label: 'LLM 设置', desc: '显示模式和交流语气', icon: Brain },
  { id: 'mcp', label: 'MCP 工具', desc: '文件操作和 HTTP 服务器', icon: Wrench },
  { id: 'theme', label: '主题设置', desc: '亮色/暗色/跟随系统', icon: Palette },
  { id: 'output', label: '输出设置', desc: '代码显示和格式化选项', icon: Monitor },
  { id: 'about', label: '关于', desc: '版本信息和开源许可', icon: Cpu },
];

export default function SettingsScreen({ onBack, onModels, onOutput, onLLM, onMCP, onAbout, onTheme }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handlePress = (id: string) => {
    if (id === 'models') onModels();
    if (id === 'output') onOutput();
    if (id === 'llm') onLLM();
    if (id === 'mcp') onMCP();
    if (id === 'theme') onTheme();
    if (id === 'about') onAbout();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="设置" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {SETTINGS_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.item, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => handlePress(item.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.itemIcon, { backgroundColor: colors.accentMuted }]}>
                <Icon size={20} color={colors.accent} />
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemLabel, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.itemDesc, { color: colors.textTertiary }]}>{item.desc}</Text>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingTop: spacing.lg, paddingBottom: 100 },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    borderRadius: radius.md, gap: spacing.md,
  },
  itemIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemLabel: { fontSize: fontSizes.md, fontWeight: '600' },
  itemDesc: { fontSize: fontSizes.xs, marginTop: 2 },
});

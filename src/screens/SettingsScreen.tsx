import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ChevronRight,
  Box,
  Monitor,
  Cpu,
  Brain,
  Package,
  Palette,
  Archive,
  Database,
  BatteryCharging,
  FlaskConical,
  BookOpen,
} from 'lucide-react-native';
import { spacing, fontSizes, radius } from '../constants/theme';
import { useTheme } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import McpIcon from '../components/icons/McpIcon';

interface Props {
  onBack: () => void;
  onModels: () => void;
  onOutput: () => void;
  onLLM: () => void;
  onMCP: () => void;
  onExtensions: () => void;
  onAbout: () => void;
  onTheme: () => void;
  onData: () => void;
  onStorage: () => void;
  onMemory: () => void;
  onKeepAlive: () => void;
  onExperimental: () => void;
}

type SettingsItemId =
  | 'models'
  | 'llm'
  | 'mcp'
  | 'extensions'
  | 'theme'
  | 'output'
  | 'storage'
  | 'memory'
  | 'keepAlive'
  | 'experimental'
  | 'data'
  | 'about';

type SettingsItem = {
  id: SettingsItemId;
  label: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
};

type SettingsSection = {
  title: string;
  items: SettingsItem[];
};

const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: 'AI 与模型',
    items: [
      { id: 'models', label: '模型管理', desc: '供应商、密钥、模型 ID 和默认模型', icon: Box },
      { id: 'llm', label: 'AI 行为', desc: '思考强度、交流语气和 reasoning 保留', icon: Brain },
    ],
  },
  {
    title: '工具与执行',
    items: [
      { id: 'mcp', label: '工具与执行', desc: 'MCP 工具开关、SSH 执行和网页搜索', icon: McpIcon },
      { id: 'extensions', label: '扩展', desc: 'Agent、MCP、Skills 和 LineCode 扩展', icon: Package },
    ],
  },
  {
    title: '界面与输出',
    items: [
      { id: 'theme', label: '主题与外观', desc: '主题模式、自定义颜色和高对比外观', icon: Palette },
      { id: 'output', label: '输出与浏览', desc: '回复布局、代码换行和网页打开方式', icon: Monitor },
      { id: 'experimental', label: '实验性渲染', desc: '仍在验证的消息渲染能力', icon: FlaskConical },
    ],
  },
  {
    title: '数据与系统',
    items: [
      { id: 'storage', label: '存储管理', desc: '聊天、配置、diff 和工作区占用', icon: Database },
      { id: 'memory', label: '记忆', desc: '查看和添加长期记忆、项目记忆、短期记忆', icon: BookOpen },
      { id: 'data', label: '数据与更新', desc: '热更新、完整导出和 .linecode 导入', icon: Archive },
      { id: 'keepAlive', label: '后台保活', desc: 'Wake Lock、前台服务和电池白名单', icon: BatteryCharging },
    ],
  },
  {
    title: '信息',
    items: [
      { id: 'about', label: '关于 LineCode', desc: '版本、诊断、开源许可和调试入口', icon: Cpu },
    ],
  },
];

export default function SettingsScreen({
  onBack,
  onModels,
  onOutput,
  onLLM,
  onMCP,
  onExtensions,
  onAbout,
  onTheme,
  onData,
  onStorage,
  onMemory,
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
      case 'extensions':
        onExtensions();
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
      case 'memory':
        onMemory();
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
        {SETTINGS_SECTIONS.map(section => (
          <View key={section.title} style={styles.section}>
            <SectionHeader title={section.title} />
            <View style={[styles.group, { backgroundColor: colors.surfaceElevated }]}>
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const showDivider = index < section.items.length - 1;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.item,
                      showDivider && { borderBottomColor: colors.borderLight, borderBottomWidth: StyleSheet.hairlineWidth },
                    ]}
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
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  section: { paddingTop: spacing.xl },
  group: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    gap: spacing.md,
  },
  itemIcon: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemLabel: { fontSize: fontSizes.md, fontWeight: '600' },
  itemDesc: { fontSize: fontSizes.xs, marginTop: 2 },
});

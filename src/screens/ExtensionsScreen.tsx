import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archive, Brain, ChevronRight, Cpu } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import McpIcon from '../components/icons/McpIcon';
import { fontSizes, radius, spacing } from '../constants/theme';
import { ExtensionKind } from '../services/ExtensionService';
import { useTheme } from '../theme';

interface Props {
  onBack: () => void;
  onOpen: (kind: ExtensionKind) => void;
}

type ExtensionCard = {
  kind: ExtensionKind;
  title: string;
  desc: string;
  badge: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  disabled?: boolean;
};

const EXTENSIONS: ExtensionCard[] = [
  {
    kind: 'agent',
    title: 'Agent 扩展',
    desc: '添加带触发条件和工具权限的自定义 Agent，可单独启停。',
    badge: '可添加',
    icon: Brain,
  },
  {
    kind: 'mcp',
    title: 'MCP 扩展',
    desc: '添加 HTTP/S MCP 服务，查询 tools 列表，可单独启停。',
    badge: 'HTTP/S',
    icon: McpIcon,
  },
  {
    kind: 'skills',
    title: 'Skills 扩展',
    desc: '选择 ZIP 安装技能包；SSH 模式会推送到远端 ~/.linecode。',
    badge: 'ZIP',
    icon: Archive,
  },
  {
    kind: 'linecode',
    title: 'LineCode 扩展',
    desc: '导入 .lip 原生扩展包，可注册页面、菜单和 Hook。',
    badge: 'LIP',
    icon: Cpu,
  },
];

export default function ExtensionsScreen({ onBack, onOpen }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="扩展" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {EXTENSIONS.map(item => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.kind}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: item.disabled ? colors.borderLight : colors.border,
                },
              ]}
              activeOpacity={0.75}
              onPress={() => onOpen(item.kind)}
            >
              <View style={[styles.iconWrap, { backgroundColor: item.disabled ? colors.surfaceLight : colors.accentMuted }]}>
                <Icon size={22} color={item.disabled ? colors.textTertiary : colors.accent} />
              </View>
              <View style={styles.cardText}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: item.disabled ? colors.surfaceLight : colors.accentMuted },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: item.disabled ? colors.textTertiary : colors.accent }]}>
                      {item.badge}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.desc, { color: colors.textTertiary }]}>{item.desc}</Text>
              </View>
              <ChevronRight size={17} color={colors.textTertiary} />
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
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
    gap: spacing.sm,
  },
  card: {
    minHeight: 96,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    paddingRight: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  title: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  desc: {
    marginTop: spacing.xs,
    fontSize: fontSizes.sm,
    lineHeight: 20,
  },
});

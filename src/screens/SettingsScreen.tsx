import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Box, Monitor, Cpu, Brain } from 'lucide-react-native';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

interface Props {
  onBack: () => void;
  onModels: () => void;
  onOutput: () => void;
  onLLM: () => void;
}

const SETTINGS_ITEMS = [
  { id: 'models', label: '模型管理', desc: '添加、删除和切换模型', icon: Box },
  { id: 'llm', label: 'LLM 设置', desc: '显示模式和交流语气', icon: Brain },
  { id: 'output', label: '输出设置', desc: '代码显示和格式化选项', icon: Monitor },
  { id: 'about', label: '关于', desc: 'LineAI v0.0.1', icon: Cpu },
];

export default function SettingsScreen({ onBack, onModels, onOutput, onLLM }: Props) {
  const insets = useSafeAreaInsets();

  const handlePress = (id: string) => {
    if (id === 'models') onModels();
    if (id === 'output') onOutput();
    if (id === 'llm') onLLM();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>设置</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.list}>
        {SETTINGS_ITEMS.map(item => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.item}
              onPress={() => handlePress(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.itemIcon}>
                <Icon size={20} color={colors.accent} />
              </View>
              <View style={styles.itemContent}>
                <Text style={styles.itemLabel}>{item.label}</Text>
                <Text style={styles.itemDesc}>{item.desc}</Text>
              </View>
              <ChevronRight size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '700' },
  list: { paddingTop: spacing.lg },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: colors.surfaceElevated,
    marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    borderRadius: radius.md, gap: spacing.md,
  },
  itemIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(48,209,88,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  itemContent: { flex: 1 },
  itemLabel: { color: colors.text, fontSize: fontSizes.md, fontWeight: '600' },
  itemDesc: { color: colors.textTertiary, fontSize: fontSizes.xs, marginTop: 2 },
});

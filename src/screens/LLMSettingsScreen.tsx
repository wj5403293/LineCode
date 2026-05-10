import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Monitor, Zap, Smile, Brain, Expand, ScrollText } from 'lucide-react-native';
import {
  getDisplayMode, setDisplayMode, DisplayMode,
  getToneMode, setToneMode, ToneMode,
  getThinkingScroll, setThinkingScroll,
  getThinkingAutoExpand, setThinkingAutoExpand,
} from '../services/settings';
import { colors, spacing, fontSizes, radius } from '../constants/theme';

interface Props {
  onBack: () => void;
}

export default function LLMSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [displayMode, setCurrentDisplayMode] = useState<DisplayMode>('fullscreen');
  const [toneMode, setCurrentToneMode] = useState<ToneMode>('coding');
  const [thinkingScrollEnabled, setThinkingScrollEnabled] = useState(true);
  const [thinkingAutoExpandEnabled, setThinkingAutoExpandEnabled] = useState(false);

  useEffect(() => {
    Promise.all([
      getDisplayMode(), getToneMode(), getThinkingScroll(), getThinkingAutoExpand(),
    ]).then(([d, t, s, a]) => {
      setCurrentDisplayMode(d);
      setCurrentToneMode(t);
      setThinkingScrollEnabled(s);
      setThinkingAutoExpandEnabled(a);
    });
  }, []);

  const handleDisplayMode = useCallback(async (mode: DisplayMode) => {
    setCurrentDisplayMode(mode);
    await setDisplayMode(mode);
  }, []);

  const handleToneMode = useCallback(async (mode: ToneMode) => {
    setCurrentToneMode(mode);
    await setToneMode(mode);
  }, []);

  const handleThinkingScroll = useCallback(async (value: boolean) => {
    setThinkingScrollEnabled(value);
    await setThinkingScroll(value);
  }, []);

  const handleThinkingAutoExpand = useCallback(async (value: boolean) => {
    setThinkingAutoExpandEnabled(value);
    await setThinkingAutoExpand(value);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LLM 设置</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Display Mode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>显示逻辑</Text>
        <View style={styles.optionGroup}>
          <TouchableOpacity
            style={[styles.option, displayMode === 'fullscreen' && styles.optionActive]}
            onPress={() => handleDisplayMode('fullscreen')}
            activeOpacity={0.7}
          >
            <Monitor size={20} color={displayMode === 'fullscreen' ? colors.accent : colors.textSecondary} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, displayMode === 'fullscreen' && styles.optionLabelActive]}>
                全屏模式
              </Text>
              <Text style={styles.optionDesc}>AI 回复占满宽度，适合阅读代码</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, displayMode === 'bubble' && styles.optionActive]}
            onPress={() => handleDisplayMode('bubble')}
            activeOpacity={0.7}
          >
            <MessageSquare size={20} color={displayMode === 'bubble' ? colors.accent : colors.textSecondary} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, displayMode === 'bubble' && styles.optionLabelActive]}>
                气泡模式
              </Text>
              <Text style={styles.optionDesc}>传统聊天气泡样式</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tone Mode */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>交流语气</Text>
        <View style={styles.optionGroup}>
          <TouchableOpacity
            style={[styles.option, toneMode === 'coding' && styles.optionActive]}
            onPress={() => handleToneMode('coding')}
            activeOpacity={0.7}
          >
            <Zap size={20} color={toneMode === 'coding' ? colors.accent : colors.textSecondary} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, toneMode === 'coding' && styles.optionLabelActive]}>
                编程模式
              </Text>
              <Text style={styles.optionDesc}>严谨专业，代码优先，不使用 emoji</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, toneMode === 'chat' && styles.optionActive]}
            onPress={() => handleToneMode('chat')}
            activeOpacity={0.7}
          >
            <Smile size={20} color={toneMode === 'chat' ? colors.accent : colors.textSecondary} />
            <View style={styles.optionContent}>
              <Text style={[styles.optionLabel, toneMode === 'chat' && styles.optionLabelActive]}>
                聊天模式
              </Text>
              <Text style={styles.optionDesc}>亲切温柔，像朋友聊天，可以使用 emoji 😊</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Thinking Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>思考过程</Text>
        <View style={styles.optionGroup}>
          <View style={styles.switchItem}>
            <View style={styles.switchContent}>
              <ScrollText size={20} color={colors.textSecondary} />
              <View style={styles.switchText}>
                <Text style={styles.optionLabel}>滚动显示</Text>
                <Text style={styles.optionDesc}>关闭后直接完全展开显示</Text>
              </View>
            </View>
            <Switch
              value={thinkingScrollEnabled}
              onValueChange={handleThinkingScroll}
              trackColor={{ false: colors.surfaceLight, true: colors.accentDim }}
              thumbColor={thinkingScrollEnabled ? colors.accent : colors.textTertiary}
            />
          </View>
          <View style={styles.switchItem}>
            <View style={styles.switchContent}>
              <Expand size={20} color={colors.textSecondary} />
              <View style={styles.switchText}>
                <Text style={styles.optionLabel}>自动展开</Text>
                <Text style={styles.optionDesc}>收到思考内容时自动展开</Text>
              </View>
            </View>
            <Switch
              value={thinkingAutoExpandEnabled}
              onValueChange={handleThinkingAutoExpand}
              trackColor={{ false: colors.surfaceLight, true: colors.accentDim }}
              thumbColor={thinkingAutoExpandEnabled ? colors.accent : colors.textTertiary}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

const MessageSquare = ({ size, color }: { size: number; color: string }) => (
  <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: size * 0.6, color }}>💬</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  iconBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: colors.text, fontSize: fontSizes.lg, fontWeight: '700' },
  section: { paddingTop: spacing.xl },
  sectionTitle: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  optionGroup: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  optionActive: {
    backgroundColor: 'rgba(48,209,88,0.08)',
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    color: colors.text,
    fontSize: fontSizes.md,
    fontWeight: '500',
  },
  optionLabelActive: {
    color: colors.accent,
    fontWeight: '600',
  },
  optionDesc: {
    color: colors.textTertiary,
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  switchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  switchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  switchText: {
    flex: 1,
  },
});

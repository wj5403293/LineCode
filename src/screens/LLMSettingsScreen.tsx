import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Monitor, Zap, Smile, Brain, Expand, ScrollText, MessageCircle, Sparkles } from 'lucide-react-native';
import {
  settingsService, DisplayMode, ToneMode, ReasoningEffort, REASONING_EFFORT_DESC,
} from '../services/settings';
import { spacing, radius } from '../constants/theme';
import { useTheme } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import OptionRow from '../components/OptionRow';
import SwitchRow from '../components/SwitchRow';

interface Props {
  onBack: () => void;
}

const REASONING_EFFORTS: ReasoningEffort[] = ['off', 'low', 'medium', 'high', 'max'];

export default function LLMSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [displayMode, setCurrentDisplayMode] = useState<DisplayMode>('fullscreen');
  const [toneMode, setCurrentToneMode] = useState<ToneMode>('coding');
  const [thinkingScrollEnabled, setThinkingScrollEnabled] = useState(true);
  const [thinkingAutoExpandEnabled, setThinkingAutoExpandEnabled] = useState(false);
  const [reasoningEffort, setReasoningEffortState] = useState<ReasoningEffort>('medium');
  const [preserveReasoningEnabled, setPreserveReasoningEnabled] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    Promise.all([
      settingsService.getDisplayMode(), settingsService.getToneMode(),
      settingsService.getThinkingScroll(), settingsService.getThinkingAutoExpand(),
      settingsService.getReasoningEffort(), settingsService.getPreserveReasoning(),
    ]).then(([d, t, s, a, r, p]) => {
      setCurrentDisplayMode(d);
      setCurrentToneMode(t);
      setThinkingScrollEnabled(s);
      setThinkingAutoExpandEnabled(a);
      setReasoningEffortState(r);
      setPreserveReasoningEnabled(p);
    });
  }, []);

  const handleDisplayMode = useCallback(async (mode: DisplayMode) => {
    setCurrentDisplayMode(mode);
    await settingsService.setDisplayMode(mode);
  }, []);

  const handleToneMode = useCallback(async (mode: ToneMode) => {
    setCurrentToneMode(mode);
    await settingsService.setToneMode(mode);
  }, []);

  const handleThinkingScroll = useCallback(async (value: boolean) => {
    setThinkingScrollEnabled(value);
    await settingsService.setThinkingScroll(value);
  }, []);

  const handleThinkingAutoExpand = useCallback(async (value: boolean) => {
    setThinkingAutoExpandEnabled(value);
    await settingsService.setThinkingAutoExpand(value);
  }, []);

  const handleReasoningEffort = useCallback(async (effort: ReasoningEffort) => {
    setReasoningEffortState(effort);
    await settingsService.setReasoningEffort(effort);
  }, []);

  const handlePreserveReasoning = useCallback(async (value: boolean) => {
    setPreserveReasoningEnabled(value);
    await settingsService.setPreserveReasoning(value);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="LLM 设置" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionHeader title="思考深度" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            {REASONING_EFFORTS.map(effort => (
              <OptionRow
                key={effort}
                icon={<Sparkles size={20} color={reasoningEffort === effort ? colors.accent : colors.textSecondary} />}
                label={REASONING_EFFORT_DESC[effort].label}
                desc={REASONING_EFFORT_DESC[effort].desc}
                active={reasoningEffort === effort}
                onPress={() => handleReasoningEffort(effort)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="显示逻辑" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            <OptionRow
              icon={<Monitor size={20} color={displayMode === 'fullscreen' ? colors.accent : colors.textSecondary} />}
              label="全屏模式"
              desc="AI 回复占满宽度，适合阅读代码"
              active={displayMode === 'fullscreen'}
              onPress={() => handleDisplayMode('fullscreen')}
            />
            <OptionRow
              icon={<MessageCircle size={20} color={displayMode === 'bubble' ? colors.accent : colors.textSecondary} />}
              label="气泡模式"
              desc="传统聊天气泡样式"
              active={displayMode === 'bubble'}
              onPress={() => handleDisplayMode('bubble')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="交流语气" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            <OptionRow
              icon={<Zap size={20} color={toneMode === 'coding' ? colors.accent : colors.textSecondary} />}
              label="编程模式"
              desc="严谨专业，代码优先，不使用 emoji"
              active={toneMode === 'coding'}
              onPress={() => handleToneMode('coding')}
            />
            <OptionRow
              icon={<Smile size={20} color={toneMode === 'chat' ? colors.accent : colors.textSecondary} />}
              label="聊天模式"
              desc="亲切温柔，像朋友聊天，可以使用 emoji"
              active={toneMode === 'chat'}
              onPress={() => handleToneMode('chat')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="思考过程" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            <SwitchRow
              icon={<ScrollText size={20} color={colors.textSecondary} />}
              label="滚动显示"
              desc="关闭后直接完全展开显示"
              value={thinkingScrollEnabled}
              onValueChange={handleThinkingScroll}
            />
            <SwitchRow
              icon={<Expand size={20} color={colors.textSecondary} />}
              label="自动展开"
              desc="收到思考内容时自动展开"
              value={thinkingAutoExpandEnabled}
              onValueChange={handleThinkingAutoExpand}
            />
            <SwitchRow
              icon={<Brain size={20} color={colors.textSecondary} />}
              label="保留完整 reasoning"
              desc="将历史思考发回兼容模型，适合多轮工具调用"
              value={preserveReasoningEnabled}
              onValueChange={handlePreserveReasoning}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  section: { paddingTop: spacing.xl },
  optionGroup: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});

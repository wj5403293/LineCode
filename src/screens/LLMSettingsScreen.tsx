import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Monitor, Zap, Smile, Brain, Expand, ScrollText, MessageCircle } from 'lucide-react-native';
import {
  settingsService, DisplayMode, ToneMode,
} from '../services/settings';
import { colors, spacing, radius } from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import OptionRow from '../components/OptionRow';
import SwitchRow from '../components/SwitchRow';

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
      settingsService.getDisplayMode(), settingsService.getToneMode(),
      settingsService.getThinkingScroll(), settingsService.getThinkingAutoExpand(),
    ]).then(([d, t, s, a]) => {
      setCurrentDisplayMode(d);
      setCurrentToneMode(t);
      setThinkingScrollEnabled(s);
      setThinkingAutoExpandEnabled(a);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="LLM 设置" onBack={onBack} />

      <View style={styles.section}>
        <SectionHeader title="显示逻辑" />
        <View style={styles.optionGroup}>
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
        <View style={styles.optionGroup}>
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
            desc="亲切温柔，像朋友聊天，可以使用 emoji 😊"
            active={toneMode === 'chat'}
            onPress={() => handleToneMode('chat')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="思考过程" />
        <View style={styles.optionGroup}>
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
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { paddingTop: spacing.xl },
  optionGroup: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});

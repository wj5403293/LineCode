import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Smile, Brain, Expand, ScrollText, Sparkles } from 'lucide-react-native';
import {
  settingsService, ToneMode, ReasoningEffort, REASONING_EFFORT_DESC,
} from '../services/settings';
import { useTheme } from '../theme';
import OptionRow from '../components/OptionRow';
import SwitchRow from '../components/SwitchRow';
import { ScreenScaffold, SettingsSection } from '../components/ui';

interface Props {
  onBack: () => void;
}

const REASONING_EFFORTS: ReasoningEffort[] = ['off', 'low', 'medium', 'high', 'max'];

export default function LLMSettingsScreen({ onBack }: Props) {
  const [toneMode, setCurrentToneMode] = useState<ToneMode>('coding');
  const [thinkingScrollEnabled, setThinkingScrollEnabled] = useState(true);
  const [thinkingAutoExpandEnabled, setThinkingAutoExpandEnabled] = useState(false);
  const [reasoningEffort, setReasoningEffortState] = useState<ReasoningEffort>('medium');
  const [preserveReasoningEnabled, setPreserveReasoningEnabled] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    Promise.all([
      settingsService.getToneMode(),
      settingsService.getThinkingScroll(), settingsService.getThinkingAutoExpand(),
      settingsService.getReasoningEffort(), settingsService.getPreserveReasoning(),
    ]).then(([t, s, a, r, p]) => {
      setCurrentToneMode(t);
      setThinkingScrollEnabled(s);
      setThinkingAutoExpandEnabled(a);
      setReasoningEffortState(r);
      setPreserveReasoningEnabled(p);
    });
  }, []);

  const handleToneMode = useCallback(async (mode: ToneMode) => {
    await settingsService.setToneMode(mode);
    setCurrentToneMode(mode);
  }, []);

  const handleThinkingScroll = useCallback(async (value: boolean) => {
    await settingsService.setThinkingScroll(value);
    setThinkingScrollEnabled(value);
  }, []);

  const handleThinkingAutoExpand = useCallback(async (value: boolean) => {
    await settingsService.setThinkingAutoExpand(value);
    setThinkingAutoExpandEnabled(value);
  }, []);

  const handleReasoningEffort = useCallback(async (effort: ReasoningEffort) => {
    await settingsService.setReasoningEffort(effort);
    setReasoningEffortState(effort);
  }, []);

  const handlePreserveReasoning = useCallback(async (value: boolean) => {
    await settingsService.setPreserveReasoning(value);
    setPreserveReasoningEnabled(value);
  }, []);

  return (
    <ScreenScaffold title="AI 行为" onBack={onBack}>
      <SettingsSection title="思考深度">
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
      </SettingsSection>

      <SettingsSection title="交流语气">
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
      </SettingsSection>

      <SettingsSection title="思考过程">
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
      </SettingsSection>
    </ScreenScaffold>
  );
}

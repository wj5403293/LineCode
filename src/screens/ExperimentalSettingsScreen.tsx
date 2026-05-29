import React, { useCallback, useEffect, useState } from 'react';
import { MessageSquareText, Smartphone, SquareFunction } from 'lucide-react-native';
import SwitchRow from '../components/SwitchRow';
import { settingsService } from '../services/settings';
import { useTheme } from '../theme';
import { ScreenScaffold, SettingsSection } from '../components/ui';

interface Props {
  onBack: () => void;
}

export default function ExperimentalSettingsScreen({ onBack }: Props) {
  const { colors } = useTheme();
  const [mathFormulaRenderingEnabled, setMathFormulaRenderingEnabled] = useState(false);
  const [restoreLastConversationOnStartup, setRestoreLastConversationOnStartup] = useState(false);
  const [experimentalAndroidKeyboardAvoidanceEnabled, setExperimentalAndroidKeyboardAvoidanceEnabled] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsService.getMathFormulaRenderingEnabled(),
      settingsService.getRestoreLastConversationOnStartup(),
      settingsService.getExperimentalAndroidKeyboardAvoidanceEnabled(),
    ])
      .then(([mathEnabled, restoreLastConversation, experimentalKeyboardAvoidance]) => {
        setMathFormulaRenderingEnabled(mathEnabled);
        setRestoreLastConversationOnStartup(restoreLastConversation);
        setExperimentalAndroidKeyboardAvoidanceEnabled(experimentalKeyboardAvoidance);
      })
      .catch(() => {});
  }, []);

  const handleMathFormulaRendering = useCallback(async (value: boolean) => {
    await settingsService.setMathFormulaRenderingEnabled(value);
    setMathFormulaRenderingEnabled(value);
  }, []);

  const handleRestoreLastConversationOnStartup = useCallback(async (value: boolean) => {
    await settingsService.setRestoreLastConversationOnStartup(value);
    setRestoreLastConversationOnStartup(value);
  }, []);

  const handleExperimentalAndroidKeyboardAvoidance = useCallback(async (value: boolean) => {
    await settingsService.setExperimentalAndroidKeyboardAvoidanceEnabled(value);
    setExperimentalAndroidKeyboardAvoidanceEnabled(value);
  }, []);

  return (
    <ScreenScaffold title="实验性功能" onBack={onBack}>
      <SettingsSection title="对话">
        <SwitchRow
          icon={<MessageSquareText size={20} color={colors.textSecondary} />}
          label="启动时进入上一次对话"
          desc="默认关闭。关闭时每次打开应用进入新对话，可从侧边栏手动选择历史对话"
          value={restoreLastConversationOnStartup}
          onValueChange={handleRestoreLastConversationOnStartup}
        />
      </SettingsSection>

      <SettingsSection title="系统兼容">
        <SwitchRow
          icon={<Smartphone size={20} color={colors.textSecondary} />}
          label="实验性键盘避让"
          desc="默认关闭，优先使用系统输入法避让。开启后使用旧版自定义键盘测量方案，可能改善部分机型，也可能导致输入栏位置异常"
          value={experimentalAndroidKeyboardAvoidanceEnabled}
          onValueChange={handleExperimentalAndroidKeyboardAvoidance}
        />
      </SettingsSection>

      <SettingsSection title="渲染">
        <SwitchRow
          icon={<SquareFunction size={20} color={colors.textSecondary} />}
          label="数学公式渲染"
          desc="默认关闭，开启后解析 LaTeX 公式"
          value={mathFormulaRenderingEnabled}
          onValueChange={handleMathFormulaRendering}
        />
      </SettingsSection>
    </ScreenScaffold>
  );
}

import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquareText, Smartphone, SquareFunction } from 'lucide-react-native';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SwitchRow from '../components/SwitchRow';
import { spacing, radius } from '../constants/theme';
import { settingsService } from '../services/settings';
import { useTheme } from '../theme';

interface Props {
  onBack: () => void;
}

export default function ExperimentalSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
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
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="实验性功能" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionHeader title="对话" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            <SwitchRow
              icon={<MessageSquareText size={20} color={colors.textSecondary} />}
              label="启动时进入上一次对话"
              desc="默认关闭。关闭时每次打开应用进入新对话，可从侧边栏手动选择历史对话"
              value={restoreLastConversationOnStartup}
              onValueChange={handleRestoreLastConversationOnStartup}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="系统兼容" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            <SwitchRow
              icon={<Smartphone size={20} color={colors.textSecondary} />}
              label="实验性键盘避让"
              desc="默认关闭，优先使用系统输入法避让。开启后使用旧版自定义键盘测量方案，可能改善部分机型，也可能导致输入栏位置异常"
              value={experimentalAndroidKeyboardAvoidanceEnabled}
              onValueChange={handleExperimentalAndroidKeyboardAvoidance}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="渲染" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            <SwitchRow
              icon={<SquareFunction size={20} color={colors.textSecondary} />}
              label="数学公式渲染"
              desc="默认关闭，开启后解析 LaTeX 公式"
              value={mathFormulaRenderingEnabled}
              onValueChange={handleMathFormulaRendering}
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

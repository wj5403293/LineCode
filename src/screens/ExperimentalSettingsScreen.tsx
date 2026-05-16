import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SquareFunction } from 'lucide-react-native';
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

  useEffect(() => {
    settingsService.getMathFormulaRenderingEnabled()
      .then(setMathFormulaRenderingEnabled)
      .catch(() => {});
  }, []);

  const handleMathFormulaRendering = useCallback(async (value: boolean) => {
    setMathFormulaRenderingEnabled(value);
    await settingsService.setMathFormulaRenderingEnabled(value);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="实验性功能" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollText } from 'lucide-react-native';
import { settingsService } from '../services/settings';
import { colors, spacing, radius } from '../constants/theme';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import SwitchRow from '../components/SwitchRow';

interface Props {
  onBack: () => void;
}

export default function OutputSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [codeWrapEnabled, setCodeWrapEnabled] = useState(false);

  useEffect(() => {
    settingsService.getCodeWrap().then(setCodeWrapEnabled);
  }, []);

  const handleToggleCodeWrap = useCallback(async (value: boolean) => {
    setCodeWrapEnabled(value);
    await settingsService.setCodeWrap(value);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="输出设置" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionHeader title="代码显示" />
          <View style={styles.optionGroup}>
            <SwitchRow
              icon={<ScrollText size={20} color={colors.textSecondary} />}
              label="代码自动换行"
              desc="关闭时代码可水平滚动"
              value={codeWrapEnabled}
              onValueChange={handleToggleCodeWrap}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 100 },
  section: { paddingTop: spacing.xl },
  optionGroup: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});

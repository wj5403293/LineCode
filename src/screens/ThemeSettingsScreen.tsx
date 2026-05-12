import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sun, Moon, Monitor } from 'lucide-react-native';
import { settingsService, ThemeMode } from '../services/settings';
import { useTheme } from '../theme';
import { spacing, radius } from '../constants/layout';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import OptionRow from '../components/OptionRow';

const THEMES: { mode: ThemeMode; label: string; desc: string; icon: typeof Sun }[] = [
  { mode: 'system', label: '跟随系统', desc: '自动匹配系统外观', icon: Monitor },
  { mode: 'light', label: '亮色模式', desc: '浅色主题，适合白天', icon: Sun },
  { mode: 'dark', label: '暗色模式', desc: '深色主题，适合夜间', icon: Moon },
];

interface Props {
  onBack: () => void;
}

export default function ThemeSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode, colors } = useTheme();
  const [localMode, setLocalMode] = useState<ThemeMode>(themeMode);

  useEffect(() => {
    setLocalMode(themeMode);
  }, [themeMode]);

  const handleSelect = useCallback(async (mode: ThemeMode) => {
    setLocalMode(mode);
    await setThemeMode(mode);
  }, [setThemeMode]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="主题设置" onBack={onBack} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionHeader title="外观" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            {THEMES.map(({ mode, label, desc, icon: Icon }) => (
              <OptionRow
                key={mode}
                icon={<Icon size={20} color={localMode === mode ? colors.accent : colors.textSecondary} />}
                label={label}
                desc={desc}
                active={localMode === mode}
                onPress={() => handleSelect(mode)}
              />
            ))}
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

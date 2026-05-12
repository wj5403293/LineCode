import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollText, Globe, ExternalLink } from 'lucide-react-native';
import { settingsService, BrowserMode } from '../services/settings';
import { spacing, radius } from '../constants/theme';
import { useTheme } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import OptionRow from '../components/OptionRow';
import SwitchRow from '../components/SwitchRow';

interface Props {
  onBack: () => void;
}

export default function OutputSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [codeWrapEnabled, setCodeWrapEnabled] = useState(false);
  const [browserMode, setBrowserMode] = useState<BrowserMode>('builtin');
  const { colors } = useTheme();

  useEffect(() => {
    Promise.all([
      settingsService.getCodeWrap(),
      settingsService.getBrowserMode(),
    ]).then(([wrap, browser]) => {
      setCodeWrapEnabled(wrap);
      setBrowserMode(browser);
    });
  }, []);

  const handleToggleCodeWrap = useCallback(async (value: boolean) => {
    setCodeWrapEnabled(value);
    await settingsService.setCodeWrap(value);
  }, []);

  const handleBrowserMode = useCallback(async (mode: BrowserMode) => {
    setBrowserMode(mode);
    await settingsService.setBrowserMode(mode);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="输出设置" onBack={onBack} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <SectionHeader title="代码显示" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            <SwitchRow
              icon={<ScrollText size={20} color={colors.textSecondary} />}
              label="代码自动换行"
              desc="关闭时代码可水平滚动"
              value={codeWrapEnabled}
              onValueChange={handleToggleCodeWrap}
            />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title="网页打开方式" />
          <View style={[styles.optionGroup, { backgroundColor: colors.surfaceElevated }]}>
            <OptionRow
              icon={<Globe size={20} color={browserMode === 'builtin' ? colors.accent : colors.textSecondary} />}
              label="内置浏览器"
              desc="在应用内打开网页"
              active={browserMode === 'builtin'}
              onPress={() => handleBrowserMode('builtin')}
            />
            <OptionRow
              icon={<ExternalLink size={20} color={browserMode === 'external' ? colors.accent : colors.textSecondary} />}
              label="外部浏览器"
              desc="使用系统浏览器打开"
              active={browserMode === 'external'}
              onPress={() => handleBrowserMode('external')}
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

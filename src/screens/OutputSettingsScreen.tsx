import React, { useState, useEffect, useCallback } from 'react';
import { ScrollText, Globe, ExternalLink, Monitor, MessageCircle } from 'lucide-react-native';
import { settingsService, BrowserMode, DisplayMode } from '../services/settings';
import { useTheme } from '../theme';
import OptionRow from '../components/OptionRow';
import SwitchRow from '../components/SwitchRow';
import { ScreenScaffold, SettingsSection } from '../components/ui';

interface Props {
  onBack: () => void;
}

export default function OutputSettingsScreen({ onBack }: Props) {
  const [displayMode, setCurrentDisplayMode] = useState<DisplayMode>('fullscreen');
  const [codeWrapEnabled, setCodeWrapEnabled] = useState(false);
  const [browserMode, setBrowserMode] = useState<BrowserMode>('builtin');
  const { colors } = useTheme();

  useEffect(() => {
    Promise.all([
      settingsService.getDisplayMode(),
      settingsService.getCodeWrap(),
      settingsService.getBrowserMode(),
    ]).then(([display, wrap, browser]) => {
      setCurrentDisplayMode(display);
      setCodeWrapEnabled(wrap);
      setBrowserMode(browser);
    });
  }, []);

  const handleDisplayMode = useCallback(async (mode: DisplayMode) => {
    await settingsService.setDisplayMode(mode);
    setCurrentDisplayMode(mode);
  }, []);

  const handleToggleCodeWrap = useCallback(async (value: boolean) => {
    await settingsService.setCodeWrap(value);
    setCodeWrapEnabled(value);
  }, []);

  const handleBrowserMode = useCallback(async (mode: BrowserMode) => {
    setBrowserMode(mode);
    await settingsService.setBrowserMode(mode);
  }, []);

  return (
    <ScreenScaffold title="输出与浏览" onBack={onBack}>
      <SettingsSection title="回复布局">
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
      </SettingsSection>

      <SettingsSection title="代码显示">
        <SwitchRow
          icon={<ScrollText size={20} color={colors.textSecondary} />}
          label="代码自动换行"
          desc="关闭时代码可水平滚动"
          value={codeWrapEnabled}
          onValueChange={handleToggleCodeWrap}
        />
      </SettingsSection>

      <SettingsSection title="网页打开方式">
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
      </SettingsSection>
    </ScreenScaffold>
  );
}

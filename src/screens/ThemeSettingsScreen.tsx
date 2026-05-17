import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Coffee, Code2, Contrast, GitBranch, Monitor, Moon, Paintbrush, RotateCcw, Save, Sun } from 'lucide-react-native';
import { settingsService, ThemeMode } from '../services/settings';
import { useTheme } from '../theme';
import {
  coffeeColors,
  customDefaultColors,
  darkColors,
  githubDarkColors,
  gruvboxColors,
  highContrastColors,
  lightColors,
  ThemeColors,
  vscodeColors,
} from '../theme/themes';
import { spacing, radius, fontSizes } from '../constants/layout';
import ScreenHeader from '../components/ScreenHeader';
import SectionHeader from '../components/SectionHeader';
import OptionRow from '../components/OptionRow';

const THEMES: { mode: ThemeMode; label: string; desc: string; icon: typeof Sun }[] = [
  { mode: 'system', label: '跟随系统', desc: '自动匹配系统外观', icon: Monitor },
  { mode: 'light', label: '亮色模式', desc: '浅色主题，适合白天', icon: Sun },
  { mode: 'dark', label: '暗色模式', desc: '深色主题，适合夜间', icon: Moon },
  { mode: 'coffee', label: '咖啡纸', desc: '类似 Claude 的纸张和咖啡色调', icon: Coffee },
  { mode: 'vscode', label: 'VS Code', desc: '熟悉的编辑器深色蓝调', icon: Code2 },
  { mode: 'githubDark', label: 'GitHub Dark', desc: '接近 GitHub 的暗色代码界面', icon: GitBranch },
  { mode: 'gruvbox', label: 'Gruvbox', desc: '复古暖色终端风格', icon: Code2 },
  { mode: 'highContrast', label: '高对比', desc: '黑底高亮，提升辨识度', icon: Contrast },
  { mode: 'custom', label: '自定义', desc: '编辑并保存自己的颜色主题', icon: Paintbrush },
];

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; desc: string }[] = [
  { key: 'bg', label: '背景', desc: '页面底色' },
  { key: 'surfaceElevated', label: '面板', desc: '卡片和弹层背景' },
  { key: 'surfaceLight', label: '浅面板', desc: '按钮和次级区域' },
  { key: 'inputBg', label: '输入框', desc: '输入栏背景' },
  { key: 'text', label: '正文', desc: '主要文字' },
  { key: 'textSecondary', label: '次级文字', desc: '说明文字' },
  { key: 'textTertiary', label: '弱文字', desc: '占位和辅助文字' },
  { key: 'accent', label: '强调色', desc: '选中、按钮、链接' },
  { key: 'userBubble', label: '用户气泡', desc: '用户消息背景' },
  { key: 'aiBubble', label: 'AI 气泡', desc: 'AI 消息背景' },
  { key: 'border', label: '边框', desc: '主分割线' },
  { key: 'codeBg', label: '代码背景', desc: '代码块背景' },
  { key: 'danger', label: '危险', desc: '删除和错误' },
  { key: 'warning', label: '警告', desc: '提醒状态' },
  { key: 'success', label: '成功', desc: '完成状态' },
];

const SWATCHES = [
  '#F4EFE6', '#FBF7EF', '#EEE5D8', '#E7DCCA',
  '#2B2118', '#6C5A49', '#9B8976', '#D97757',
  '#B86F50', '#EFE4D4', '#DDD0BF', '#6A7F46',
  '#0A0A0A', '#1C1C1E', '#FFFFFF', '#0A84FF',
  '#1E1E1E', '#252526', '#007ACC', '#D4D4D4',
  '#0D1117', '#161B22', '#2F81F7', '#E6EDF3',
  '#282828', '#FABD2F', '#EBDBB2', '#458588',
  '#64D2FF', '#FFD60A', '#30D158', '#FF453A',
];

type ThemeStarterId = 'default' | 'light' | 'dark' | 'coffee' | 'vscode' | 'githubDark' | 'gruvbox' | 'highContrast' | 'saved';

const THEME_STARTERS: {
  id: Exclude<ThemeStarterId, 'saved'>;
  label: string;
  icon: typeof Sun;
  colors: ThemeColors;
}[] = [
  { id: 'default', label: '默认', icon: Paintbrush, colors: customDefaultColors },
  { id: 'light', label: '亮色', icon: Sun, colors: { ...lightColors, codeBg: '#F2F2F7' } },
  { id: 'dark', label: '暗色', icon: Moon, colors: { ...darkColors, codeBg: '#151515' } },
  { id: 'coffee', label: '咖啡纸', icon: Coffee, colors: { ...coffeeColors, codeBg: '#EFE4D4' } },
  { id: 'vscode', label: 'VS Code', icon: Code2, colors: vscodeColors },
  { id: 'githubDark', label: 'GitHub', icon: GitBranch, colors: githubDarkColors },
  { id: 'gruvbox', label: 'Gruvbox', icon: Code2, colors: gruvboxColors },
  { id: 'highContrast', label: '高对比', icon: Contrast, colors: highContrastColors },
];

interface Props {
  onBack: () => void;
}

function isHexColor(value: string): boolean {
  return /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value.trim());
}

function createThemeDraft(base: Partial<ThemeColors> = customDefaultColors, stored?: Record<string, string> | null): Partial<ThemeColors> {
  const draft: Partial<ThemeColors> = { ...customDefaultColors, ...base, ...(stored || {}) };
  for (const field of COLOR_FIELDS) {
    const value = String(draft[field.key] || '');
    if (!isHexColor(value)) {
      const fallback = String(base[field.key] || customDefaultColors[field.key]);
      draft[field.key] = isHexColor(fallback) ? fallback : customDefaultColors[field.key];
    }
  }
  return draft;
}

export default function ThemeSettingsScreen({ onBack }: Props) {
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode, setCustomThemeColors, colors } = useTheme();
  const [localMode, setLocalMode] = useState<ThemeMode>(themeMode);
  const [draft, setDraft] = useState<Partial<ThemeColors>>(customDefaultColors);
  const [activeKey, setActiveKey] = useState<keyof ThemeColors>('accent');
  const [activeStarter, setActiveStarter] = useState<ThemeStarterId>('default');
  const [savedCustomColors, setSavedCustomColors] = useState<Record<string, string> | null>(null);

  useEffect(() => {
    setLocalMode(themeMode);
  }, [themeMode]);

  useEffect(() => {
    settingsService.getCustomThemeColors().then(stored => {
      setSavedCustomColors(stored);
      setDraft(createThemeDraft(customDefaultColors, stored));
      if (stored) setActiveStarter('saved');
    });
  }, []);

  const starterOptions = useMemo(() => {
    if (!savedCustomColors) return THEME_STARTERS;
    return [
      ...THEME_STARTERS,
      {
        id: 'saved' as const,
        label: '已保存',
        icon: Save,
        colors: createThemeDraft(customDefaultColors, savedCustomColors) as ThemeColors,
      },
    ];
  }, [savedCustomColors]);

  const activeValue = draft[activeKey] || customDefaultColors[activeKey];
  const hasInvalidColor = useMemo(
    () => COLOR_FIELDS.some(field => !isHexColor(String(draft[field.key] || ''))),
    [draft],
  );

  const handleSelect = useCallback(async (mode: ThemeMode) => {
    setLocalMode(mode);
    await setThemeMode(mode);
  }, [setThemeMode]);

  const updateDraftColor = useCallback((key: keyof ThemeColors, value: string) => {
    const nextValue = value.startsWith('#') ? value : `#${value}`;
    setDraft(prev => ({ ...prev, [key]: nextValue }));
  }, []);

  const applySwatch = useCallback((value: string) => {
    setDraft(prev => ({ ...prev, [activeKey]: value }));
  }, [activeKey]);

  const applyStarter = useCallback((id: ThemeStarterId, base: Partial<ThemeColors>) => {
    setActiveStarter(id);
    setDraft(createThemeDraft(base));
  }, []);

  const handleSave = useCallback(async () => {
    if (hasInvalidColor) return;
    await setCustomThemeColors(draft);
    setSavedCustomColors(draft as Record<string, string>);
    setLocalMode('custom');
    await setThemeMode('custom');
  }, [draft, hasInvalidColor, setCustomThemeColors, setThemeMode]);

  const handleReset = useCallback(() => {
    setActiveStarter('default');
    setDraft(createThemeDraft(customDefaultColors));
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScreenHeader title="主题设置" onBack={onBack} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.section}>
          <SectionHeader title="主题" />
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

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <SectionHeader title="自定义颜色" />
            <View style={styles.headerActions}>
              <TouchableOpacity style={[styles.iconAction, { backgroundColor: colors.surfaceLight }]} onPress={handleReset} activeOpacity={0.75}>
                <RotateCcw size={15} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveAction, { backgroundColor: hasInvalidColor ? colors.surfaceLight : colors.accent }]}
                onPress={handleSave}
                disabled={hasInvalidColor}
                activeOpacity={0.75}
              >
                <Save size={15} color={hasInvalidColor ? colors.textTertiary : colors.textOnColor} />
                <Text style={[styles.saveText, { color: hasInvalidColor ? colors.textTertiary : colors.textOnColor }]}>保存</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.starterPanel, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.swatchLabel, { color: colors.textSecondary }]}>创作起点</Text>
            <View style={styles.starterGrid}>
              {starterOptions.map(({ id, label, icon: Icon, colors: starterColors }) => {
                const active = activeStarter === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[
                      styles.starterButton,
                      { borderColor: active ? colors.accent : colors.borderLight, backgroundColor: active ? colors.accentMuted : colors.surface },
                    ]}
                    onPress={() => applyStarter(id, starterColors)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.starterSwatches}>
                      <View style={[styles.starterSwatch, { backgroundColor: starterColors.bg }]} />
                      <View style={[styles.starterSwatch, { backgroundColor: starterColors.aiBubble }]} />
                      <View style={[styles.starterSwatch, { backgroundColor: starterColors.accent }]} />
                    </View>
                    <Icon size={14} color={active ? colors.accent : colors.textSecondary} />
                    <Text style={[styles.starterText, { color: active ? colors.accent : colors.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.preview, { backgroundColor: draft.bg || customDefaultColors.bg, borderColor: draft.border || customDefaultColors.border }]}>
            <View style={[styles.previewBubble, { backgroundColor: draft.aiBubble || customDefaultColors.aiBubble }]}>
              <Text style={[styles.previewTitle, { color: draft.text || customDefaultColors.text }]}>主题预览</Text>
              <Text style={[styles.previewText, { color: draft.textSecondary || customDefaultColors.textSecondary }]}>保存后会应用到自定义主题。</Text>
            </View>
            <View style={[styles.previewPill, { backgroundColor: draft.accent || customDefaultColors.accent }]}>
              <Text style={[styles.previewPillText, { color: draft.textOnColor || customDefaultColors.textOnColor }]}>Accent</Text>
            </View>
          </View>

          <View style={[styles.swatchPanel, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={[styles.swatchLabel, { color: colors.textSecondary }]}>当前编辑：{COLOR_FIELDS.find(field => field.key === activeKey)?.label}</Text>
            <View style={styles.swatches}>
              {SWATCHES.map(value => (
                <TouchableOpacity
                  key={value}
                  style={[styles.swatch, { backgroundColor: value, borderColor: activeValue === value ? colors.accent : colors.borderLight }]}
                  onPress={() => applySwatch(value)}
                  activeOpacity={0.8}
                >
                  {activeValue === value && <Check size={14} color="#FFFFFF" />}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.editorGroup, { backgroundColor: colors.surfaceElevated }]}>
            {COLOR_FIELDS.map(field => {
              const value = String(draft[field.key] || '');
              const valid = isHexColor(value);
              return (
                <TouchableOpacity
                  key={field.key}
                  style={[styles.colorRow, { borderBottomColor: colors.borderLight }, activeKey === field.key && { backgroundColor: colors.accentMuted }]}
                  onPress={() => setActiveKey(field.key)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.colorPreview, { backgroundColor: valid ? value : colors.surfaceLight, borderColor: colors.borderLight }]} />
                  <View style={styles.colorMeta}>
                    <Text style={[styles.colorLabel, { color: colors.text }]}>{field.label}</Text>
                    <Text style={[styles.colorDesc, { color: valid ? colors.textTertiary : colors.danger }]}>{valid ? field.desc : '请输入 #RRGGBB'}</Text>
                  </View>
                  <TextInput
                    style={[styles.hexInput, { color: valid ? colors.text : colors.danger, borderColor: valid ? colors.borderLight : colors.danger }]}
                    value={value}
                    onFocus={() => setActiveKey(field.key)}
                    onChangeText={(next) => updateDraftColor(field.key, next)}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={9}
                    placeholder="#RRGGBB"
                    placeholderTextColor={colors.textTertiary}
                  />
                </TouchableOpacity>
              );
            })}
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAction: {
    height: 34,
    borderRadius: 17,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  saveText: {
    fontSize: fontSizes.sm,
    fontWeight: '700',
  },
  preview: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  previewBubble: {
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  previewTitle: {
    fontSize: fontSizes.md,
    fontWeight: '700',
  },
  previewText: {
    fontSize: fontSizes.sm,
    marginTop: 4,
  },
  previewPill: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  previewPillText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  starterPanel: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  starterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  starterButton: {
    width: '30.5%',
    minWidth: 92,
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: 6,
  },
  starterSwatches: {
    flexDirection: 'row',
  },
  starterSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: -4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  starterText: {
    fontSize: fontSizes.xs,
    fontWeight: '700',
  },
  swatchPanel: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  swatchLabel: {
    fontSize: fontSizes.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorGroup: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  colorRow: {
    minHeight: 66,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: StyleSheet.hairlineWidth,
  },
  colorMeta: {
    flex: 1,
    minWidth: 0,
  },
  colorLabel: {
    fontSize: fontSizes.md,
    fontWeight: '600',
  },
  colorDesc: {
    fontSize: fontSizes.xs,
    marginTop: 2,
  },
  hexInput: {
    width: 92,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontSize: fontSizes.sm,
    fontFamily: 'monospace',
  },
});

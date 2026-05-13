import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import {
  ThemeColors,
  SyntaxColors,
  darkColors,
  lightColors,
  coffeeColors,
  customDefaultColors,
  gruvboxColors,
  githubDarkColors,
  highContrastColors,
  vscodeColors,
  darkSyntax,
  lightSyntax,
  coffeeSyntax,
  gruvboxSyntax,
  githubDarkSyntax,
  highContrastSyntax,
  vscodeSyntax,
} from './themes';
import { settingsService, ThemeMode } from '../services/settings';

interface ThemeContextValue {
  colors: ThemeColors;
  syntax: SyntaxColors;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setCustomThemeColors: (colors: Partial<ThemeColors>) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  syntax: darkSyntax,
  themeMode: 'dark',
  isDark: true,
  setThemeMode: async () => {},
  setCustomThemeColors: async () => {},
});

const customHexKeys: (keyof ThemeColors)[] = [
  'bg',
  'surfaceElevated',
  'surfaceLight',
  'inputBg',
  'text',
  'textSecondary',
  'textTertiary',
  'accent',
  'userBubble',
  'aiBubble',
  'border',
  'codeBg',
  'danger',
  'warning',
  'success',
];

function sanitizeCustomColors(colors: Partial<ThemeColors> | null): Partial<ThemeColors> {
  const next = { ...(colors || {}) };
  for (const key of customHexKeys) {
    const value = next[key];
    if (value && !/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)) {
      delete next[key];
    }
  }
  return next;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [customColors, setCustomColors] = useState<Partial<ThemeColors> | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      settingsService.getThemeMode(),
      settingsService.getCustomThemeColors(),
    ]).then(([mode, storedCustomColors]) => {
      setThemeModeState(mode);
      setCustomColors(sanitizeCustomColors(storedCustomColors as Partial<ThemeColors> | null));
      setLoaded(true);
    });
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await settingsService.setThemeMode(mode);
  }, []);

  const setCustomThemeColors = useCallback(async (colors: Partial<ThemeColors>) => {
    const sanitized = sanitizeCustomColors(colors);
    setCustomColors(sanitized);
    await settingsService.setCustomThemeColors(sanitized as Record<string, string>);
  }, []);

  const resolvedTheme = useMemo<Exclude<ThemeMode, 'system'>>(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'light' ? 'light' : 'dark';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  const colors = useMemo<ThemeColors>(() => {
    if (resolvedTheme === 'dark') return darkColors;
    if (resolvedTheme === 'coffee') return coffeeColors;
    if (resolvedTheme === 'vscode') return vscodeColors;
    if (resolvedTheme === 'githubDark') return githubDarkColors;
    if (resolvedTheme === 'gruvbox') return gruvboxColors;
    if (resolvedTheme === 'highContrast') return highContrastColors;
    if (resolvedTheme === 'custom') return { ...customDefaultColors, ...sanitizeCustomColors(customColors) };
    return lightColors;
  }, [resolvedTheme, customColors]);

  const syntax = useMemo<SyntaxColors>(() => {
    if (resolvedTheme === 'dark') return darkSyntax;
    if (resolvedTheme === 'coffee' || resolvedTheme === 'custom') return coffeeSyntax;
    if (resolvedTheme === 'vscode') return vscodeSyntax;
    if (resolvedTheme === 'githubDark') return githubDarkSyntax;
    if (resolvedTheme === 'gruvbox') return gruvboxSyntax;
    if (resolvedTheme === 'highContrast') return highContrastSyntax;
    return lightSyntax;
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    colors,
    syntax,
    themeMode,
    isDark: resolvedTheme !== 'light' && resolvedTheme !== 'coffee' && resolvedTheme !== 'custom',
    setThemeMode,
    setCustomThemeColors,
  }), [colors, syntax, resolvedTheme, themeMode, setThemeMode, setCustomThemeColors]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

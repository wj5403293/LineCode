import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeColors, SyntaxColors, darkColors, lightColors, darkSyntax, lightSyntax } from './themes';
import { settingsService, ThemeMode } from '../services/settings';

interface ThemeContextValue {
  colors: ThemeColors;
  syntax: SyntaxColors;
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  syntax: darkSyntax,
  themeMode: 'dark',
  isDark: true,
  setThemeMode: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    settingsService.getThemeMode().then(mode => {
      setThemeModeState(mode);
      setLoaded(true);
    });
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await settingsService.setThemeMode(mode);
  }, []);

  const resolvedTheme = useMemo<'dark' | 'light'>(() => {
    if (themeMode === 'system') {
      return systemColorScheme === 'light' ? 'light' : 'dark';
    }
    return themeMode;
  }, [themeMode, systemColorScheme]);

  const value = useMemo<ThemeContextValue>(() => ({
    colors: resolvedTheme === 'dark' ? darkColors : lightColors,
    syntax: resolvedTheme === 'dark' ? darkSyntax : lightSyntax,
    themeMode,
    isDark: resolvedTheme === 'dark',
    setThemeMode,
  }), [resolvedTheme, themeMode, setThemeMode]);

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

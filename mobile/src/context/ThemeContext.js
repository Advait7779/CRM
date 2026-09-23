import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@crm_app_theme';

export const COLORS = {
  brand: {
    primary: '#6366f1',
    primaryDark: '#4f46e5',
    primaryLight: '#818cf8',
    accent: '#8b5cf6',
  },
  dark: {
    background: '#090d16',
    card: '#131b2e',
    cardSecondary: '#1e293b',
    border: '#243048',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    textSecondary: '#cbd5e1',
    inputBg: '#0f172a',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#3b82f6',
    statusNew: '#38bdf8',
    statusContacted: '#c084fc',
    statusWon: '#10b981',
    statusLost: '#ef4444',
    tabBarBg: '#0b1120',
    tabBarBorder: '#1e293b',
  },
  light: {
    background: '#f8fafc',
    card: '#ffffff',
    cardSecondary: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#64748b',
    textSecondary: '#475569',
    inputBg: '#ffffff',
    danger: '#ef4444',
    warning: '#f59e0b',
    success: '#10b981',
    info: '#3b82f6',
    statusNew: '#0284c7',
    statusContacted: '#7e22ce',
    statusWon: '#047857',
    statusLost: '#dc2626',
    tabBarBg: '#ffffff',
    tabBarBorder: '#e2e8f0',
  }
};

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then(saved => setIsDark(saved === 'dark'))
      .catch(() => setIsDark(false));
  }, []);

  const toggleTheme = async () => {
    const next = !isDark;
    setIsDark(next);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next ? 'dark' : 'light');
  };

  const theme = {
    isDark,
    toggleTheme,
    colors: {
      ...(isDark ? COLORS.dark : COLORS.light),
      ...COLORS.brand
    },
    fonts: {
      body: 'Inter_400Regular',
      medium: 'Inter_500Medium',
      semibold: 'Inter_600SemiBold',
      bold: 'Inter_700Bold',
      heading: 'PlusJakartaSans_700Bold',
      headingStrong: 'PlusJakartaSans_800ExtraBold'
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

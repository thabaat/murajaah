import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { MD3LightTheme, MD3DarkTheme } from 'react-native-paper';
import { getSettings } from '../services/database/settings';

// Create a custom theme that extends MD3Theme
const customLightTheme = {
  ...MD3LightTheme,
  // Add any custom colors or overrides here
  colors: {
    ...MD3LightTheme.colors,
    primary: '#2196F3',
    secondary: '#4CAF50',
    tertiary: '#9C27B0',
  },
};

const customDarkTheme = {
  ...MD3DarkTheme,
  // Add any custom colors or overrides here
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#64B5F6',
    secondary: '#81C784',
    tertiary: '#BA68C8',
  },
};

type ThemeContextType = {
  isDarkMode: boolean;
  theme: typeof customLightTheme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>('system');
  
  useEffect(() => {
    // Load theme preference from settings
    const loadThemePreference = async () => {
      const settings = await getSettings();
      setThemeMode(settings.theme as 'light' | 'dark' | 'system');
    };
    
    loadThemePreference();
  }, []);

  const isDarkMode =
    themeMode === 'system'
      ? systemColorScheme === 'dark'
      : themeMode === 'dark';

  const theme = isDarkMode ? customDarkTheme : customLightTheme;

  const toggleTheme = () => {
    setThemeMode(current => (current === 'dark' ? 'light' : 'dark'));
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useAppTheme must be used within a ThemeProvider');
  }
  return context;
}
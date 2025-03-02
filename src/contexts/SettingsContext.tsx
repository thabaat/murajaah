import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserSettings } from '../types';
import { getSettings, updateSettings, resetSettings } from '../services/database/settings';

interface SettingsContextType {
  settings: UserSettings | null;
  loading: boolean;
  error: string | null;
  updateUserSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
  resetUserSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: null,
  loading: true,
  error: null,
  updateUserSettings: async () => {},
  resetUserSettings: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

interface SettingsProviderProps {
  children: ReactNode;
}

export const SettingsProvider: React.FC<SettingsProviderProps> = ({ children }) => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const userSettings = await getSettings();
        setSettings(userSettings);
      } catch (err) {
        console.error('Error loading settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  // Update settings
  const updateUserSettings = async (newSettings: Partial<UserSettings>) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!settings) {
        throw new Error('Settings not initialized');
      }
      
      const updatedSettings = await updateSettings(newSettings);
      setSettings(updatedSettings);
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Failed to update settings');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Reset settings to default
  const resetUserSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const defaultSettings = await resetSettings();
      setSettings(defaultSettings);
    } catch (err) {
      console.error('Error resetting settings:', err);
      setError('Failed to reset settings');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value = {
    settings,
    loading,
    error,
    updateUserSettings,
    resetUserSettings,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export default SettingsContext;
import React, { ReactNode, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { SettingsProvider } from './SettingsContext';
import { AppThemeProvider, useAppTheme } from './ThemeContext';
import { SessionProvider } from './SessionContext';
import { initDatabase, loadInitialData } from '../services/database';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Audio } from 'expo-av';
import { Amiri_400Regular, Amiri_700Bold, Amiri_400Regular_Italic, Amiri_700Bold_Italic } from '@expo-google-fonts/amiri';
// Keep the splash screen visible while we initialize resources
SplashScreen.preventAutoHideAsync();

// Inner provider that needs the theme context
const InnerProviders = ({ children }: { children: ReactNode }) => {
  const { theme } = useAppTheme();
  
  return (
    <PaperProvider theme={theme}>
      <SessionProvider>
        {children}
      </SessionProvider>
    </PaperProvider>
  );
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [appIsReady, setAppIsReady] = useState(false);

  // Initialize app resources
  useEffect(() => {
    async function prepare() {
      try {
        console.log('Initializing app resources...');
        
        // Initialize the database
        await initDatabase();
        console.log('Database initialized');
        
        // Load initial data
        await loadInitialData();
        console.log('Initial data loaded');

        // Initialize audio system
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
            playThroughEarpieceAndroid: false,
          });
          console.log('Global audio mode configured successfully');
        } catch (audioError) {
          console.error('Error initializing audio:', audioError);
        }

        // Load custom fonts
        await Font.loadAsync({
          Amiri_400Regular,
          Amiri_700Bold,
          Amiri_400Regular_Italic,
          Amiri_700Bold_Italic,
        });
        console.log('Fonts loaded');
        
        console.log('App resources initialized successfully');
      } catch (e) {
        console.error('Error loading app resources:', e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    // Make sure to await the prepare function
    prepare().catch(error => {
      console.error('Unhandled error in prepare function:', error);
      // Even if there's an error, we should still set appIsReady to true
      // so the app can render and show an error message if needed
      setAppIsReady(true);
    });
  }, []);

  // Handle when the app is ready
  const onLayoutRootView = React.useCallback(async () => {
    if (appIsReady) {
      try {
        // Hide the splash screen
        await SplashScreen.hideAsync();
      } catch (e) {
        console.error('Error hiding splash screen:', e);
      }
    }
  }, [appIsReady]);
  
  if (!appIsReady) {
    return null;
  }

  return (
    <SafeAreaProvider onLayout={onLayoutRootView}>
      <SettingsProvider>
        <AppThemeProvider>
          <InnerProviders>
            {children}
          </InnerProviders>
        </AppThemeProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
};

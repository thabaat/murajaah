import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Switch, Platform } from 'react-native';
import { 
  Text, 
  Button, 
  useTheme, 
  ActivityIndicator, 
  Card,
  Divider,
  List,
  TouchableRipple,
  Portal,
  Dialog,
  RadioButton,
} from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSettings } from '../../contexts/SettingsContext';
import { useAppTheme } from '../../contexts/ThemeContext';
import { clearCache, calculateCacheSize, getFileSizeString } from '../../utils/storage';
import { resetAllProgress } from '../../services/database/ayahProgress';
import { downloadQuranForOffline } from '../../services/quran/api';
import { ThemeType } from '../../contexts/ThemeContext';

export default function SettingsScreen() {
  const theme = useTheme();
  const { themeType, setTheme, isDarkMode } = useAppTheme();
  const { settings, updateUserSettings, resetUserSettings, loading: settingsLoading } = useSettings();
  
  const [loading, setLoading] = useState(false);
  const [cacheSize, setCacheSize] = useState('Calculating...');
  const [resetDialogVisible, setResetDialogVisible] = useState(false);
  const [themeDialogVisible, setThemeDialogVisible] = useState(false);
  const [scriptDialogVisible, setScriptDialogVisible] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  
  // Get cache size
  useEffect(() => {
    const getCacheSize = async () => {
      const size = await calculateCacheSize();
      setCacheSize(getFileSizeString(size));
    };
    
    getCacheSize();
  }, []);
  
  // Handle theme change
  const handleThemeChange = (newTheme: ThemeType) => {
    setTheme(newTheme);
    setThemeDialogVisible(false);
  };
  
  // Handle toggling audio
  const handleToggleAudio = async (value: boolean) => {
    try {
      await updateUserSettings({ audioEnabled: value });
    } catch (error) {
      console.error('Error updating audio setting:', error);
    }
  };
  
  // Handle offline mode toggle
  const handleToggleOfflineMode = async (value: boolean) => {
    try {
      setLoading(true);
      
      if (value) {
        // Download Quran for offline use
        await downloadQuranForOffline((progress) => {
          setDownloadProgress(progress);
        });
      }
      
      await updateUserSettings({ offlineMode: value });
      setLoading(false);
    } catch (error) {
      console.error('Error updating offline mode:', error);
      setLoading(false);
    }
  };
  
  // Handle clearing cache
  const handleClearCache = async () => {
    try {
      setLoading(true);
      await clearCache();
      setCacheSize('0 B');
      setLoading(false);
    } catch (error) {
      console.error('Error clearing cache:', error);
      setLoading(false);
    }
  };
  
  // Handle reset confirmation
  const handleResetConfirm = async () => {
    try {
      setLoading(true);
      await resetAllProgress();
      await resetUserSettings();
      setResetDialogVisible(false);
      setLoading(false);
      
      // Return to home
      router.replace('/');
    } catch (error) {
      console.error('Error resetting app:', error);
      setLoading(false);
      setResetDialogVisible(false);
    }
  };
  
  // Handle changing new ayahs per day
  const handleNewAyahsChange = async (value: number) => {
    try {
      const newValue = Math.round(value);
      await updateUserSettings({ newAyahsPerDay: newValue });
    } catch (error) {
      console.error('Error updating new ayahs setting:', error);
    }
  };
  
  // Handle changing review limit
  const handleReviewLimitChange = async (value: number) => {
    try {
      const newValue = Math.round(value);
      await updateUserSettings({ reviewLimit: newValue });
    } catch (error) {
      console.error('Error updating review limit setting:', error);
    }
  };
  
  // Handle changing grouping method
  const handleGroupingMethodChange = async (method: 'recommended' | 'fixed' | 'ruku' | 'page') => {
    try {
      await updateUserSettings({ groupingMethod: method });
    } catch (error) {
      console.error('Error updating grouping method:', error);
    }
  };
  
  // Handle changing grouping size
  const handleGroupingSizeChange = async (value: number) => {
    try {
      const newValue = Math.round(value);
      await updateUserSettings({ groupingSize: newValue });
    } catch (error) {
      console.error('Error updating grouping size:', error);
    }
  };
  
  // Handle script change
  const handleScriptChange = async (script: 'uthmani' | 'indopak') => {
    try {
      await updateUserSettings({ quranScript: script });
      setScriptDialogVisible(false);
    } catch (error) {
      console.error('Error updating script setting:', error);
    }
  };
  
  if (settingsLoading || !settings) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.content}>
        {/* App Theme */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Appearance
            </Text>
            
            <TouchableRipple onPress={() => setThemeDialogVisible(true)}>
              <List.Item
                title="Theme"
                description={getThemeDescription(themeType)}
                left={props => <List.Icon {...props} icon="theme-light-dark" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
              />
            </TouchableRipple>
            
            <TouchableRipple onPress={() => setScriptDialogVisible(true)}>
              <List.Item
                title="Quran Script"
                description={getScriptDescription(settings.quranScript)}
                left={props => <List.Icon {...props} icon="format-text" />}
                right={props => <List.Icon {...props} icon="chevron-right" />}
              />
            </TouchableRipple>
          </Card.Content>
        </Card>
        
        {/* Study Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Study Settings
            </Text>
            
            <View style={styles.settingRow}>
              <Text variant="titleMedium">New Ayahs Per Day</Text>
              <Text variant="bodyMedium" style={styles.settingDescription}>
                {settings.newAyahsPerDay}
              </Text>
            </View>
            
            <Slider
              value={settings.newAyahsPerDay}
              onValueChange={value => {}}
              onSlidingComplete={handleNewAyahsChange}
              minimumValue={1}
              maximumValue={20}
              step={1}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.surfaceVariant}
              thumbTintColor={theme.colors.primary}
              style={styles.slider}
            />
            
            <View style={styles.settingRow}>
              <Text variant="titleMedium">Daily Review Limit</Text>
              <Text variant="bodyMedium" style={styles.settingDescription}>
                {settings.reviewLimit}
              </Text>
            </View>
            
            <Slider
              value={settings.reviewLimit}
              onValueChange={value => {}}
              onSlidingComplete={handleReviewLimitChange}
              minimumValue={10}
              maximumValue={200}
              step={10}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor={theme.colors.surfaceVariant}
              thumbTintColor={theme.colors.primary}
              style={styles.slider}
            />
            
            <Divider style={styles.divider} />
            
            <TouchableRipple onPress={() => {}}>
              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text variant="titleMedium">Auto-Play Audio</Text>
                  <Text variant="bodyMedium" style={styles.settingDescription}>
                    Automatically play audio during review
                  </Text>
                </View>
                <Switch
                  value={settings.audioEnabled}
                  onValueChange={handleToggleAudio}
                  color={theme.colors.primary}
                />
              </View>
            </TouchableRipple>
          </Card.Content>
        </Card>
        
        {/* Ayah Grouping */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Ayah Grouping
            </Text>
            
            <View style={styles.radioGroup}>
              <RadioButton.Group
                onValueChange={value => 
                  handleGroupingMethodChange(value as 'recommended' | 'fixed' | 'ruku' | 'page')
                }
                value={settings.groupingMethod}
              >
                <RadioButton.Item
                  label="Recommended Groupings"
                  value="recommended"
                  style={styles.radioItem}
                />
                <RadioButton.Item
                  label="Fixed Size Groups"
                  value="fixed"
                  style={styles.radioItem}
                />
                <RadioButton.Item
                  label="Ruku-Based Grouping"
                  value="ruku"
                  style={styles.radioItem}
                />
                <RadioButton.Item
                  label="Page-Based Grouping"
                  value="page"
                  style={styles.radioItem}
                />
              </RadioButton.Group>
            </View>
            
            {settings.groupingMethod === 'fixed' && (
              <>
                <View style={styles.settingRow}>
                  <Text variant="titleMedium">Group Size</Text>
                  <Text variant="bodyMedium" style={styles.settingDescription}>
                    {settings.groupingSize} ayahs
                  </Text>
                </View>
                
                <Slider
                  value={settings.groupingSize}
                  onValueChange={value => {}}
                  onSlidingComplete={handleGroupingSizeChange}
                  minimumValue={1}
                  maximumValue={15}
                  step={1}
                  minimumTrackTintColor={theme.colors.primary}
                  maximumTrackTintColor={theme.colors.surfaceVariant}
                  thumbTintColor={theme.colors.primary}
                  style={styles.slider}
                />
              </>
            )}
          </Card.Content>
        </Card>
        
        {/* Storage */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Storage
            </Text>
            
            <TouchableRipple onPress={() => {}}>
              <View style={styles.switchRow}>
                <View style={styles.switchText}>
                  <Text variant="titleMedium">Offline Mode</Text>
                  <Text variant="bodyMedium" style={styles.settingDescription}>
                    Store Quran text and audio for offline use
                  </Text>
                </View>
                <Switch
                  value={settings.offlineMode}
                  onValueChange={handleToggleOfflineMode}
                  color={theme.colors.primary}
                  disabled={loading}
                />
              </View>
            </TouchableRipple>
            
            {loading && downloadProgress > 0 && (
              <View style={styles.progressContainer}>
                <Text variant="bodyMedium" style={styles.progressText}>
                  Downloading: {Math.round(downloadProgress * 100)}%
                </Text>
              </View>
            )}
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="Cache Size"
              description={cacheSize}
              left={props => <List.Icon {...props} icon="folder-outline" />}
            />
            
            <View style={styles.cacheActions}>
              <Button 
                mode="outlined" 
                onPress={handleClearCache}
                loading={loading}
                disabled={loading}
              >
                Clear Cache
              </Button>
            </View>
          </Card.Content>
        </Card>
        
        {/* About */}
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              About
            </Text>
            
            <List.Item
              title="Version"
              description="1.0.0"
              left={props => <List.Icon {...props} icon="information-outline" />}
            />
            
            <Divider style={styles.divider} />
            
            <List.Item
              title="About Muraja'ah"
              description="Learn more about the app"
              left={props => <List.Icon {...props} icon="help-circle-outline" />}
              onPress={() => {}}
            />
            
            <List.Item
              title="Privacy Policy"
              description="Read our privacy policy"
              left={props => <List.Icon {...props} icon="shield-account-outline" />}
              onPress={() => {}}
            />
          </Card.Content>
        </Card>
        
        {/* Reset */}
        <Card style={[styles.card, { marginBottom: 32 }]}>
          <Card.Content>
            <Text variant="titleLarge" style={[styles.cardTitle, { color: theme.colors.error }]}>
              Reset App
            </Text>
            
            <Text variant="bodyMedium" style={styles.resetDescription}>
              This will delete all your progress and reset the app to its initial state. This action cannot be undone.
            </Text>
            
            <Button
              mode="outlined"
              textColor={theme.colors.error}
              style={[styles.resetButton, { borderColor: theme.colors.error }]}
              onPress={() => setResetDialogVisible(true)}
            >
              Reset App
            </Button>
          </Card.Content>
        </Card>
      </ScrollView>
      
      {/* Theme Dialog */}
      <Portal>
        <Dialog visible={themeDialogVisible} onDismiss={() => setThemeDialogVisible(false)}>
          <Dialog.Title>Choose Theme</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group onValueChange={value => handleThemeChange(value as ThemeType)} value={themeType}>
              <RadioButton.Item label="Light" value="light" />
              <RadioButton.Item label="Dark" value="dark" />
              <RadioButton.Item label="Use System Settings" value="system" />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setThemeDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Reset Confirmation Dialog */}
      <Portal>
        <Dialog visible={resetDialogVisible} onDismiss={() => setResetDialogVisible(false)}>
          <Dialog.Title>Reset App?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to reset the app? This will delete all your progress and settings.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setResetDialogVisible(false)}>Cancel</Button>
            <Button 
              textColor={theme.colors.error} 
              onPress={handleResetConfirm}
              loading={loading}
              disabled={loading}
            >
              Reset
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      
      {/* Script Selection Dialog */}
      <Portal>
        <Dialog
          visible={scriptDialogVisible}
          onDismiss={() => setScriptDialogVisible(false)}
          style={{ backgroundColor: theme.colors.surface }}
        >
          <Dialog.Title>Quran Script</Dialog.Title>
          <Dialog.Content>
            <RadioButton.Group
              onValueChange={value => handleScriptChange(value as 'uthmani' | 'indopak')}
              value={settings.quranScript}
            >
              <RadioButton.Item
                label="Uthmani"
                value="uthmani"
                status={settings.quranScript === 'uthmani' ? 'checked' : 'unchecked'}
              />
              <RadioButton.Item
                label="IndoPak"
                value="indopak"
                status={settings.quranScript === 'indopak' ? 'checked' : 'unchecked'}
              />
            </RadioButton.Group>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setScriptDialogVisible(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

// Helper function to get theme description
const getThemeDescription = (themeType: ThemeType) => {
  switch (themeType) {
    case 'light':
      return 'Light mode';
    case 'dark':
      return 'Dark mode';
    case 'system':
      return 'Follow system settings';
    default:
      return 'Follow system settings';
  }
};

// Helper function to get script description
const getScriptDescription = (script: 'uthmani' | 'indopak') => {
  switch (script) {
    case 'uthmani':
      return 'Uthmani Script';
    case 'indopak':
      return 'IndoPak Script';
    default:
      return 'Uthmani Script';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 16,
  },
  divider: {
    marginVertical: 16,
  },
  slider: {
    marginBottom: 16,
    height: 40,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingDescription: {
    opacity: 0.7,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchText: {
    flex: 1,
  },
  radioGroup: {
    marginBottom: 16,
  },
  radioItem: {
    paddingVertical: 2,
  },
  cacheActions: {
    alignItems: 'flex-start',
    marginTop: 8,
  },
  progressContainer: {
    marginTop: 8,
    alignItems: 'center',
  },
  progressText: {
    marginBottom: 8,
  },
  resetDescription: {
    marginBottom: 16,
    color: 'red',
    opacity: 0.7,
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
});
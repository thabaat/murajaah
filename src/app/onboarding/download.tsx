import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Image } from 'react-native';
import { Text, Button, useTheme, Card, Title, Paragraph, ProgressBar } from 'react-native-paper';
import { downloadQuranForOffline } from '../../services/quran/api';
import { useSettings } from '../../contexts/SettingsContext';
import { fetchSurahs } from '../../services/quran/api';
import { calculateCacheSize, getFileSizeString } from '../../utils/storage';

interface DownloadScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export default function DownloadScreen({ onNext, onBack }: DownloadScreenProps) {
  const theme = useTheme();
  const { settings, updateUserSettings } = useSettings();
  
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [estimatedSize, setEstimatedSize] = useState('~50MB');
  const [error, setError] = useState<string | null>(null);
  const [currentCacheSize, setCurrentCacheSize] = useState('0 MB');

  // Get current cache size and estimate full download size
  useEffect(() => {
    const loadSizes = async () => {
      try {
        // Get current cache size
        const cacheSize = await calculateCacheSize();
        setCurrentCacheSize(getFileSizeString(cacheSize));
        
        // Estimate full size based on number of surahs
        const surahs = await fetchSurahs();
        const estimatedBytes = surahs.length * 500 * 1024; // ~500KB per surah (rough estimate)
        setEstimatedSize(getFileSizeString(estimatedBytes));
      } catch (err) {
        console.error('Error calculating sizes:', err);
      }
    };
    
    loadSizes();
  }, []);

  // Handle download
  const handleDownload = async () => {
    try {
      setDownloading(true);
      setError(null);
      setDownloadProgress(0);
      
      // Start download with progress callback
      await downloadQuranForOffline((progress) => {
        setDownloadProgress(progress);
      });
      
      // Update settings
      await updateUserSettings({ offlineMode: true });
      
      // Get updated cache size
      const cacheSize = await calculateCacheSize();
      setCurrentCacheSize(getFileSizeString(cacheSize));
      
      // Complete download
      setDownloading(false);
      setDownloadProgress(1);
    } catch (err) {
      console.error('Error downloading Quran:', err);
      setError('Failed to download. Please try again or skip this step.');
      setDownloading(false);
    }
  };

  // Skip download
  const handleSkip = async () => {
    try {
      await updateUserSettings({ offlineMode: false });
      onNext();
    } catch (err) {
      console.error('Error updating settings:', err);
      setError('Failed to update settings. Please try again.');
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text variant="headlineSmall" style={styles.title}>
        Download the Quran
      </Text>
      
      <Text variant="bodyMedium" style={styles.description}>
        Download the complete Quran text and audio for offline use. This ensures
        Muraja'ah works anywhere, even without an internet connection.
      </Text>
      
      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}
      
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.downloadIconContainer}>
            <Image
              source={require('@expo/vector-icons/MaterialCommunityIcons')}
              style={styles.downloadIcon}
              resizeMode="contain"
            />
          </View>
          
          <Title style={styles.cardTitle}>Offline Mode</Title>
          
          <Paragraph style={styles.cardDescription}>
            Download the complete Quran text and Abdullah Basfar's recitation
            audio (estimated size: {estimatedSize}).
          </Paragraph>
          
          {downloadProgress > 0 && (
            <View style={styles.progressContainer}>
              <ProgressBar
                progress={downloadProgress}
                color={theme.colors.primary}
                style={styles.progressBar}
              />
              <Text style={styles.progressText}>
                {Math.round(downloadProgress * 100)}% Complete
              </Text>
            </View>
          )}
          
          <View style={styles.infoContainer}>
            <Text variant="bodySmall" style={styles.infoText}>
              Current cache size: {currentCacheSize}
            </Text>
            <Text variant="bodySmall" style={styles.infoText}>
              You can change this setting later.
            </Text>
          </View>
        </Card.Content>
        
        <Card.Actions style={styles.cardActions}>
          {downloadProgress === 1 ? (
            <Button mode="contained" onPress={onNext} style={styles.fullWidthButton}>
              Continue
            </Button>
          ) : (
            <Button
              mode="contained"
              onPress={handleDownload}
              loading={downloading}
              disabled={downloading}
              style={styles.fullWidthButton}
            >
              {downloading ? 'Downloading...' : 'Download Now'}
            </Button>
          )}
        </Card.Actions>
      </Card>
      
      <View style={styles.buttonsContainer}>
        <Button mode="outlined" onPress={onBack} style={styles.button}>
          Back
        </Button>
        <Button mode="text" onPress={handleSkip} style={styles.button}>
          Skip for Now
        </Button>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 24,
  },
  errorText: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 24,
    elevation: 2,
  },
  downloadIconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  downloadIcon: {
    width: 80,
    height: 80,
  },
  cardTitle: {
    textAlign: 'center',
  },
  cardDescription: {
    textAlign: 'center',
    marginBottom: 16,
  },
  progressContainer: {
    marginVertical: 16,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressText: {
    textAlign: 'center',
    marginTop: 8,
  },
  infoContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  infoText: {
    textAlign: 'center',
    opacity:.7,
    marginBottom: 4,
  },
  cardActions: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  fullWidthButton: {
    width: '100%',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
});
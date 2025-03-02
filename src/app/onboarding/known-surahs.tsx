import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList } from 'react-native';
import { Text, Checkbox, Button, useTheme, Divider, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '../../contexts/SettingsContext';
import { fetchSurahs } from '../../services/quran/api';
import { Surah } from '../../types';

interface KnownSurahsScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export default function KnownSurahsScreen({ onNext, onBack }: KnownSurahsScreenProps) {
  const theme = useTheme();
  const { settings, updateUserSettings } = useSettings();
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [selectedSurahs, setSelectedSurahs] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load surahs
  useEffect(() => {
    const loadSurahs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const surahsData = await fetchSurahs();
        setSurahs(surahsData);
        
        // Set initially selected surahs from settings
        if (settings?.knownSurahs) {
          setSelectedSurahs(settings.knownSurahs);
        }
      } catch (err) {
        console.error('Error loading surahs:', err);
        setError('Failed to load surahs. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadSurahs();
  }, [settings]);

  // Toggle surah selection
  const toggleSurah = (surahNumber: number) => {
    setSelectedSurahs(prev => {
      if (prev.includes(surahNumber)) {
        return prev.filter(num => num !== surahNumber);
      } else {
        return [...prev, surahNumber];
      }
    });
  };

  // Continue to next step
  const handleContinue = async () => {
    try {
      await updateUserSettings({ knownSurahs: selectedSurahs });
      onNext();
    } catch (err) {
      console.error('Error saving known surahs:', err);
      setError('Failed to save settings. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading surahs...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <Button mode="contained" onPress={onBack}>
          Go Back
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Which surahs do you already know?
      </Text>
      
      <Text variant="bodyMedium" style={styles.description}>
        Select the surahs you've already memorized. This helps us personalize your
        learning experience.
      </Text>
      
      <FlatList
        data={surahs}
        keyExtractor={(item) => item.number.toString()}
        renderItem={({ item }) => (
          <View style={styles.surahItem}>
            <Checkbox
              status={selectedSurahs.includes(item.number) ? 'checked' : 'unchecked'}
              onPress={() => toggleSurah(item.number)}
              color={theme.colors.primary}
            />
            <View style={styles.surahInfo}>
              <Text variant="titleMedium" style={{ color: theme.colors.onBackground }}>
                {item.name}
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {item.englishName} • {item.ayahCount} ayahs
              </Text>
            </View>
            <Text style={styles.arabicName}>{item.arabicName}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <Divider />}
        style={styles.list}
      />
      
      <View style={styles.buttonsContainer}>
        <Button mode="outlined" onPress={onBack} style={styles.button}>
          Back
        </Button>
        <Button mode="contained" onPress={handleContinue} style={styles.button}>
          Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: {
    marginBottom: 24,
    textAlign: 'center',
  },
  title: {
    marginBottom: 8,
  },
  description: {
    marginBottom: 24,
  },
  list: {
    flex: 1,
    marginBottom: 16,
  },
  surahItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  surahInfo: {
    flex: 1,
    marginLeft: 8,
  },
  arabicName: {
    fontSize: 18,
    fontFamily: 'Amiri-Regular',
    marginLeft: 8,
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
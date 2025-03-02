import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Button, useTheme, Card, RadioButton, ActivityIndicator } from 'react-native-paper';
import { updateSettings } from '../../services/database/settings';
import { fetchAyahsForSurah } from '../../services/quran/api';
import { Ayah } from '../../types';

interface ScriptSelectionProps {
  onNext: () => void;
  onBack: () => void;
}

export default function ScriptSelectionScreen({ onNext, onBack }: ScriptSelectionProps) {
  const theme = useTheme();
  const [selectedScript, setSelectedScript] = useState<'uthmani' | 'indopak'>('uthmani');
  const [uthmaniAyah, setUthmaniAyah] = useState<Ayah | null>(null);
  const [indopakAyah, setIndopakAyah] = useState<Ayah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Example ayah: Surah An-Nisa (4), Ayah 1
  const EXAMPLE_SURAH = 4;
  const EXAMPLE_AYAH = 1;

  // Fetch example ayahs for both scripts
  useEffect(() => {
    const fetchExampleAyahs = async () => {
      try {
        setLoading(true);
        setError(null);

        // Temporarily override the settings to fetch Uthmani script
        await updateSettings({ quranScript: 'uthmani' });
        const uthmaniAyahs = await fetchAyahsForSurah(EXAMPLE_SURAH);
        const uthmaniExample = uthmaniAyahs.find(a => a.ayahNumber === EXAMPLE_AYAH);
        
        if (uthmaniExample) {
          setUthmaniAyah(uthmaniExample);
        }

        // Temporarily override the settings to fetch IndoPak script
        await updateSettings({ quranScript: 'indopak' });
        const indopakAyahs = await fetchAyahsForSurah(EXAMPLE_SURAH);
        const indopakExample = indopakAyahs.find(a => a.ayahNumber === EXAMPLE_AYAH);
        
        if (indopakExample) {
          setIndopakAyah(indopakExample);
        }

        // Reset to the selected script
        await updateSettings({ quranScript: selectedScript });
      } catch (err) {
        console.error('Error fetching example ayahs:', err);
        setError('Failed to load example ayahs. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchExampleAyahs();
  }, []);

  // Handle script selection
  const handleScriptChange = async (value: 'uthmani' | 'indopak') => {
    setSelectedScript(value);
    await updateSettings({ quranScript: value });
  };

  // Handle continue button
  const handleContinue = async () => {
    try {
      // Save the selected script to settings
      await updateSettings({ quranScript: selectedScript });
      onNext();
    } catch (err) {
      console.error('Error saving script preference:', err);
      setError('Failed to save your preference. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.primary }]}>
          Choose Quran Script
        </Text>
        
        <Text variant="bodyLarge" style={styles.description}>
          Select your preferred Quran script style. You can change this later in settings.
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>Loading examples...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        ) : (
          <>
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedScript === 'uthmani' && { borderColor: theme.colors.primary, borderWidth: 2 }
                ]}
                onPress={() => handleScriptChange('uthmani')}
              >
                <Card style={styles.card}>
                  <Card.Content>
                    <View style={styles.cardHeader}>
                      <RadioButton
                        value="uthmani"
                        status={selectedScript === 'uthmani' ? 'checked' : 'unchecked'}
                        onPress={() => handleScriptChange('uthmani')}
                      />
                      <Text variant="titleMedium" style={styles.cardTitle}>Uthmani Script</Text>
                    </View>
                    
                    <Text style={styles.scriptDescription}>
                      The standard script used in most Quran prints worldwide.
                    </Text>
                    
                    {uthmaniAyah && (
                      <View style={styles.previewContainer}>
                        <Text style={styles.previewLabel}>Preview:</Text>
                        <Text style={styles.arabicText}>{uthmaniAyah.text}</Text>
                        <Text style={styles.ayahReference}>Surah An-Nisa (4:1)</Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.optionCard,
                  selectedScript === 'indopak' && { borderColor: theme.colors.primary, borderWidth: 2 }
                ]}
                onPress={() => handleScriptChange('indopak')}
              >
                <Card style={styles.card}>
                  <Card.Content>
                    <View style={styles.cardHeader}>
                      <RadioButton
                        value="indopak"
                        status={selectedScript === 'indopak' ? 'checked' : 'unchecked'}
                        onPress={() => handleScriptChange('indopak')}
                      />
                      <Text variant="titleMedium" style={styles.cardTitle}>IndoPak Script</Text>
                    </View>
                    
                    <Text style={styles.scriptDescription}>
                      Popular in South Asia with more pronounced diacritical marks.
                    </Text>
                    
                    {indopakAyah && (
                      <View style={styles.previewContainer}>
                        <Text style={styles.previewLabel}>Preview:</Text>
                        <Text style={styles.arabicText}>{indopakAyah.text}</Text>
                        <Text style={styles.ayahReference}>Surah An-Nisa (4:1)</Text>
                      </View>
                    )}
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
      
      <View style={styles.buttonsContainer}>
        <Button mode="outlined" onPress={onBack} style={styles.button}>
          Back
        </Button>
        <Button 
          mode="contained" 
          onPress={handleContinue} 
          style={styles.button}
          disabled={loading}
        >
          Continue
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
  },
  errorText: {
    textAlign: 'center',
    marginVertical: 24,
  },
  optionsContainer: {
    marginTop: 16,
  },
  optionCard: {
    marginBottom: 16,
    borderRadius: 8,
  },
  card: {
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    fontWeight: 'bold',
    marginLeft: 8,
  },
  scriptDescription: {
    marginBottom: 16,
    opacity: 0.7,
  },
  previewContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 16,
    borderRadius: 8,
  },
  previewLabel: {
    marginBottom: 8,
    fontWeight: 'bold',
  },
  arabicText: {
    fontSize: 24,
    lineHeight: 40,
    textAlign: 'right',
    fontFamily: 'Amiri-Regular',
    marginBottom: 8,
  },
  ayahReference: {
    textAlign: 'right',
    opacity: 0.7,
    fontSize: 12,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
  },
}); 
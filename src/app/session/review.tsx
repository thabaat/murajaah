import React, { useEffect, useState } from 'react';
import { StyleSheet, View, BackHandler, Platform } from 'react-native';
import { Text, useTheme, ActivityIndicator, Badge, Portal, Dialog, Button as PaperButton } from 'react-native-paper';
import { useSession } from '../../contexts/SessionContext';
import { useSettings } from '../../contexts/SettingsContext';
import { router, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AyahDisplay from '../../components/AyahDisplay';
import GradingButtons from '../../components/GradingButtons';
import { fetchAyahsForSurah } from '../../services/quran/api';
import { Ayah, Rating } from '../../types';
import { calculateOptimalIntervals } from '../../services/fsrs';
import { executeQuery } from '../../services/database';

export default function ReviewScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { settings } = useSettings();
  const { 
    currentAyah, 
    totalReviewed,
    ayahs,
    ayahIndex,
    rateAyah, 
    endSession,
    loading,
    error,
    uniqueGroups,
    uniqueGroupIndex,
    totalGroups
  } = useSession();
  
  const [ayahContent, setAyahContent] = useState<Ayah | Ayah[] | null>(null);
  const [loadingAyah, setLoadingAyah] = useState(false);
  const [showArabic, setShowArabic] = useState(true);
  const [intervals, setIntervals] = useState<{ [key in Rating]: number }>({ 1: 0, 2: 1, 3: 3, 4: 7 });
  const [exitDialogVisible, setExitDialogVisible] = useState(false);
  
  // Define loadAyahContent outside useEffect so it can be called from retry button
  const loadAyahContent = async () => {
    if (!currentAyah) return;
    
    try {
      setLoadingAyah(true);
      
      // Check if this ayah should be tested with its group
      if (currentAyah.testWithGroup) {
        // Get all ayahs in this group
        const groupAyahs = await executeQuery(
          `SELECT * FROM ayah_progress 
           WHERE groupId = ? 
           ORDER BY groupPosition ASC`,
          [currentAyah.groupId]
        );
        
        // Load content for all ayahs in the group
        const ayahContents: Ayah[] = [];
        
        for (const groupAyah of groupAyahs) {
          // Fetch surah to get this ayah
          const surahAyahs = await fetchAyahsForSurah(groupAyah.surahNumber);
          
          if (!surahAyahs || surahAyahs.length === 0) {
            console.error(`No ayahs found for surah ${groupAyah.surahNumber}`);
            continue;
          }
          
          const ayah = surahAyahs.find(a => a.ayahNumber === groupAyah.ayahNumber);
          
          if (ayah) {
            // Check if we have a local audio path for this ayah
            if (!ayah.audioPath) {
              // Try to get the local path from the database
              const audioPathResult = await executeQuery(
                'SELECT audioPath FROM quran_ayahs WHERE surahNumber = ? AND ayahNumber = ?',
                [ayah.surahNumber, ayah.ayahNumber]
              );
              
              if (audioPathResult.length > 0 && audioPathResult[0].audioPath) {
                ayah.audioPath = audioPathResult[0].audioPath;
              }
            }
            
            ayahContents.push(ayah);
          } else {
            console.error(`Ayah not found: Surah ${groupAyah.surahNumber}, Ayah ${groupAyah.ayahNumber}`);
          }
        }
        
        if (ayahContents.length > 0) {
          setAyahContent(ayahContents);
        } else {
          setAyahContent(null);
        }
      } else {
        // Regular single ayah testing
        // Fetch surah to get this ayah
        const ayahs = await fetchAyahsForSurah(currentAyah.surahNumber);
        
        if (!ayahs || ayahs.length === 0) {
          console.error(`No ayahs found for surah ${currentAyah.surahNumber}`);
          setAyahContent(null);
          return;
        }
        
        const ayah = ayahs.find(a => a.ayahNumber === currentAyah.ayahNumber);
        
        if (ayah) {
          // Check if we have a local audio path for this ayah
          if (!ayah.audioPath) {
            // Try to get the local path from the database
            const audioPathResult = await executeQuery(
              'SELECT audioPath FROM quran_ayahs WHERE surahNumber = ? AND ayahNumber = ?',
              [ayah.surahNumber, ayah.ayahNumber]
            );
            
            if (audioPathResult.length > 0 && audioPathResult[0].audioPath) {
              ayah.audioPath = audioPathResult[0].audioPath;
            }
          }
          
          setAyahContent(ayah);
        } else {
          // Log specific error when ayah is not found
          console.error(`Ayah not found: Surah ${currentAyah.surahNumber}, Ayah ${currentAyah.ayahNumber}`);
          setAyahContent(null);
        }
      }
      
      // Calculate optimal intervals for this card
      if (currentAyah) {
        const card = {
          state: currentAyah.state,
          easeFactor: currentAyah.easeFactor,
          stability: currentAyah.stability,
          difficulty: currentAyah.difficulty,
          lapses: currentAyah.lapses,
          lastReview: currentAyah.lastReviewed,
          dueDate: currentAyah.nextReview,
          interval: currentAyah.interval
        };
        
        const optimalIntervals = calculateOptimalIntervals(card);
        setIntervals(optimalIntervals);
      }
    } catch (err) {
      console.error('Error loading ayah content:', err);
      // Set ayahContent to null to show error state
      setAyahContent(null);
    } finally {
      setLoadingAyah(false);
    }
  };
  
  // Load ayah content when current ayah changes
  useEffect(() => {
    loadAyahContent();
  }, [currentAyah]);
  
  // Handle back button behavior (Android)
  useEffect(() => {
    const handleBackPress = () => {
      setExitDialogVisible(true);
      return true;
    };
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    
    return () => backHandler.remove();
  }, []);
  
  // Handle exit confirmation
  const handleExitConfirm = () => {
    setExitDialogVisible(false);
    endSession();
  };
  
  // Handle exit cancel
  const handleExitCancel = () => {
    setExitDialogVisible(false);
  };
  
  // Handle rating an ayah
  const handleRate = (rating: Rating) => {
    rateAyah(rating);
  };
  
  // Toggle showing Arabic
  const toggleArabicDisplay = () => {
    setShowArabic(!showArabic);
  };
  
  // Get progress percentage
  const getProgressPercentage = () => {
    if (!ayahs.length) return 0;
    return (ayahIndex / ayahs.length) * 100;
  };
  
  // Format time for display
  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  if (loading || !currentAyah) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Preparing review session...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <PaperButton mode="contained" onPress={() => router.back()}>
          Go Back
        </PaperButton>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <View style={styles.progressInfo}>
          <Text variant="titleMedium">
            {uniqueGroupIndex + 1} / {totalGroups}
          </Text>
          <Badge style={[styles.stateBadge, { backgroundColor: getBadgeColor(currentAyah.state, theme) }]}>
            {currentAyah.state}
          </Badge>
        </View>
        
        <View style={styles.headerActions}>
          <PaperButton
            mode="text"
            compact
            onPress={toggleArabicDisplay}
          >
            {showArabic ? 'Hide Arabic' : 'Show Arabic'}
          </PaperButton>
        </View>
      </View>
      
      <View style={styles.progress}>
        <View 
          style={[
            styles.progressBar, 
            { 
              backgroundColor: theme.colors.primary,
              width: `${(uniqueGroupIndex / Math.max(totalGroups - 1, 1)) * 100}%` 
            }
          ]} 
        />
      </View>
      
      <View style={styles.content}>
        {loadingAyah ? (
          <View style={styles.ayahLoadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text>Loading ayah...</Text>
          </View>
        ) : ayahContent ? (
          <AyahDisplay
            ayah={ayahContent}
            showAyahNumber={true}
            showAudio={settings?.audioEnabled || false}
            autoPlayAudio={settings?.audioEnabled || false}
          />
        ) : (
          <View style={styles.ayahLoadingContainer}>
            <Text style={{ color: theme.colors.error, marginBottom: 8 }}>Error loading ayah content</Text>
            <Text>Surah: {currentAyah?.surahNumber}, Ayah: {currentAyah?.ayahNumber}</Text>
            <PaperButton 
              mode="contained" 
              onPress={() => loadAyahContent()} 
              style={{ marginTop: 16 }}
            >
              Retry
            </PaperButton>
          </View>
        )}
        
        <View style={styles.gradingContainer}>
          <GradingButtons
            onRate={handleRate}
            showIntervals={true}
            intervals={intervals}
            disabled={loadingAyah}
          />
        </View>
      </View>
      
      <Portal>
        <Dialog visible={exitDialogVisible} onDismiss={handleExitCancel}>
          <Dialog.Title>End Session?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Are you sure you want to end the current review session? Your progress will be saved.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={handleExitCancel}>Cancel</PaperButton>
            <PaperButton onPress={handleExitConfirm}>End Session</PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </SafeAreaView>
  );
}

// Helper function to get badge color based on ayah state
const getBadgeColor = (state: string, theme: any) => {
  switch (state) {
    case 'new':
      return theme.colors.error;
    case 'learning':
      return theme.colors.tertiary;
    case 'review':
      return theme.colors.secondary;
    case 'relearning':
      return '#FF9800'; // Orange
    default:
      return theme.colors.primary;
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  progressInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stateBadge: {
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progress: {
    height: 4,
    backgroundColor: '#E0E0E0',
    width: '100%',
  },
  progressBar: {
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  ayahLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradingContainer: {
    marginTop: 16,
  },
});
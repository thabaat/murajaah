import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, Text } from 'react-native-paper';
import { downloadAudio, testAudioUrl, getBackupAudioUrl } from '../services/quran/api';
import { Ayah } from '../types';

interface GroupAudioPlayerProps {
  ayahs: Ayah[];
  autoPlay?: boolean;
  onPlayComplete?: () => void;
}

const GroupAudioPlayer: React.FC<GroupAudioPlayerProps> = ({
  ayahs,
  autoPlay = false,
  onPlayComplete
}) => {
  const theme = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [volume, setVolume] = useState<number>(1.0);
  
  // Use refs to keep track of state in callbacks
  const isPlayingRef = useRef(isPlaying);
  const currentAyahIndexRef = useRef(currentAyahIndex);
  
  // Update refs when state changes
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    currentAyahIndexRef.current = currentAyahIndex;
  }, [isPlaying, currentAyahIndex]);
  
  // Initialize audio session
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Error setting up audio mode:', error);
      }
    };
    
    setupAudio();
  }, []);
  
  // Clean up sound when component unmounts
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);
  
  // Load and play the current ayah
  const loadAndPlayAyah = async (index: number) => {
    if (index < 0 || index >= ayahs.length) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Unload previous sound if exists
      if (sound) {
        await sound.unloadAsync();
      }
      
      const ayah = ayahs[index];
      let audioSource = { uri: ayah.audioUrl };
      
      // Try to use local audio if available
      if (ayah.audioPath) {
        audioSource = { uri: ayah.audioPath };
      } else {
        // Try to download if not available locally
        try {
          const path = await downloadAudio(ayah.surahNumber, ayah.ayahNumber);
          if (path) {
            audioSource = { uri: path };
          }
        } catch (downloadError) {
          console.error('Error downloading audio:', downloadError);
          // Fall back to streaming URL
        }
      }
      
      // Create and load the sound
      try {
        const { sound: newSound } = await Audio.Sound.createAsync(
          audioSource,
          { shouldPlay: autoPlay || isPlayingRef.current, volume: volume },
          onPlaybackStatusUpdate
        );
        
        setSound(newSound);
        setIsLoading(false);
        
        // If we were playing or autoPlay is true, start playing
        if (autoPlay || isPlayingRef.current) {
          await newSound.playAsync();
          setIsPlaying(true);
        }
      } catch (soundError) {
        console.error('Error loading primary audio source:', soundError);
        
        // Try backup URL if primary URL fails and we're not using a local path
        if (!ayah.audioPath) {
          const backupUrl = getBackupAudioUrl(ayah.surahNumber, ayah.ayahNumber);
          
          // Test if the backup URL is accessible
          const isBackupAvailable = await testAudioUrl(backupUrl);
          
          if (isBackupAvailable) {
            console.log(`Using backup URL for ayah ${ayah.surahNumber}:${ayah.ayahNumber}`);
            
            const { sound: backupSound } = await Audio.Sound.createAsync(
              { uri: backupUrl },
              { shouldPlay: autoPlay || isPlayingRef.current, volume: volume },
              onPlaybackStatusUpdate
            );
            
            setSound(backupSound);
            setIsLoading(false);
            
            // If we were playing or autoPlay is true, start playing
            if (autoPlay || isPlayingRef.current) {
              await backupSound.playAsync();
              setIsPlaying(true);
            }
          } else {
            throw new Error('Both primary and backup URLs failed');
          }
        } else {
          throw soundError;
        }
      }
    } catch (error) {
      console.error('Error loading sound:', error);
      setError('Could not load audio');
      setIsLoading(false);
    }
  };
  
  // Handle audio playback status updates
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    
    setIsPlaying(status.isPlaying);
    
    // Handle playback completion
    if (status.didJustFinish) {
      // Move to next ayah if available
      if (currentAyahIndexRef.current < ayahs.length - 1) {
        const nextIndex = currentAyahIndexRef.current + 1;
        setCurrentAyahIndex(nextIndex);
        loadAndPlayAyah(nextIndex);
      } else {
        // We've reached the end of the group
        if (onPlayComplete) {
          onPlayComplete();
        }
      }
    }
  };
  
  // Load the current ayah when the index changes
  useEffect(() => {
    loadAndPlayAyah(currentAyahIndex);
  }, [currentAyahIndex]);
  
  // Play/pause audio
  const togglePlayback = async () => {
    if (!sound) return;
    
    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
    }
  };
  
  // Go to previous ayah
  const previousAyah = () => {
    if (currentAyahIndex > 0) {
      setCurrentAyahIndex(currentAyahIndex - 1);
    }
  };
  
  // Go to next ayah
  const nextAyah = () => {
    if (currentAyahIndex < ayahs.length - 1) {
      setCurrentAyahIndex(currentAyahIndex + 1);
    }
  };
  
  // Restart from the beginning
  const restart = () => {
    setCurrentAyahIndex(0);
  };
  
  return (
    <View style={styles.container}>
      {isLoading ? (
        <ActivityIndicator color={theme.colors.primary} size="small" />
      ) : error ? (
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={24} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.error }]}>
            {error}
          </Text>
        </View>
      ) : (
        <View style={styles.audioContainer}>
          <View style={styles.controls}>
            <TouchableOpacity onPress={restart} style={styles.button} disabled={currentAyahIndex === 0 && !isPlaying}>
              <MaterialIcons
                name="replay"
                size={24}
                color={currentAyahIndex === 0 && !isPlaying ? theme.colors.outline : theme.colors.primary}
              />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={previousAyah} style={styles.button} disabled={currentAyahIndex === 0}>
              <MaterialIcons
                name="skip-previous"
                size={24}
                color={currentAyahIndex === 0 ? theme.colors.outline : theme.colors.primary}
              />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
              <MaterialIcons
                name={isPlaying ? 'pause' : 'play-arrow'}
                size={30}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={nextAyah} style={styles.button} disabled={currentAyahIndex === ayahs.length - 1}>
              <MaterialIcons
                name="skip-next"
                size={24}
                color={currentAyahIndex === ayahs.length - 1 ? theme.colors.outline : theme.colors.primary}
              />
            </TouchableOpacity>
            
            <Text style={styles.ayahCounter}>
              {currentAyahIndex + 1}/{ayahs.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  errorText: {
    marginLeft: 8,
  },
  audioContainer: {
    padding: 8,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    padding: 8,
  },
  playButton: {
    padding: 8,
    marginHorizontal: 16,
  },
  ayahCounter: {
    marginLeft: 8,
    fontSize: 12,
    opacity: 0.7,
  }
});

export default GroupAudioPlayer; 
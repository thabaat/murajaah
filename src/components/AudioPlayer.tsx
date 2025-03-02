import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Slider from '@react-native-community/slider';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, Text } from 'react-native-paper';
import { downloadAudio, testAudioUrl, getBackupAudioUrl } from '../services/quran/api';

interface AudioPlayerProps {
  surahNumber: number;
  ayahNumber: number;
  audioUrl: string;
  audioPath?: string;
  autoPlay?: boolean;
  onPlayComplete?: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  surahNumber,
  ayahNumber,
  audioUrl,
  audioPath,
  autoPlay = false,
  onPlayComplete
}) => {
  const theme = useTheme();
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localAudioPath, setLocalAudioPath] = useState<string | undefined>(audioPath);
  const [volume, setVolume] = useState<number>(1.0);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [currentAudioUrl, setCurrentAudioUrl] = useState<string>(audioUrl);

  // Initialize audio session
  useEffect(() => {
    const setupAudio = async () => {
      try {
        // Configure audio mode for playback
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
        console.log('Audio mode configured successfully');
      } catch (error) {
        console.error('Error setting up audio mode:', error);
        setDebugInfo('Error setting up audio: ' + JSON.stringify(error));
      }
    };
    
    setupAudio();
  }, []);

  // Load sound
  useEffect(() => {
    let mounted = true;
    
    const loadSound = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setDebugInfo('Loading audio...');
        
        // If we don't have a local path, try to download the audio
        if (!localAudioPath) {
          try {
            setDebugInfo('Downloading audio...');
            const path = await downloadAudio(surahNumber, ayahNumber);
            if (mounted) {
              setLocalAudioPath(path);
              setDebugInfo('Downloaded to: ' + path);
            }
          } catch (downloadError) {
            console.error('Error downloading audio:', downloadError);
            setDebugInfo('Download error: ' + JSON.stringify(downloadError));
            // If download fails, we'll fall back to streaming from URL
          }
        }
        
        // Create and load the sound
        const audioSource = localAudioPath ? { uri: localAudioPath } : { uri: currentAudioUrl };
        setDebugInfo('Loading from: ' + (localAudioPath || currentAudioUrl));
        
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            audioSource,
            { shouldPlay: autoPlay, volume: volume },
            onPlaybackStatusUpdate
          );
          
          if (mounted) {
            setSound(newSound);
            setIsLoading(false);
            setDebugInfo('Audio loaded successfully');
            
            // Set initial volume
            await newSound.setVolumeAsync(volume);
          } else {
            // If component unmounted during load, unload the sound
            await newSound.unloadAsync();
          }
        } catch (soundError) {
          // If we failed to load from the primary URL and we're not using a local path,
          // try the backup URL
          if (!localAudioPath) {
            setDebugInfo('Primary URL failed, trying backup URL...');
            
            // Get the backup URL using our dedicated function
            const backupUrl = getBackupAudioUrl(surahNumber, ayahNumber);
            
            // Test if the backup URL is accessible
            const isBackupAvailable = await testAudioUrl(backupUrl);
            
            if (isBackupAvailable) {
              setDebugInfo('Using backup URL: ' + backupUrl);
              setCurrentAudioUrl(backupUrl);
              
              const { sound: backupSound } = await Audio.Sound.createAsync(
                { uri: backupUrl },
                { shouldPlay: autoPlay, volume: volume },
                onPlaybackStatusUpdate
              );
              
              if (mounted) {
                setSound(backupSound);
                setIsLoading(false);
                setDebugInfo('Audio loaded from backup URL');
                
                // Set initial volume
                await backupSound.setVolumeAsync(volume);
              } else {
                // If component unmounted during load, unload the sound
                await backupSound.unloadAsync();
              }
            } else {
              throw new Error('Both primary and backup URLs failed');
            }
          } else {
            throw soundError;
          }
        }
      } catch (loadError) {
        console.error('Error loading sound:', loadError);
        if (mounted) {
          setError('Could not load audio');
          setIsLoading(false);
          setDebugInfo('Load error: ' + JSON.stringify(loadError));
        }
      }
    };
    
    loadSound();
    
    // Cleanup
    return () => {
      mounted = false;
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [surahNumber, ayahNumber, audioUrl, localAudioPath, autoPlay, volume, currentAudioUrl]);
  
  // Handle audio playback status updates
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      setDebugInfo('Playback status: not loaded');
      return;
    }
    
    setIsPlaying(status.isPlaying);
    setDebugInfo(`Playing: ${status.isPlaying}, Position: ${status.positionMillis}ms, Duration: ${status.durationMillis}ms`);
    
    // Handle playback completion
    if (status.didJustFinish && onPlayComplete) {
      setDebugInfo('Playback completed');
      onPlayComplete();
    }
  };
  
  // Play/pause audio
  const togglePlayback = async () => {
    if (!sound) return;
    
    try {
      if (isPlaying) {
        await sound.pauseAsync();
        setDebugInfo('Paused playback');
      } else {
        await sound.playAsync();
        setDebugInfo('Started playback');
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      setDebugInfo('Playback error: ' + JSON.stringify(error));
    }
  };
  
  // Replay audio from beginning
  const replay = async () => {
    if (!sound) return;
    
    try {
      await sound.stopAsync();
      await sound.playAsync();
      setDebugInfo('Replaying audio');
    } catch (error) {
      console.error('Error replaying:', error);
      setDebugInfo('Replay error: ' + JSON.stringify(error));
    }
  };
  
  // Update volume
  const updateVolume = async (newVolume: number) => {
    setVolume(newVolume);
    if (sound) {
      try {
        await sound.setVolumeAsync(newVolume);
        setDebugInfo(`Volume set to: ${newVolume.toFixed(2)}`);
      } catch (error) {
        console.error('Error setting volume:', error);
        setDebugInfo('Volume error: ' + JSON.stringify(error));
      }
    }
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
            <TouchableOpacity onPress={togglePlayback} style={styles.button}>
              <MaterialIcons
                name={isPlaying ? 'pause' : 'play-arrow'}
                size={30}
                color={theme.colors.primary}
              />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={replay} style={styles.button}>
              <MaterialIcons name="replay" size={26} color={theme.colors.primary} />
            </TouchableOpacity>
            
            <View style={styles.volumeContainer}>
              <MaterialIcons name="volume-down" size={20} color={theme.colors.primary} />
              <Slider
                style={styles.volumeSlider}
                minimumValue={0}
                maximumValue={1}
                value={volume}
                onValueChange={updateVolume}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor="#CCCCCC"
              />
              <MaterialIcons name="volume-up" size={20} color={theme.colors.primary} />
            </View>
          </View>
          
          {/* Debug info */}
          <Text style={styles.debugText}>{debugInfo}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  audioContainer: {
    width: '100%',
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  button: {
    marginHorizontal: 10,
    padding: 5,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    marginLeft: 5,
    fontSize: 14,
  },
  volumeContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  volumeSlider: {
    flex: 1,
    height: 40,
    marginHorizontal: 5,
  },
  debugText: {
    fontSize: 10,
    color: '#888888',
    marginTop: 5,
    textAlign: 'center',
  },
});

export default AudioPlayer;
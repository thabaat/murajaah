import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, useTheme, Divider } from 'react-native-paper';
import { Ayah } from '../types';
import AudioPlayer from './AudioPlayer';
import GroupAudioPlayer from './GroupAudioPlayer';

interface AyahDisplayProps {
  ayah: Ayah | Ayah[];
  showAudio?: boolean;
  showAyahNumber?: boolean;
  onAudioComplete?: () => void;
  autoPlayAudio?: boolean;
}

const AyahDisplay: React.FC<AyahDisplayProps> = ({
  ayah,
  showAudio = true,
  showAyahNumber = true,
  onAudioComplete,
  autoPlayAudio = false,
}) => {
  const theme = useTheme();
  
  // Handle both single ayah and array of ayahs
  const ayahs = Array.isArray(ayah) ? ayah : [ayah];
  
  // Validate ayah data to prevent rendering errors
  const isValidAyahs = ayahs.every(a => 
    a && 
    typeof a.surahNumber === 'number' && 
    typeof a.ayahNumber === 'number' &&
    typeof a.text === 'string'
  );

  if (!isValidAyahs) {
    console.error('Invalid ayah data provided to AyahDisplay:', ayah);
    return (
      <Card style={styles.card}>
        <Card.Content>
          <Text style={{ color: theme.colors.error }}>
            Invalid ayah data. Please try again.
          </Text>
        </Card.Content>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Card.Content>
        {showAyahNumber && (
          <View style={styles.ayahNumberContainer}>
            <Text
              style={[styles.ayahNumber, { color: theme.colors.primary }]}
            >
              {ayahs.length > 1 
                ? `${ayahs[0].surahNumber}:${ayahs[0].ayahNumber}-${ayahs[ayahs.length-1].ayahNumber}`
                : `${ayahs[0].surahNumber}:${ayahs[0].ayahNumber}`
              }
            </Text>
          </View>
        )}

        <ScrollView
          style={styles.textScrollView}
          contentContainerStyle={styles.textContainer}
        >
          {ayahs.map((a, index) => (
            <React.Fragment key={`${a.surahNumber}-${a.ayahNumber}`}>
              {index > 0 && <Divider style={styles.divider} />}
              <Text style={styles.arabicText}>{a.text}</Text>
            </React.Fragment>
          ))}
        </ScrollView>

        {showAudio && ayahs.length > 0 && (
          <View style={styles.audioContainer}>
            {ayahs.length > 1 ? (
              <GroupAudioPlayer
                ayahs={ayahs}
                autoPlay={autoPlayAudio}
                onPlayComplete={onAudioComplete}
              />
            ) : (
              <AudioPlayer
                surahNumber={ayahs[0].surahNumber}
                ayahNumber={ayahs[0].ayahNumber}
                audioUrl={ayahs[0].audioUrl}
                audioPath={ayahs[0].audioPath}
                autoPlay={autoPlayAudio}
                onPlayComplete={onAudioComplete}
              />
            )}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
  },
  ayahNumberContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
    zIndex: 1,
  },
  ayahNumber: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  textScrollView: {
    maxHeight: 300,
  },
  textContainer: {
    paddingVertical: 8,
  },
  arabicText: {
    fontSize: 28,
    lineHeight: 48,
    textAlign: 'right',
    fontFamily: 'Amiri-Regular',
    marginBottom: 16,
  },
  divider: {
    marginVertical: 8,
  },
  audioContainer: {
    marginTop: 8,
  }
});

export default AyahDisplay;
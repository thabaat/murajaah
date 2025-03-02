import React, { useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Button, useTheme, Card, Title, Paragraph, IconButton } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { useSettings } from '../../contexts/SettingsContext';

interface StudyTimeScreenProps {
  onNext: () => void;
  onBack: () => void;
}

export default function StudyTimeScreen({ onNext, onBack }: StudyTimeScreenProps) {
  const theme = useTheme();
  const { settings, updateUserSettings } = useSettings();
  
  const [newAyahsPerDay, setNewAyahsPerDay] = useState<number>(
    settings?.newAyahsPerDay || 5
  );
  const [reviewLimit, setReviewLimit] = useState<number>(
    settings?.reviewLimit || 50
  );
  const [error, setError] = useState<string | null>(null);

  // Handle adjusting new ayahs per day
  const handleNewAyahsChange = (value: number) => {
    setNewAyahsPerDay(Math.round(value));
  };

  // Handle adjusting review limit
  const handleReviewLimitChange = (value: number) => {
    setReviewLimit(Math.round(value));
  };

  // Decrease new ayahs per day
  const decreaseNewAyahs = () => {
    if (newAyahsPerDay > 1) {
      setNewAyahsPerDay(newAyahsPerDay - 1);
    }
  };

  // Increase new ayahs per day
  const increaseNewAyahs = () => {
    if (newAyahsPerDay < 20) {
      setNewAyahsPerDay(newAyahsPerDay + 1);
    }
  };

  // Decrease review limit
  const decreaseReviewLimit = () => {
    if (reviewLimit > 10) {
      setReviewLimit(reviewLimit - 10);
    }
  };

  // Increase review limit
  const increaseReviewLimit = () => {
    if (reviewLimit < 200) {
      setReviewLimit(reviewLimit + 10);
    }
  };

  // Calculate estimated daily study time
  const calculateStudyTime = (): string => {
    // Assume average time per new ayah = 2 minutes
    // Assume average time per review = 30 seconds
    const newAyahsTime = newAyahsPerDay * 2; // minutes
    const reviewTime = (reviewLimit * 0.5) / 60; // hours
    const totalTimeHours = newAyahsTime / 60 + reviewTime;
    
    if (totalTimeHours < 1) {
      return `${Math.round(totalTimeHours * 60)} minutes`;
    } else {
      return `${totalTimeHours.toFixed(1)} hours`;
    }
  };

  // Continue to next step
  const handleContinue = async () => {
    try {
      setError(null);
      await updateUserSettings({
        newAyahsPerDay,
        reviewLimit,
      });
      onNext();
    } catch (err) {
      console.error('Error saving study time settings:', err);
      setError('Failed to save settings. Please try again.');
    }
  };

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      <Text variant="headlineSmall" style={styles.title}>
        How much time can you commit?
      </Text>
      
      <Text variant="bodyMedium" style={styles.description}>
        Set your daily learning goals. This helps us determine how many new ayahs to introduce
        and how many reviews to schedule each day.
      </Text>
      
      {error && (
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error}
        </Text>
      )}
      
      <Card style={styles.card}>
        <Card.Content>
          <Title>New Ayahs Per Day</Title>
          <Paragraph>
            How many new ayahs would you like to learn each day?
          </Paragraph>
          
          <View style={styles.sliderContainer}>
            <IconButton
              icon="minus"
              size={20}
              onPress={decreaseNewAyahs}
              disabled={newAyahsPerDay <= 1}
            />
            
            <View style={styles.sliderWrapper}>
              <Slider
                value={newAyahsPerDay}
                onValueChange={handleNewAyahsChange}
                minimumValue={1}
                maximumValue={20}
                step={1}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.surfaceVariant}
                thumbTintColor={theme.colors.primary}
                style={styles.slider}
              />
              <Text style={styles.sliderValue}>{newAyahsPerDay}</Text>
            </View>
            
            <IconButton
              icon="plus"
              size={20}
              onPress={increaseNewAyahs}
              disabled={newAyahsPerDay >= 20}
            />
          </View>
          
          <View style={styles.recommendationContainer}>
            <Text variant="bodySmall" style={styles.recommendationText}>
              Beginner: 1-3 | Intermediate: 4-7 | Advanced: 8+
            </Text>
          </View>
        </Card.Content>
      </Card>
      
      <Card style={styles.card}>
        <Card.Content>
          <Title>Daily Review Limit</Title>
          <Paragraph>
            Maximum number of reviews to do each day
          </Paragraph>
          
          <View style={styles.sliderContainer}>
            <IconButton
              icon="minus"
              size={20}
              onPress={decreaseReviewLimit}
              disabled={reviewLimit <= 10}
            />
            
            <View style={styles.sliderWrapper}>
              <Slider
                value={reviewLimit}
                onValueChange={handleReviewLimitChange}
                minimumValue={10}
                maximumValue={200}
                step={10}
                minimumTrackTintColor={theme.colors.primary}
                maximumTrackTintColor={theme.colors.surfaceVariant}
                thumbTintColor={theme.colors.primary}
                style={styles.slider}
              />
              <Text style={styles.sliderValue}>{reviewLimit}</Text>
            </View>
            
            <IconButton
              icon="plus"
              size={20}
              onPress={increaseReviewLimit}
              disabled={reviewLimit >= 200}
            />
          </View>
        </Card.Content>
      </Card>
      
      <Card style={styles.summaryCard}>
        <Card.Content>
          <Title>Estimated Daily Study Time</Title>
          <Text variant="displaySmall" style={{ color: theme.colors.primary, textAlign: 'center' }}>
            {calculateStudyTime()}
          </Text>
          <Paragraph style={styles.summaryText}>
            This is an estimate based on average review times. Your actual experience may vary.
          </Paragraph>
        </Card.Content>
      </Card>
      
      <View style={styles.buttonsContainer}>
        <Button mode="outlined" onPress={onBack} style={styles.button}>
          Back
        </Button>
        <Button mode="contained" onPress={handleContinue} style={styles.button}>
          Continue
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
    marginBottom: 16,
    elevation: 2,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  sliderWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderValue: {
    marginTop: 8,
    fontWeight: 'bold',
  },
  recommendationContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  recommendationText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  summaryCard: {
    marginBottom: 24,
    elevation: 2,
  },
  summaryText: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
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
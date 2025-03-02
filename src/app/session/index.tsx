import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme, ActivityIndicator } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '../../contexts/SessionContext';
import { getDueReviews } from '../../services/scheduler';
import { useSettings } from '../../contexts/SettingsContext';

export default function SessionScreen() {
  const theme = useTheme();
  const { startSession, isActive, loading, error } = useSession();
  const { settings } = useSettings();
  
  const [loadingDueReviews, setLoadingDueReviews] = useState(true);
  const [dueReviews, setDueReviews] = useState<{
    due: number;
    new: number;
    learning: number;
    review: number;
  }>({ due: 0, new: 0, learning: 0, review: 0 });
  const [isPreloadingAudio, setIsPreloadingAudio] = useState(false);
  
  // Load due reviews count
  useEffect(() => {
    const loadDueReviews = async () => {
      try {
        setLoadingDueReviews(true);
        const reviews = await getDueReviews();
        setDueReviews(reviews);
        setLoadingDueReviews(false);
      } catch (error) {
        console.error('Error loading due reviews:', error);
        setLoadingDueReviews(false);
      }
    };

    loadDueReviews();
  }, []);

  // Handle start session
  const handleStartSession = async () => {
    if (settings?.audioEnabled) {
      setIsPreloadingAudio(true);
    }
    
    try {
      await startSession();
      router.push('/session/review');
    } catch (error) {
      console.error('Error starting session:', error);
    } finally {
      setIsPreloadingAudio(false);
    }
  };

  // Handle resume session
  const handleResumeSession = () => {
    router.push('/session/review');
  };

  // Get time until next review
  const getTimeUntilNextReview = () => {
    return "Available now";
  };

  if (loadingDueReviews) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.content}>
        {/* Today's Session Card */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Today's Session</Text>
            
            <View style={styles.reviewStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{dueReviews.due}</Text>
                <Text style={styles.statLabel}>Total Due</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{dueReviews.new}</Text>
                <Text style={styles.statLabel}>New</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{dueReviews.learning}</Text>
                <Text style={styles.statLabel}>Learning</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{dueReviews.review}</Text>
                <Text style={styles.statLabel}>Review</Text>
              </View>
            </View>
            
            <View style={styles.nextReviewContainer}>
              <Text style={styles.nextReviewLabel}>Next review:</Text>
              <Text style={styles.nextReviewTime}>{getTimeUntilNextReview()}</Text>
            </View>
          </Card.Content>
          
          <Card.Actions style={styles.cardActions}>
            {isActive ? (
              <Button mode="contained" onPress={handleResumeSession}>
                Resume Session
              </Button>
            ) : (
              <Button 
                mode="contained" 
                onPress={handleStartSession}
                disabled={dueReviews.due === 0 || loading || isPreloadingAudio}
                loading={loading || isPreloadingAudio}
              >
                {isPreloadingAudio ? 'Preparing Audio...' : 'Start Session'}
              </Button>
            )}
          </Card.Actions>
        </Card>
        
        {/* Session Tips */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.cardTitle}>Tips for Effective Review</Text>
            
            <View style={styles.tipItem}>
              <Text style={styles.tipNumber}>1</Text>
              <Text style={styles.tipText}>
                Focus on your recitation quality and accuracy during review
              </Text>
            </View>
            
            <View style={styles.tipItem}>
              <Text style={styles.tipNumber}>2</Text>
              <Text style={styles.tipText}>
                Grade yourself honestly - this improves the scheduling algorithm
              </Text>
            </View>
            
            <View style={styles.tipItem}>
              <Text style={styles.tipNumber}>3</Text>
              <Text style={styles.tipText}>
                Consistent daily practice is more effective than occasional long sessions
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  reviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  nextReviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  nextReviewLabel: {
    fontSize: 14,
    opacity: 0.8,
    marginRight: 8,
  },
  nextReviewTime: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  cardActions: {
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  tipNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#006064',
    color: 'white',
    textAlign: 'center',
    lineHeight: 24,
    marginRight: 12,
    fontWeight: 'bold',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Card, Button, useTheme, ActivityIndicator, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSession } from '../contexts/SessionContext';
import { useSettings } from '../contexts/SettingsContext';
import { useAppTheme } from '../contexts/ThemeContext';
import { getTodayDueReviews } from '../services/scheduler';

export default function HomeScreen() {
  const theme = useTheme();
  const { isDarkMode } = useAppTheme();
  const { settings } = useSettings();
  const { startSession, isActive } = useSession();
  
  const [isFirstTime, setIsFirstTime] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [dueReviews, setDueReviews] = useState<{
    due: number;
    new: number;
    learning: number;
    review: number;
  }>({ due: 0, new: 0, learning: 0, review: 0 });

  // Check if this is the first time opening the app
  useEffect(() => {
    const checkFirstTimeUser = async () => {
      try {
        // await AsyncStorage.removeItem('has_onboarded');
        const hasOnboarded = await AsyncStorage.getItem('has_onboarded');
        console.debug('hasOnboarded', hasOnboarded);
        if (hasOnboarded !== 'true') {
          router.push('/onboarding');
        }
        setIsFirstTime(hasOnboarded !== 'true');
      } catch (error) {
        console.error('Error checking first-time user:', error);
      } finally {
        setLoading(false);
      }
    };

    checkFirstTimeUser();
  }, []);

  // Load due reviews count
  useEffect(() => {
    const loadDueReviews = async () => {
      try {
        const reviews = await getTodayDueReviews();
        setDueReviews(reviews);
      } catch (error) {
        console.error('Error loading due reviews:', error);
      }
    };

    loadDueReviews();
    // Refresh every 5 minutes
    const interval = setInterval(loadDueReviews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle start session
  const handleStartSession = async () => {
    try {
      await startSession();
      router.push('/session');
    } catch (error) {
      console.error('Error starting session:', error);
    }
  };

  // Handle resume session
  const handleResumeSession = () => {
    router.push('/session');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  // Wrap the return in a try-catch to catch any rendering errors
  try {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        
        <View style={styles.header}>
          <Text variant="headlineMedium" style={{ color: theme.colors.onBackground }}>
            Muraja'ah
          </Text>
          
          <View style={styles.headerActions}>
            <IconButton
              icon="chart-bar"
              mode="contained"
              size={20}
              onPress={() => router.push('/statistics')}
            />
            <IconButton
              icon="cog"
              mode="contained"
              size={20}
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>

        <ScrollView style={styles.content}>
          {/* Today's Session Card */}
          <Card style={styles.sessionCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>Today's Session</Text>
              
              <View style={styles.reviewStats}>
                <View style={styles.statItem}>
                  <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
                    {dueReviews.due}
                  </Text>
                  <Text variant="bodyMedium">Total Due</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text variant="headlineMedium" style={{ color: theme.colors.error }}>
                    {dueReviews.new}
                  </Text>
                  <Text variant="bodyMedium">New</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text variant="headlineMedium" style={{ color: theme.colors.tertiary }}>
                    {dueReviews.learning}
                  </Text>
                  <Text variant="bodyMedium">Learning</Text>
                </View>
                
                <View style={styles.statItem}>
                  <Text variant="headlineMedium" style={{ color: theme.colors.secondary }}>
                    {dueReviews.review}
                  </Text>
                  <Text variant="bodyMedium">Review</Text>
                </View>
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
                  disabled={dueReviews.due === 0}
                >
                  Start Session
                </Button>
              )}
            </Card.Actions>
          </Card>

          {/* Progress Overview Card */}
          <Card style={styles.progressCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>Progress Overview</Text>
              
              <View style={styles.progressStats}>
                <View style={styles.statItem}>
                  <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
                    {settings?.knownSurahs.length || 0}
                  </Text>
                  <Text variant="bodyMedium">Surahs Memorized</Text>
                </View>
                
                {/* More stats can be added here */}
              </View>
            </Card.Content>
            
            <Card.Actions style={styles.cardActions}>
              <Button 
                mode="outlined" 
                onPress={() => router.push('/statistics')}
              >
                View Details
              </Button>
            </Card.Actions>
          </Card>

          {/* Quick Actions Card */}
          <Card style={styles.actionsCard}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>Quick Actions</Text>
            </Card.Content>
            
            <Card.Actions style={styles.cardActions}>
              <Button 
                mode="outlined" 
                icon="plus"
                onPress={() => router.push('/surah-browser')}
              >
                Add New Surah
              </Button>
              
              <Button 
                mode="outlined" 
                icon="cog"
                onPress={() => router.push('/settings')}
              >
                Settings
              </Button>
            </Card.Actions>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  } catch (error) {
    console.error('Error rendering HomeScreen:', error);
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <Text>Error: Unable to load content</Text>
      </View>
    );
  }
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerActions: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sessionCard: {
    marginBottom: 16,
    elevation: 2,
  },
  progressCard: {
    marginBottom: 16,
    elevation: 2,
  },
  actionsCard: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 16,
  },
  reviewStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  cardActions: {
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
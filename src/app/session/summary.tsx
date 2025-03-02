import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView } from 'react-native';
import { Text, Button, Card, useTheme, ActivityIndicator, Divider, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { getSessionStatistics } from '../../services/scheduler';
import { SessionStatistics } from '../../types';
import { PieChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';

// Get screen width
const screenWidth = Dimensions.get('window').width;

export default function SessionSummaryScreen() {
  const theme = useTheme();
  const { sessionId } = useLocalSearchParams();
  
  const [stats, setStats] = useState<SessionStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session statistics
  useEffect(() => {
    const loadStatistics = async () => {
      if (!sessionId) {
        setError('No session ID provided');
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        setError(null);
        
        const sessionStats = await getSessionStatistics(sessionId as string);
        setStats(sessionStats);
      } catch (err) {
        console.error('Error loading session statistics:', err);
        setError('Failed to load session statistics');
      } finally {
        setLoading(false);
      }
    };
    
    loadStatistics();
  }, [sessionId]);

  // Format duration
  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };
  
  // Calculate average time per review
  const calculateAverageTime = () => {
    if (!stats || stats.totalReviewed === 0) return 0;
    return stats.reviewTime / stats.totalReviewed;
  };
  
  // Prepare chart data for ratings distribution
  const getRatingsChartData = () => {
    if (!stats) return [];
    
    return [
      {
        name: 'Again',
        count: stats.ratings.again,
        color: '#F44336', // Red
        legendFontColor: theme.colors.onBackground,
        legendFontSize: 12
      },
      {
        name: 'Hard',
        count: stats.ratings.hard,
        color: '#FF9800', // Orange
        legendFontColor: theme.colors.onBackground,
        legendFontSize: 12
      },
      {
        name: 'Good',
        count: stats.ratings.good,
        color: theme.colors.primary,
        legendFontColor: theme.colors.onBackground,
        legendFontSize: 12
      },
      {
        name: 'Easy',
        count: stats.ratings.easy,
        color: '#4CAF50', // Green
        legendFontColor: theme.colors.onBackground,
        legendFontSize: 12
      }
    ].filter(item => item.count > 0); // Only show ratings that were used
  };
  
  // Handle return to home
  const handleReturnHome = () => {
    router.replace('/');
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading session summary...</Text>
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>
          {error || 'Could not load session data'}
        </Text>
        <Button mode="contained" onPress={handleReturnHome}>
          Return to Home
        </Button>
      </View>
    );
  }

  const ratingsData = getRatingsChartData();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text variant="headlineMedium">Session Complete!</Text>
        <IconButton
          icon="home"
          mode="contained"
          size={20}
          onPress={handleReturnHome}
        />
      </View>
      
      <ScrollView style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Session Overview
            </Text>
            
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={{ color: theme.colors.primary }}>
                  {stats.totalReviewed}
                </Text>
                <Text variant="bodyMedium">Total Reviews</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={{ color: theme.colors.error }}>
                  {stats.newLearned}
                </Text>
                <Text variant="bodyMedium">New Learned</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={{ color: theme.colors.tertiary }}>
                  {formatDuration(stats.reviewTime)}
                </Text>
                <Text variant="bodyMedium">Total Time</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text variant="headlineMedium" style={{ color: theme.colors.secondary }}>
                  {formatDuration(calculateAverageTime())}
                </Text>
                <Text variant="bodyMedium">Avg. per Ayah</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Ratings Distribution
            </Text>
            
            {ratingsData.length > 0 ? (
              <View style={styles.chartContainer}>
                <PieChart
                  data={ratingsData}
                  width={screenWidth - 64}
                  height={200}
                  chartConfig={{
                    backgroundColor: theme.colors.surface,
                    backgroundGradientFrom: theme.colors.surface,
                    backgroundGradientTo: theme.colors.surface,
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  }}
                  accessor="count"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
              </View>
            ) : (
              <Text style={styles.noDataText}>No ratings data available</Text>
            )}
            
            <Divider style={styles.divider} />
            
            <View style={styles.ratingsBreakdown}>
              <View style={styles.ratingRow}>
                <View style={styles.ratingLabel}>
                  <View style={[styles.colorIndicator, { backgroundColor: '#F44336' }]} />
                  <Text>Again</Text>
                </View>
                <Text>{stats.ratings.again}</Text>
              </View>
              
              <View style={styles.ratingRow}>
                <View style={styles.ratingLabel}>
                  <View style={[styles.colorIndicator, { backgroundColor: '#FF9800' }]} />
                  <Text>Hard</Text>
                </View>
                <Text>{stats.ratings.hard}</Text>
              </View>
              
              <View style={styles.ratingRow}>
                <View style={styles.ratingLabel}>
                  <View style={[styles.colorIndicator, { backgroundColor: theme.colors.primary }]} />
                  <Text>Good</Text>
                </View>
                <Text>{stats.ratings.good}</Text>
              </View>
              
              <View style={styles.ratingRow}>
                <View style={styles.ratingLabel}>
                  <View style={[styles.colorIndicator, { backgroundColor: '#4CAF50' }]} />
                  <Text>Easy</Text>
                </View>
                <Text>{stats.ratings.easy}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
        
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleLarge" style={styles.cardTitle}>
              Retention Rate
            </Text>
            
            <View style={styles.retentionContainer}>
              <Text variant="displaySmall" style={{ color: getRetentionColor(stats.retention, theme) }}>
                {Math.round(stats.retention)}%
              </Text>
              <Text variant="bodyMedium" style={styles.retentionDescription}>
                {getRetentionMessage(stats.retention)}
              </Text>
            </View>
          </Card.Content>
        </Card>
        
        <View style={styles.buttonContainer}>
          <Button mode="contained" onPress={handleReturnHome} style={styles.button}>
            Return to Home
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper function to get retention color
const getRetentionColor = (retention: number, theme: any) => {
  if (retention >= 90) return '#4CAF50'; // Green
  if (retention >= 75) return theme.colors.primary;
  if (retention >= 60) return '#FF9800'; // Orange
  return '#F44336'; // Red
};

// Helper function to get retention message
const getRetentionMessage = (retention: number) => {
  if (retention >= 90) return 'Excellent retention! Keep up the good work.';
  if (retention >= 75) return 'Good retention. You\'re on the right track.';
  if (retention >= 60) return 'Moderate retention. Consider reviewing more often.';
  return 'Needs improvement. Try smaller batches or more frequent reviews.';
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
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  chartContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  noDataText: {
    textAlign: 'center',
    marginVertical: 24,
    opacity: 0.6,
  },
  divider: {
    marginVertical: 16,
  },
  ratingsBreakdown: {
    marginTop: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  ratingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  retentionContainer: {
    alignItems: 'center',
    padding: 16,
  },
  retentionDescription: {
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
  },
  buttonContainer: {
    marginVertical: 24,
  },
  button: {
    padding: 8,
  },
});
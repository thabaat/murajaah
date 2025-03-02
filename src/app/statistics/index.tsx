import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, Dimensions } from 'react-native';
import { Text, Card, Chip, useTheme, ActivityIndicator, Button, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LineChart, BarChart } from 'react-native-chart-kit';
import { getRecentSessionStatistics } from '../../services/scheduler';
import { SessionStatistics } from '../../types';

// Get screen width
const screenWidth = Dimensions.get('window').width;

export default function StatisticsScreen() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SessionStatistics[]>([]);
  const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30); // Days
  const [error, setError] = useState<string | null>(null);

  // Load session statistics
  useEffect(() => {
    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const sessionStats = await getRecentSessionStatistics(timeRange);
        setStats(sessionStats);
      } catch (err) {
        console.error('Error loading statistics:', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };
    
    loadStatistics();
  }, [timeRange]);

  // Calculate summary statistics
  const calculateSummary = () => {
    if (!stats || stats.length === 0) {
      return {
        totalReviewed: 0,
        newLearned: 0,
        avgRetention: 0,
        avgTimePerAyah: 0,
        sessionsCompleted: 0,
      };
    }
    
    const totalReviewed = stats.reduce((sum, session) => sum + session.totalReviewed, 0);
    const newLearned = stats.reduce((sum, session) => sum + session.newLearned, 0);
    const totalRetention = stats.reduce((sum, session) => sum + session.retention, 0);
    const totalTime = stats.reduce((sum, session) => sum + session.reviewTime, 0);
    
    return {
      totalReviewed,
      newLearned,
      avgRetention: totalRetention / stats.length,
      avgTimePerAyah: totalReviewed > 0 ? totalTime / totalReviewed : 0,
      sessionsCompleted: stats.length,
    };
  };

  // Prepare chart data for retention over time
  const getRetentionChartData = () => {
    if (!stats || stats.length === 0) return { labels: [], datasets: [{ data: [] }] };
    
    // Sort by date
    const sortedStats = [...stats].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Get last 7 entries if more than 7 exist
    const chartStats = sortedStats.length > 7 ? sortedStats.slice(-7) : sortedStats;
    
    return {
      labels: chartStats.map(stat => {
        const date = new Date(stat.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          data: chartStats.map(stat => stat.retention),
          color: () => theme.colors.primary,
        }
      ],
    };
  };

  // Prepare chart data for review counts
  const getReviewCountChartData = () => {
    if (!stats || stats.length === 0) return { labels: [], datasets: [{ data: [] }] };
    
    // Sort by date
    const sortedStats = [...stats].sort((a, b) => a.date.getTime() - b.date.getTime());
    
    // Get last 7 entries if more than 7 exist
    const chartStats = sortedStats.length > 7 ? sortedStats.slice(-7) : sortedStats;
    
    return {
      labels: chartStats.map(stat => {
        const date = new Date(stat.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          data: chartStats.map(stat => stat.totalReviewed),
        }
      ],
    };
  };

  // Format duration in milliseconds to readable format
  const formatDuration = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes < 1) {
      return `${seconds}s`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  };

  const summary = calculateSummary();
  const retentionChartData = getRetentionChartData();
  const reviewCountChartData = getReviewCountChartData();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView style={styles.content}>
        {/* Time range selector */}
        <View style={styles.chipContainer}>
          <Chip 
            selected={timeRange === 7} 
            onPress={() => setTimeRange(7)}
            style={styles.chip}
          >
            Last 7 Days
          </Chip>
          <Chip 
            selected={timeRange === 30} 
            onPress={() => setTimeRange(30)}
            style={styles.chip}
          >
            Last 30 Days
          </Chip>
          <Chip 
            selected={timeRange === 90} 
            onPress={() => setTimeRange(90)}
            style={styles.chip}
          >
            Last 90 Days
          </Chip>
        </View>
        
        {error ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.errorText}>
                {error}
              </Text>
              <Button 
                mode="contained" 
                onPress={() => setTimeRange(timeRange)}
                style={styles.retryButton}
              >
                Retry
              </Button>
            </Card.Content>
          </Card>
        ) : stats.length === 0 ? (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.noDataText}>
                No session data available for this time period.
              </Text>
              <Text style={styles.noDataSubtext}>
                Complete review sessions to see your statistics here.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            {/* Summary Card */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>Summary</Text>
                
                <View style={styles.summaryGrid}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{summary.totalReviewed}</Text>
                    <Text style={styles.summaryLabel}>Ayahs Reviewed</Text>
                  </View>
                  
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{summary.newLearned}</Text>
                    <Text style={styles.summaryLabel}>New Learned</Text>
                  </View>
                  
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{Math.round(summary.avgRetention)}%</Text>
                    <Text style={styles.summaryLabel}>Avg. Retention</Text>
                  </View>
                  
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{formatDuration(summary.avgTimePerAyah)}</Text>
                    <Text style={styles.summaryLabel}>Avg. Time/Ayah</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
            
            {/* Retention Chart */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>Retention Rate</Text>
                
                <LineChart
                  data={retentionChartData}
                  width={screenWidth - 40}
                  height={220}
                  chartConfig={{
                    backgroundColor: theme.colors.surface,
                    backgroundGradientFrom: theme.colors.surface,
                    backgroundGradientTo: theme.colors.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 96, 100, ${opacity})`,
                    labelColor: (opacity = 1) => theme.colors.onSurface,
                    propsForDots: {
                      r: '6',
                      strokeWidth: '2',
                      stroke: theme.colors.primary,
                    },
                  }}
                  bezier
                  style={styles.chart}
                  yAxisSuffix="%"
                  yAxisInterval={1}
                />
              </Card.Content>
            </Card>
            
            {/* Review Count Chart */}
            <Card style={styles.card}>
              <Card.Content>
                <Text style={styles.cardTitle}>Daily Reviews</Text>
                
                <BarChart
                  data={reviewCountChartData}
                  width={screenWidth - 40}
                  height={220}
                  chartConfig={{
                    backgroundColor: theme.colors.surface,
                    backgroundGradientFrom: theme.colors.surface,
                    backgroundGradientTo: theme.colors.surface,
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 172, 193, ${opacity})`,
                    labelColor: (opacity = 1) => theme.colors.onSurface,
                  }}
                  style={styles.chart}
                  yAxisInterval={1}
                />
              </Card.Content>
            </Card>
            
            {/* Session History */}
            <Card style={[styles.card, { marginBottom: 20 }]}>
              <Card.Content>
                <Text style={styles.cardTitle}>Recent Sessions</Text>
                
                {stats.slice(0, 5).map((session, index) => (
                  <View key={session.id}>
                    <View style={styles.sessionItem}>
                      <View>
                        <Text style={styles.sessionDate}>
                          {new Date(session.date).toLocaleDateString()}
                        </Text>
                        <Text style={styles.sessionTime}>
                          {new Date(session.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                      
                      <View style={styles.sessionStats}>
                        <View style={styles.sessionStat}>
                          <Text style={styles.sessionStatValue}>{session.totalReviewed}</Text>
                          <Text style={styles.sessionStatLabel}>Reviews</Text>
                        </View>
                        
                        <View style={styles.sessionStat}>
                          <Text style={styles.sessionStatValue}>{session.newLearned}</Text>
                          <Text style={styles.sessionStatLabel}>New</Text>
                        </View>
                        
                        <View style={styles.sessionStat}>
                          <Text style={styles.sessionStatValue}>{Math.round(session.retention)}%</Text>
                          <Text style={styles.sessionStatLabel}>Retention</Text>
                        </View>
                      </View>
                    </View>
                    {index < Math.min(stats.length, 5) - 1 && <Divider style={styles.divider} />}
                  </View>
                ))}
              </Card.Content>
            </Card>
          </>
        )}
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
  loadingText: {
    marginTop: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  chip: {
    margin: 4,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  summaryItem: {
    width: '48%',
    marginBottom: 16,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#006064',
  },
  summaryLabel: {
    fontSize: 14,
    opacity: 0.8,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  errorText: {
    textAlign: 'center',
    marginVertical: 24,
    opacity: 0.7,
  },
  retryButton: {
    alignSelf: 'center',
    marginTop: 16,
  },
  noDataText: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 24,
  },
  noDataSubtext: {
    textAlign: 'center',
    opacity: 0.7,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sessionTime: {
    fontSize: 12,
    opacity: 0.7,
  },
  sessionStats: {
    flexDirection: 'row',
  },
  sessionStat: {
    marginLeft: 16,
    alignItems: 'center',
    minWidth: 50,
  },
  sessionStatValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sessionStatLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  divider: {
    height: 1,
  },
});
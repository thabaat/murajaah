import React, { useState, useEffect } from 'react';
import { StyleSheet, View, FlatList, TouchableOpacity } from 'react-native';
import { Text, Card, Searchbar, Chip, ActivityIndicator, useTheme, Badge, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchSurahs } from '../../services/quran/api';
import { useSettings } from '../../contexts/SettingsContext';
import { Surah } from '../../types';

export default function SurahBrowserScreen() {
  const theme = useTheme();
  const { settings } = useSettings();
  const params = useLocalSearchParams();
  const mode = params.mode || 'browse'; // 'browse' or 'select'
  
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [filteredSurahs, setFilteredSurahs] = useState<Surah[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'meccan' | 'medinan' | 'unknown'>('all');
  
  // Load surahs
  useEffect(() => {
    const loadSurahs = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const allSurahs = await fetchSurahs();
        setSurahs(allSurahs);
        setFilteredSurahs(allSurahs);
      } catch (err) {
        console.error('Error loading surahs:', err);
        setError('Failed to load surahs. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadSurahs();
  }, []);
  
  // Apply filters and search
  useEffect(() => {
    let result = [...surahs];
    
    // Apply revelation type filter
    if (filter !== 'all') {
      result = result.filter(surah => {
        if (filter === 'meccan') return surah.revelationType === 'Meccan';
        if (filter === 'medinan') return surah.revelationType === 'Medinan';
        return true;
      });
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        surah => 
          surah.name.toLowerCase().includes(query) ||
          surah.englishName.toLowerCase().includes(query) ||
          surah.number.toString().includes(query)
      );
    }
    
    setFilteredSurahs(result);
  }, [surahs, filter, searchQuery]);
  
  // Handle search
  const onChangeSearch = (query: string) => {
    setSearchQuery(query);
  };
  
  // Handle filter change
  const handleFilterChange = (newFilter: 'all' | 'meccan' | 'medinan' | 'unknown') => {
    setFilter(newFilter);
  };
  
  // Check if surah is already known
  const isSurahKnown = (surahNumber: number): boolean => {
    return settings?.knownSurahs?.includes(surahNumber) || false;
  };
  
  // Navigate to surah detail
  const goToSurahDetail = (surah: Surah) => {
    router.push({
      pathname: '/surah-browser/detail',
      params: { surahNumber: surah.number.toString() }
    });
  };
  
  // Render surah item
  const renderSurahItem = ({ item }: { item: Surah }) => {
    const isKnown = isSurahKnown(item.number);
    
    return (
      <TouchableOpacity 
        onPress={() => goToSurahDetail(item)}
        style={[styles.surahCard, isKnown && styles.knownSurah]}
      >
        <Card style={[
          styles.card, 
          isKnown && { backgroundColor: theme.colors.surfaceVariant }
        ]}>
          <Card.Content style={styles.cardContent}>
            <View style={styles.surahNumberContainer}>
              <Text style={styles.surahNumber}>{item.number}</Text>
            </View>
            
            <View style={styles.surahInfo}>
              <Text style={styles.surahName}>{item.name}</Text>
              <Text style={styles.surahEnglishName}>{item.englishName}</Text>
              <View style={styles.surahMetaInfo}>
                <Text style={styles.surahAyahCount}>{item.ayahCount} ayahs</Text>
                <Badge style={[
                  styles.revelationBadge,
                  { backgroundColor: item.revelationType === 'Meccan' ? '#FFA000' : '#7B1FA2' }
                ]}>
                  {item.revelationType}
                </Badge>
              </View>
            </View>
            
            <View style={styles.surahArabicContainer}>
              <Text style={styles.surahArabicName}>{item.arabicName}</Text>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };
  
  // Add a floating action button to navigate to home
  const FloatingButton = () => (
    <Button
      mode="contained"
      icon="plus"
      style={styles.floatingButton}
      onPress={() => router.back()}
    >
      Return to Home
    </Button>
  );
  
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading surahs...</Text>
      </View>
    );
  }
  
  if (error) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <Button mode="contained" onPress={() => router.back()}>
          Go Back
        </Button>
      </View>
    );
  }
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Browse Surahs</Text>
        <Searchbar
          placeholder="Search by name or number"
          onChangeText={onChangeSearch}
          value={searchQuery}
          style={styles.searchBar}
        />
        
        <View style={styles.filterContainer}>
          <Chip
            selected={filter === 'all'}
            onPress={() => handleFilterChange('all')}
            style={styles.filterChip}
          >
            All
          </Chip>
          <Chip
            selected={filter === 'meccan'}
            onPress={() => handleFilterChange('meccan')}
            style={styles.filterChip}
          >
            Meccan
          </Chip>
          <Chip
            selected={filter === 'medinan'}
            onPress={() => handleFilterChange('medinan')}
            style={styles.filterChip}
          >
            Medinan
          </Chip>
        </View>
      </View>
      
      <FlatList
        data={filteredSurahs}
        renderItem={renderSurahItem}
        keyExtractor={(item) => item.number.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No surahs found</Text>
          </View>
        }
      />
      
      <FloatingButton />
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
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  searchBar: {
    marginBottom: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  filterChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  listContainer: {
    padding: 8,
    paddingBottom: 80, // Add extra padding for the floating button
  },
  surahCard: {
    marginBottom: 8,
  },
  knownSurah: {
    opacity: 0.7,
  },
  card: {
    elevation: 2,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  surahNumberContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#006064',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  surahNumber: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  surahInfo: {
    flex: 1,
  },
  surahName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  surahEnglishName: {
    fontSize: 14,
    opacity: 0.7,
  },
  surahMetaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  surahAyahCount: {
    fontSize: 12,
    opacity: 0.7,
    marginRight: 8,
  },
  revelationBadge: {
    fontSize: 10,
  },
  surahArabicContainer: {
    marginLeft: 8,
  },
  surahArabicName: {
    fontSize: 18,
    fontFamily: 'Amiri-Regular',
  },
  emptyContainer: {
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    opacity: 0.7,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    borderRadius: 28,
  },
});
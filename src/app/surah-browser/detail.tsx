import React, { useState, useEffect } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Button, SegmentedButtons, RadioButton, useTheme, ActivityIndicator, Divider } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { fetchSurahs, fetchAyahsForSurah } from '../../services/quran/api';
import { createGroupsForSurah } from '../../utils/groupings';
import { useSettings } from '../../contexts/SettingsContext';
import { Surah, Ayah, AyahGroup } from '../../types';
import AyahDisplay from '../../components/AyahDisplay';
import { v4 as uuidv4 } from 'uuid';
import { executeUpdate, executeQuery } from '../../services/database';

export default function SurahDetailScreen() {
  const theme = useTheme();
  const { settings } = useSettings();
  const params = useLocalSearchParams();
  const surahNumber = params.surahNumber ? parseInt(params.surahNumber as string) : 1;
  
  const [surah, setSurah] = useState<Surah | null>(null);
  const [firstAyah, setFirstAyah] = useState<Ayah | null>(null);
  const [groups, setGroups] = useState<AyahGroup[]>([]);
  const [groupingMethod, setGroupingMethod] = useState<'fixed' | 'ruku' | 'page'>(
    settings?.groupingMethod || 'ruku'
  );
  const [groupingSize, setGroupingSize] = useState<number>(
    settings?.groupingSize || 5
  );
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load surah details
  useEffect(() => {
    const loadSurahDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch surah metadata
        const surahs = await fetchSurahs();
        const currentSurah = surahs.find(s => s.number === surahNumber);
        
        if (!currentSurah) {
          setError(`Surah ${surahNumber} not found`);
          setLoading(false);
          return;
        }
        
        setSurah(currentSurah);
        
        // Fetch first ayah for preview
        const ayahs = await fetchAyahsForSurah(surahNumber);
        if (ayahs.length > 0) {
          setFirstAyah(ayahs[0]);
        }
        
        // Create groups
        console.log(`Creating groups for surah ${surahNumber} with method ${groupingMethod} and size ${groupingSize}`);
        const ayahGroups = await createGroupsForSurah(currentSurah, groupingMethod, groupingSize);
        setGroups(ayahGroups);
      } catch (err) {
        console.error('Error loading surah details:', err);
        setError('Failed to load surah details. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadSurahDetails();
  }, [surahNumber, groupingMethod, groupingSize]);
  
  // Handle grouping method change
  const handleGroupingMethodChange = (value: string) => {
    setGroupingMethod(value as 'fixed' | 'ruku' | 'page');
    // Reset groups to trigger a reload with the new method
    setGroups([]);
    setLoading(true);
  };
  
  // Handle grouping size change
  const handleGroupingSizeChange = (value: number) => {
    setGroupingSize(value);
    // Reset groups to trigger a reload with the new size
    setGroups([]);
    setLoading(true);
  };
  
  // Toggle group selection
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prevSelected => {
      if (prevSelected.includes(groupId)) {
        return prevSelected.filter(id => id !== groupId);
      } else {
        return [...prevSelected, groupId];
      }
    });
  };
  
  // Select all groups
  const selectAllGroups = () => {
    setSelectedGroups(groups.map(group => group.id));
  };
  
  // Clear selection
  const clearSelection = () => {
    setSelectedGroups([]);
  };
  
  // Add selected groups to learning queue
  const addToLearningQueue = async () => {
    if (selectedGroups.length === 0) {
      Alert.alert('No groups selected', 'Please select at least one group of ayahs to add to your learning queue.');
      return;
    }
    
    try {
      setAddingToQueue(true);
      
      // For each selected group
      for (const groupId of selectedGroups) {
        const group = groups.find(g => g.id === groupId);
        
        if (group) {
          // Create ayah progress entries for each ayah in the group
          const ayahProgressIds = [];
          let position = 1;
          
          for (let ayahNumber = group.startAyah; ayahNumber <= group.endAyah; ayahNumber++) {
            const ayahProgressId = uuidv4();
            ayahProgressIds.push(ayahProgressId);
            
            // Insert into database
            await executeUpdate(
              `INSERT INTO ayah_progress (
                id, surahNumber, ayahNumber, groupId, recallScore, 
                lastReviewed, nextReview, easeFactor, stability, 
                difficulty, lapses, state, interval, createdAt, history,
                testWithGroup, groupPosition
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                ayahProgressId,
                surahNumber,
                ayahNumber,
                group.id,
                0, // recallScore
                null, // lastReviewed
                null, // nextReview
                2.5, // easeFactor
                0, // stability
                0, // difficulty
                0, // lapses
                'new', // state
                0, // interval
                new Date().toISOString(), // createdAt
                JSON.stringify([]), // history
                group.testAsGroup ? 1 : 0, // testWithGroup
                position // groupPosition
              ]
            );
            
            position++;
          }
          
          // Update group's ayahIds with all the new IDs
          await executeUpdate(
            `UPDATE ayah_groups SET 
              ayahIds = ?,
              state = 'learning'
            WHERE id = ?`,
            [JSON.stringify(ayahProgressIds), group.id]
          );
        }
      }
      
      // Success message
      Alert.alert(
        'Added to Queue', 
        'The selected ayahs have been added to your learning queue.',
        [
          { 
            text: 'Go to Home', 
            onPress: () => router.replace('/') 
          }
        ]
      );
    } catch (err) {
      console.error('Error adding to learning queue:', err);
      Alert.alert('Error', 'Failed to add ayahs to your learning queue. Please try again.');
    } finally {
      setAddingToQueue(false);
    }
  };
  
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loadingText}>Loading surah details...</Text>
      </View>
    );
  }
  
  if (error || !surah) {
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
      <ScrollView style={styles.content}>
        {/* Surah Header */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.surahHeader}>
              <View style={styles.surahInfo}>
                <Text style={styles.surahNumber}>Surah {surah.number}</Text>
                <Text style={styles.surahName}>{surah.name}</Text>
                <Text style={styles.surahEnglishName}>{surah.englishName}</Text>
                <View style={styles.surahMetaInfo}>
                  <Text style={styles.surahMetaText}>{surah.ayahCount} ayahs</Text>
                  <Text style={styles.surahMetaText}>{surah.revelationType}</Text>
                </View>
              </View>
              
              <View style={styles.surahArabicContainer}>
                <Text style={styles.surahArabicName}>{surah.arabicName}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
        
        {/* First Ayah Preview */}
        {firstAyah && (
          <Card style={styles.card}>
            <Card.Content>
              <Text style={styles.sectionTitle}>Preview</Text>
              <AyahDisplay
                ayah={firstAyah}
                showAyahNumber={true}
                showAudio={false}
              />
            </Card.Content>
          </Card>
        )}
        
        {/* Grouping Settings */}
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Grouping Settings</Text>
            
            <Text style={styles.label}>Grouping Method</Text>
            <SegmentedButtons
              value={groupingMethod}
              onValueChange={handleGroupingMethodChange}
              buttons={[
                { value: 'fixed', label: 'Fixed' },
                { value: 'ruku', label: 'Ruku' },
                { value: 'page', label: 'Page' },
              ]}
              style={styles.segmentedButtons}
            />
            
            {groupingMethod === 'fixed' && (
              <View style={styles.groupingSizeContainer}>
                <Text style={styles.label}>Group Size (ayahs)</Text>
                <View style={styles.radioGroup}>
                  {[3, 5, 10].map(size => (
                    <RadioButton.Item
                      key={size}
                      label={size.toString()}
                      value={size.toString()}
                      status={groupingSize === size ? 'checked' : 'unchecked'}
                      onPress={() => handleGroupingSizeChange(size)}
                      style={styles.radioItem}
                    />
                  ))}
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
        
        {/* Available Groups */}
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.groupsHeader}>
              <Text style={styles.sectionTitle}>Available Groups</Text>
              <View style={styles.selectionActions}>
                <Button 
                  mode="text"
                  compact 
                  onPress={selectAllGroups}
                >
                  Select All
                </Button>
                <Button 
                  mode="text"
                  compact 
                  onPress={clearSelection}
                  disabled={selectedGroups.length === 0}
                >
                  Clear
                </Button>
              </View>
            </View>
            
            <View style={styles.groupsList}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.loadingText}>Loading groups...</Text>
                </View>
              ) : groups.length === 0 ? (
                <Text style={styles.noGroupsText}>
                  No groups available for this surah with the current grouping method.
                </Text>
              ) : (
                groups.map((group, index) => (
                  <TouchableOpacity 
                    key={group.id} 
                    style={[
                      styles.groupItem,
                      selectedGroups.includes(group.id) && styles.selectedGroup
                    ]}
                    onPress={() => toggleGroupSelection(group.id)}
                  >
                    <RadioButton
                      value={group.id}
                      status={selectedGroups.includes(group.id) ? 'checked' : 'unchecked'}
                      onPress={() => toggleGroupSelection(group.id)}
                    />
                    <View style={styles.groupInfo}>
                      <Text style={styles.groupTitle}>
                        Ayah {group.startAyah} - {group.endAyah}
                      </Text>
                      <Text style={styles.groupSubtitle}>
                        {group.endAyah - group.startAyah + 1} ayahs
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
      
      {/* Add to Queue Button */}
      <View style={styles.footer}>
        <Button
          mode="contained"
          onPress={addToLearningQueue}
          loading={addingToQueue}
          disabled={addingToQueue || selectedGroups.length === 0}
          style={styles.addButton}
        >
          Add to Learning Queue
        </Button>
      </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
    elevation: 2,
  },
  surahHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  surahInfo: {
    flex: 1,
  },
  surahNumber: {
    fontSize: 14,
    opacity: 0.7,
  },
  surahName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  surahEnglishName: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 8,
  },
  surahMetaInfo: {
    flexDirection: 'row',
  },
  surahMetaText: {
    fontSize: 14,
    opacity: 0.7,
    marginRight: 16,
  },
  surahArabicContainer: {
    marginLeft: 16,
    alignItems: 'flex-end',
  },
  surahArabicName: {
    fontSize: 32,
    fontFamily: 'Amiri-Regular',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
  },
  segmentedButtons: {
    marginBottom: 16,
  },
  groupingSizeContainer: {
    marginTop: 8,
  },
  radioGroup: {
    flexDirection: 'row',
  },
  radioItem: {
    flex: 1,
  },
  groupsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionActions: {
    flexDirection: 'row',
  },
  groupsList: {
    marginTop: 8,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  selectedGroup: {
    backgroundColor: 'rgba(0, 96, 100, 0.1)',
  },
  groupInfo: {
    marginLeft: 8,
  },
  groupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  groupSubtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  noGroupsText: {
    textAlign: 'center',
    marginVertical: 24,
    opacity: 0.7,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  addButton: {
    width: '100%',
  },
});
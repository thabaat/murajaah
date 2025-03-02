import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeUpdate } from '../services/database';
import { AyahGroup, Surah } from '../types';

// Create groups for a surah based on grouping method
export const createGroupsForSurah = async (
  surah: Surah,
  groupingMethod: 'fixed' | 'ruku' | 'page',
  groupingSize: number = 5
): Promise<AyahGroup[]> => {
  try {
    console.log(`Creating groups for surah ${surah.number} with method ${groupingMethod} and size ${groupingSize}`);
    
    // For ruku and page methods, ensure we have the necessary data
    if ((groupingMethod === 'ruku' || groupingMethod === 'page') && 
        (!surah.rukus || surah.rukus.length === 0 || !surah.pages || surah.pages.length === 0)) {
      console.log(`Fetching ayahs for surah ${surah.number} to get ruku and page data`);
      
      try {
        // Import the API module dynamically to avoid circular dependencies
        const { fetchAyahsForSurah } = await import('../services/quran/api');
        
        // Fetch ayahs to get ruku and page data
        await fetchAyahsForSurah(surah.number);
        
        // Fetch the updated surah with ruku and page data
        const updatedSurah = await executeQuery(
          'SELECT * FROM quran_surahs WHERE number = ?',
          [surah.number]
        );
        
        if (updatedSurah.length > 0) {
          try {
            surah.rukus = JSON.parse(updatedSurah[0].rukus || '[]');
            surah.pages = JSON.parse(updatedSurah[0].pages || '[]');
            console.log(`Updated surah data: rukus=${JSON.stringify(surah.rukus)}, pages=${JSON.stringify(surah.pages)}`);
          } catch (error) {
            console.error(`Error parsing updated surah data for surah ${surah.number}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error fetching ayahs for surah ${surah.number}:`, error);
      }
    }
    
    // First check if groups already exist for this surah and method
    let existingGroups;
    
    if (groupingMethod === 'fixed') {
      // For fixed groups, we need to check both the method and size
      // We'll query all fixed groups for this surah
      existingGroups = await executeQuery(
        'SELECT * FROM ayah_groups WHERE surahNumber = ? AND groupType = ? ORDER BY startAyah',
        [surah.number, groupingMethod]
      );
      
      // Check if the first group (if any) has the correct size
      if (existingGroups.length > 0) {
        const firstGroupSize = existingGroups[0].endAyah - existingGroups[0].startAyah + 1;
        console.log(`Found existing fixed groups with first group size: ${firstGroupSize}, requested size: ${groupingSize}`);
        
        // If the size doesn't match, we need to recreate the groups
        if (firstGroupSize !== groupingSize) {
          console.log(`Group size mismatch, recreating groups with size ${groupingSize}`);
          // Delete existing groups for this surah and method
          await executeUpdate(
            'DELETE FROM ayah_groups WHERE surahNumber = ? AND groupType = ?',
            [surah.number, groupingMethod]
          );
          existingGroups = [];
        }
      }
    } else {
      // For other methods, just check the method
      existingGroups = await executeQuery(
        'SELECT * FROM ayah_groups WHERE surahNumber = ? AND groupType = ? ORDER BY startAyah',
        [surah.number, groupingMethod]
      );
    }
    
    // If groups exist, return them
    if (existingGroups.length > 0) {
      console.log(`Returning ${existingGroups.length} existing groups`);
      return existingGroups.map(mapRowToGroup);
    }
    
    // Otherwise, create new groups
    let groups: AyahGroup[] = [];
    
    // Delete any existing groups for this surah and method
    // This ensures we don't have multiple sets of groups for the same surah and method
    await executeUpdate(
      'DELETE FROM ayah_groups WHERE surahNumber = ? AND groupType = ?',
      [surah.number, groupingMethod]
    );
    
    switch (groupingMethod) {
      case 'fixed':
        groups = await createFixedGroups(surah, groupingSize);
        break;
      case 'ruku':
        groups = await createRukuGroups(surah);
        break;
      case 'page':
        groups = await createPageGroups(surah);
        break;
      default:
        groups = await createFixedGroups(surah, groupingSize);
    }
    
    // Set testAsGroup to true for all groups
    groups = groups.map(group => ({
      ...group,
      testAsGroup: true
    }));
    
    // Save groups to database
    for (const group of groups) {
      await saveGroupToDatabase(group);
    }
    
    console.log(`Created ${groups.length} new groups`);
    return groups;
  } catch (error) {
    console.error(`Error creating groups for surah ${surah.number}:`, error);
    throw error;
  }
};

// Create fixed-size groups
const createFixedGroups = async (
  surah: Surah,
  groupSize: number
): Promise<AyahGroup[]> => {
  const groups: AyahGroup[] = [];
  
  // Ensure groupSize is a positive number
  const size = Math.max(1, groupSize || 5);
  console.log(`Creating fixed groups for surah ${surah.number} with size ${size}`);
  
  // Delete any existing fixed groups for this surah with a different size
  await executeUpdate(
    'DELETE FROM ayah_groups WHERE surahNumber = ? AND groupType = ?',
    [surah.number, 'fixed']
  );
  
  for (let start = 1; start <= surah.ayahCount; start += size) {
    const end = Math.min(start + size - 1, surah.ayahCount);
    
    console.log(`Creating fixed group: ayahs ${start}-${end}`);
    
    const group: AyahGroup = {
      id: uuidv4(),
      surahNumber: surah.number,
      startAyah: start,
      endAyah: end,
      groupType: 'fixed',
      progress: 0,
      state: 'new',
      ayahIds: [],
      testAsGroup: true
    };
    
    groups.push(group);
  }
  
  console.log(`Created ${groups.length} fixed groups with size ${size}`);
  return groups;
};

// Create ruku-based groups
const createRukuGroups = async (surah: Surah): Promise<AyahGroup[]> => {
  const groups: AyahGroup[] = [];
  
  console.log(`Creating ruku groups for surah ${surah.number}`);
  console.log(`Rukus data: ${JSON.stringify(surah.rukus)}`);
  
  if (!surah.rukus || surah.rukus.length === 0) {
    console.log(`No rukus defined for surah ${surah.number}, fetching ayahs to get ruku data`);
    
    try {
      // Import the API module dynamically to avoid circular dependencies
      const { fetchAyahsForSurah } = await import('../services/quran/api');
      
      // Fetch ayahs to get ruku data
      await fetchAyahsForSurah(surah.number);
      
      // Fetch the updated surah with ruku data
      const updatedSurah = await executeQuery(
        'SELECT * FROM quran_surahs WHERE number = ?',
        [surah.number]
      );
      
      if (updatedSurah.length > 0) {
        try {
          surah.rukus = JSON.parse(updatedSurah[0].rukus || '[]');
          console.log(`Updated rukus data: ${JSON.stringify(surah.rukus)}`);
        } catch (error) {
          console.error(`Error parsing updated rukus data for surah ${surah.number}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error fetching ayahs for surah ${surah.number} to get ruku data:`, error);
    }
    
    // If still no rukus, fall back to fixed groups
    if (!surah.rukus || surah.rukus.length === 0) {
      console.log(`Still no rukus defined for surah ${surah.number}, falling back to fixed groups of 5`);
      return createFixedGroups(surah, 5);
    }
  }
  
  // Get all ayahs for this surah to determine ruku boundaries
  const ayahs = await executeQuery(
    'SELECT * FROM quran_ayahs WHERE surahNumber = ? ORDER BY ayahNumber',
    [surah.number]
  );
  
  if (ayahs.length === 0) {
    console.log(`No ayahs found for surah ${surah.number}, falling back to fixed groups of 5`);
    return createFixedGroups(surah, 5);
  }
  
  // Group ayahs by ruku
  const rukuMap = new Map<number, { start: number, end: number }>();
  
  for (const ayah of ayahs) {
    const ruku = ayah.ruku;
    const ayahNumber = ayah.ayahNumber;
    
    if (!rukuMap.has(ruku)) {
      rukuMap.set(ruku, { start: ayahNumber, end: ayahNumber });
    } else {
      const current = rukuMap.get(ruku);
      rukuMap.set(ruku, { 
        start: Math.min(current.start, ayahNumber), 
        end: Math.max(current.end, ayahNumber) 
      });
    }
  }
  
  // Create groups based on ruku boundaries
  for (const [ruku, { start, end }] of rukuMap.entries()) {
    console.log(`Creating ruku group ${ruku}: ayahs ${start}-${end}`);
    
    const group: AyahGroup = {
      id: uuidv4(),
      surahNumber: surah.number,
      startAyah: start,
      endAyah: end,
      groupType: 'ruku',
      progress: 0,
      state: 'new',
      ayahIds: [],
      testAsGroup: true
    };
    
    groups.push(group);
  }
  
  // Sort groups by startAyah
  groups.sort((a, b) => a.startAyah - b.startAyah);
  
  console.log(`Created ${groups.length} ruku groups`);
  return groups;
};

// Create page-based groups
const createPageGroups = async (surah: Surah): Promise<AyahGroup[]> => {
  const groups: AyahGroup[] = [];
  
  console.log(`Creating page groups for surah ${surah.number}`);
  console.log(`Pages data: ${JSON.stringify(surah.pages)}`);
  
  if (!surah.pages || surah.pages.length === 0) {
    console.log(`No pages defined for surah ${surah.number}, fetching ayahs to get page data`);
    
    try {
      // Import the API module dynamically to avoid circular dependencies
      const { fetchAyahsForSurah } = await import('../services/quran/api');
      
      // Fetch ayahs to get page data
      await fetchAyahsForSurah(surah.number);
      
      // Fetch the updated surah with page data
      const updatedSurah = await executeQuery(
        'SELECT * FROM quran_surahs WHERE number = ?',
        [surah.number]
      );
      
      if (updatedSurah.length > 0) {
        try {
          surah.pages = JSON.parse(updatedSurah[0].pages || '[]');
          console.log(`Updated pages data: ${JSON.stringify(surah.pages)}`);
        } catch (error) {
          console.error(`Error parsing updated pages data for surah ${surah.number}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error fetching ayahs for surah ${surah.number} to get page data:`, error);
    }
    
    // If still no pages, fall back to fixed groups
    if (!surah.pages || surah.pages.length === 0) {
      console.log(`Still no pages defined for surah ${surah.number}, falling back to fixed groups of 5`);
      return createFixedGroups(surah, 5);
    }
  }
  
  // Get all ayahs for this surah to determine page boundaries
  const ayahs = await executeQuery(
    'SELECT * FROM quran_ayahs WHERE surahNumber = ? ORDER BY ayahNumber',
    [surah.number]
  );
  
  if (ayahs.length === 0) {
    console.log(`No ayahs found for surah ${surah.number}, falling back to fixed groups of 5`);
    return createFixedGroups(surah, 5);
  }
  
  // Group ayahs by page
  const pageMap = new Map<number, { start: number, end: number }>();
  
  for (const ayah of ayahs) {
    const page = ayah.page;
    const ayahNumber = ayah.ayahNumber;
    
    if (!pageMap.has(page)) {
      pageMap.set(page, { start: ayahNumber, end: ayahNumber });
    } else {
      const current = pageMap.get(page);
      pageMap.set(page, { 
        start: Math.min(current.start, ayahNumber), 
        end: Math.max(current.end, ayahNumber) 
      });
    }
  }
  
  // Create groups based on page boundaries
  for (const [page, { start, end }] of pageMap.entries()) {
    console.log(`Creating page group ${page}: ayahs ${start}-${end}`);
    
    const group: AyahGroup = {
      id: uuidv4(),
      surahNumber: surah.number,
      startAyah: start,
      endAyah: end,
      groupType: 'page',
      progress: 0,
      state: 'new',
      ayahIds: [],
      testAsGroup: true
    };
    
    groups.push(group);
  }
  
  // Sort groups by startAyah
  groups.sort((a, b) => a.startAyah - b.startAyah);
  
  console.log(`Created ${groups.length} page groups`);
  return groups;
};

// Get groups for a surah
export const getGroupsForSurah = async (surahNumber: number): Promise<AyahGroup[]> => {
  const rows = await executeQuery(
    'SELECT * FROM ayah_groups WHERE surahNumber = ? ORDER BY startAyah',
    [surahNumber]
  );
  
  return rows.map(mapRowToGroup);
};

// Get group by ID
export const getGroupById = async (groupId: string): Promise<AyahGroup | null> => {
  const rows = await executeQuery('SELECT * FROM ayah_groups WHERE id = ?', [groupId]);
  
  if (rows.length === 0) {
    return null;
  }
  
  return mapRowToGroup(rows[0]);
};

// Update group progress
export const updateGroupProgress = async (
  groupId: string,
  progress: number,
  state: 'new' | 'learning' | 'review' | 'complete'
): Promise<void> => {
  await executeUpdate(
    'UPDATE ayah_groups SET progress = ?, state = ? WHERE id = ?',
    [progress, state, groupId]
  );
};

// Add an ayah to a group
export const addAyahToGroup = async (groupId: string, ayahId: string): Promise<void> => {
  const group = await getGroupById(groupId);
  
  if (!group) {
    throw new Error(`Group not found: ${groupId}`);
  }
  
  const ayahIds = [...group.ayahIds, ayahId];
  
  await executeUpdate(
    'UPDATE ayah_groups SET ayahIds = ? WHERE id = ?',
    [JSON.stringify(ayahIds), groupId]
  );
};

// Save a group to the database
const saveGroupToDatabase = async (group: AyahGroup): Promise<void> => {
  await executeUpdate(
    `INSERT INTO ayah_groups (
      id, surahNumber, startAyah, endAyah, 
      groupType, progress, state, ayahIds, testAsGroup
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      group.id,
      group.surahNumber,
      group.startAyah,
      group.endAyah,
      group.groupType,
      group.progress,
      group.state,
      JSON.stringify(group.ayahIds),
      group.testAsGroup ? 1 : 0
    ]
  );
};

// Helper function to map database row to AyahGroup object
const mapRowToGroup = (row: any): AyahGroup => {
  let ayahIds: string[] = [];
  try {
    ayahIds = JSON.parse(row.ayahIds || '[]');
  } catch (error) {
    console.error('Error parsing ayahIds:', error);
  }

  return {
    id: row.id,
    surahNumber: row.surahNumber,
    startAyah: row.startAyah,
    endAyah: row.endAyah,
    groupType: row.groupType as 'fixed' | 'ruku' | 'page' | 'custom',
    progress: row.progress,
    state: row.state as 'new' | 'learning' | 'review' | 'complete',
    ayahIds: ayahIds,
    testAsGroup: row.testAsGroup === 1
  };
};
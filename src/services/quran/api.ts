import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { executeQuery, executeUpdate } from '../database';
import { Surah, Ayah } from '../../types';
import { getCacheDirectory } from '../../utils/storage';
import { getSettings } from '../database/settings';

// API base URL - Updated to QuranhHub
const API_BASE_URL = 'https://api.quranhub.com/v1';

// Quran.com API base URL for IndoPak script
const QURAN_COM_API_URL = 'https://api.quran.com/api/v4';

// Cache keys
const CACHE_KEYS = {
  SURAHS: 'quran_surahs_cache',
  AYAHS_PREFIX: 'quran_ayahs_surah_',
  AUDIO_PREFIX: 'quran_audio_',
};

// Download audio for a surah
export const downloadAudioForSurah = async (
  surahNumber: number,
  ayahs: Ayah[]
): Promise<void> => {
  const cacheDir = await getCacheDirectory();
  
  // Create surah directory if it doesn't exist
  const surahDir = `${cacheDir}/audio/surah-${surahNumber}`;
  await ensureDirectoryExists(surahDir);
  
  console.log(`Downloading audio for Surah ${surahNumber} with ${ayahs.length} ayahs`);
  
  // Track success and failures
  let successCount = 0;
  let failureCount = 0;
  
  // Download audio for each ayah
  for (const ayah of ayahs) {
    try {
      await downloadAudio(surahNumber, ayah.ayahNumber);
      successCount++;
      
      // Log progress every 10 ayahs
      if (successCount % 10 === 0) {
        console.log(`Downloaded ${successCount}/${ayahs.length} ayahs for Surah ${surahNumber}`);
      }
    } catch (error) {
      failureCount++;
      console.error(`Failed to download audio for Surah ${surahNumber}, Ayah ${ayah.ayahNumber}:`, error);
    }
  }
  
  console.log(`Completed audio download for Surah ${surahNumber}: ${successCount} successful, ${failureCount} failed`);
};

// Download audio for a specific ayah
export const downloadAudio = async (
  surahNumber: number, 
  ayahNumber: number
): Promise<string> => {
  const cacheDir = await getCacheDirectory();
  const audioDir = `${cacheDir}/audio/surah-${surahNumber}`;
  const fileName = `ayah-${ayahNumber}.mp3`;
  const filePath = `${audioDir}/${fileName}`;
  
  // Ensure the directory exists before proceeding
  await ensureDirectoryExists(audioDir);
  
  // Check if file already exists
  const fileInfo = await FileSystem.getInfoAsync(filePath);
  
  if (fileInfo.exists) {
    // Update database with local path
    await updateAudioPath(surahNumber, ayahNumber, filePath);
    return filePath;
  }
  
  // Get the primary URL
  const primaryUrl = getAudioUrl(surahNumber, ayahNumber);
  
  try {
    // Try to download from primary URL
    const downloadResult = await FileSystem.downloadAsync(primaryUrl, filePath);
    
    if (downloadResult.status === 200) {
      // Update database with local path
      await updateAudioPath(surahNumber, ayahNumber, filePath);
      return filePath;
    } else {
      throw new Error(`Failed to download audio: ${downloadResult.status}`);
    }
  } catch (primaryError) {
    console.error(`Error downloading audio from primary URL for ${surahNumber}:${ayahNumber}:`, primaryError);
    
    // Try backup URL if primary fails
    try {
      const backupUrl = getBackupAudioUrl(surahNumber, ayahNumber);
      console.log(`Trying backup URL for ${surahNumber}:${ayahNumber}: ${backupUrl}`);
      
      const backupDownloadResult = await FileSystem.downloadAsync(backupUrl, filePath);
      
      if (backupDownloadResult.status === 200) {
        // Update database with local path
        await updateAudioPath(surahNumber, ayahNumber, filePath);
        return filePath;
      } else {
        throw new Error(`Failed to download audio from backup URL: ${backupDownloadResult.status}`);
      }
    } catch (backupError) {
      console.error(`Error downloading audio from backup URL for ${surahNumber}:${ayahNumber}:`, backupError);
      throw new Error(`Failed to download audio from both primary and backup URLs`);
    }
  }
};

// Get audio URL for Abdullah Basfar recitation
export const getAudioUrl = (surahNumber: number, ayahNumber: number): string => {
  // Format surah and ayah numbers with leading zeros
  const formattedSurah = surahNumber.toString().padStart(3, '0');
  const formattedAyah = ayahNumber.toString().padStart(3, '0');
  
  // Use everyayah.com for Abdullah Basfar recitation (192kbps)
  const primaryUrl = `https://everyayah.com/data/Abdullah_Basfar_192kbps/${formattedSurah}${formattedAyah}.mp3`;
  
  // Return the primary URL. The AudioPlayer component will handle fallback if needed
  return primaryUrl;
};

// Get backup audio URL for Abdullah Basfar recitation
export const getBackupAudioUrl = (surahNumber: number, ayahNumber: number): string => {
  // Format surah and ayah numbers with leading zeros
  const formattedSurah = surahNumber.toString().padStart(3, '0');
  const formattedAyah = ayahNumber.toString().padStart(3, '0');
  
  // Backup URL with lower quality (64kbps)
  return `https://everyayah.com/data/Abdullah_Basfar_64kbps/${formattedSurah}${formattedAyah}.mp3`;
};

// Test if an audio URL is accessible
export const testAudioUrl = async (url: string): Promise<boolean> => {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.status === 200;
  } catch (error) {
    console.error('Error testing audio URL:', error);
    return false;
  }
};

// Update audio path in database
const updateAudioPath = async (
  surahNumber: number, 
  ayahNumber: number, 
  audioPath: string
): Promise<void> => {
  await executeUpdate(
    'UPDATE quran_ayahs SET audioPath = ? WHERE surahNumber = ? AND ayahNumber = ?',
    [audioPath, surahNumber, ayahNumber]
  );
};

// Save ayahs to database
const saveAyahsToDatabase = async (ayahs: Ayah[], scriptType: string = 'uthmani'): Promise<void> => {
  for (const ayah of ayahs) {
    await executeUpdate(
      `INSERT OR REPLACE INTO quran_ayahs (
        surahNumber, ayahNumber, text, audioUrl, audioPath, ruku, page, scriptType
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ayah.surahNumber,
        ayah.ayahNumber,
        ayah.text,
        ayah.audioUrl,
        null, // audioPath will be updated when downloaded
        ayah.ruku,
        ayah.page,
        scriptType
      ]
    );
  }
};

// Helper: Ensure directory exists
const ensureDirectoryExists = async (dirPath: string): Promise<void> => {
  const dirInfo = await FileSystem.getInfoAsync(dirPath);
  
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
  }
};

// Helper function to map database row to Surah object
const mapRowToSurah = (row: any): Surah => {
  let rukus: number[] = [];
  let pages: number[] = [];
  let recommendedGroups: number[][] = [];
  
  try {
    rukus = JSON.parse(row.rukus || '[]');
    pages = JSON.parse(row.pages || '[]');
    recommendedGroups = JSON.parse(row.recommendedGroups || '[]');
  } catch (error) {
    console.error('Error parsing Surah data:', error);
  }
  
  const surah = {
    number: row.number,
    name: row.name,
    arabicName: row.arabicName,
    englishName: row.englishName,
    ayahCount: row.ayahCount,
    revelationType: row.revelationType as 'Meccan' | 'Medinan',
    rukus: rukus,
    pages: pages,
    recommendedGroups: recommendedGroups
  };
  
  console.log(`Loaded surah ${surah.number} (${surah.name}) with ${rukus.length} rukus and ${pages.length} pages`);
  
  return surah;
};

// Helper function to map database row to Ayah object
const mapRowToAyah = (row: any): Ayah => {
  if (!row) {
    console.error('Attempted to map null or undefined row to Ayah');
    throw new Error('Invalid database row: null or undefined');
  }
  
  if (typeof row.surahNumber === 'undefined' || typeof row.ayahNumber === 'undefined') {
    console.error('Invalid database row missing required fields:', row);
    throw new Error('Invalid database row: missing required fields');
  }
  
  // Ensure audioPath is properly handled
  let audioPath = row.audioPath || null;
  
  // If we have an audioPath, verify it exists
  if (audioPath) {
    // We'll trust that the path exists since we've already verified it when downloading
    console.log(`Using existing audio path for ${row.surahNumber}:${row.ayahNumber}: ${audioPath}`);
  }
  
  return {
    surahNumber: row.surahNumber,
    ayahNumber: row.ayahNumber,
    text: row.text || '',
    translation: '', // Empty string instead of using row.translation
    audioUrl: row.audioUrl || getAudioUrl(row.surahNumber, row.ayahNumber),
    audioPath: audioPath,
    ruku: row.ruku || 0,
    page: row.page || 0,
    scriptType: row.scriptType || 'uthmani'
  };
};

// Cache expiration time (7 days in milliseconds)
const CACHE_EXPIRATION = 7 * 24 * 60 * 60 * 1000;

// Fetch all surahs
export const fetchSurahs = async (): Promise<Surah[]> => {
  try {
    // Check cache first
    const cachedData = await AsyncStorage.getItem(CACHE_KEYS.SURAHS);
    
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      // If cache is still valid, return cached data
      if (Date.now() - timestamp < CACHE_EXPIRATION) {
        return data;
      }
    }
    
    // Fetch from local database
    const dbSurahs = await executeQuery('SELECT * FROM quran_surahs');
    
    if (dbSurahs.length > 0) {
      const surahs = dbSurahs.map(mapRowToSurah);
      
      // Update cache
      await AsyncStorage.setItem(
        CACHE_KEYS.SURAHS,
        JSON.stringify({ data: surahs, timestamp: Date.now() })
      );
      
      return surahs;
    }
    
    // If not in DB, fetch from QuranhHub API
    console.log('Fetching surahs from QuranhHub API');
    const response = await fetch(`${API_BASE_URL}/surah/`);
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.data || !Array.isArray(result.data)) {
      console.error('Invalid API response for surahs:', result);
      throw new Error('Invalid API response for surahs');
    }
    
    console.log(`Received ${result.data.length} surahs from QuranhHub API`);
    
    // Map to our model
    const surahs = result.data.map((surah: any) => ({
      number: surah.number,
      name: surah.name,
      arabicName: surah.name,
      englishName: surah.englishName,
      ayahCount: surah.numberOfAyahs,
      revelationType: surah.revelationType,
      rukus: [], // Will be populated when fetching ayahs for a specific surah
      pages: [], // Will be populated when fetching ayahs for a specific surah
      recommendedGroups: []
    }));
    
    // Save to database
    for (const surah of surahs) {
      await executeUpdate(
        `INSERT OR REPLACE INTO quran_surahs (
          number, name, arabicName, englishName, ayahCount, 
          revelationType, rukus, pages, recommendedGroups
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          surah.number,
          surah.name,
          surah.arabicName,
          surah.englishName,
          surah.ayahCount,
          surah.revelationType,
          JSON.stringify([]),
          JSON.stringify([]),
          JSON.stringify([])
        ]
      );
    }
    
    // Update cache
    await AsyncStorage.setItem(
      CACHE_KEYS.SURAHS,
      JSON.stringify({ data: surahs, timestamp: Date.now() })
    );
    
    return surahs;
  } catch (error) {
    console.error('Error fetching surahs:', error);
    throw error;
  }
};

// Fetch ayahs for a specific surah
export const fetchAyahsForSurah = async (surahNumber: number): Promise<Ayah[]> => {
  try {
    // Get user's script preference
    const settings = await getSettings();
    const scriptType = settings.quranScript || 'uthmani';
    
    console.log(`Fetching ayahs for surah ${surahNumber} with script ${scriptType}`);
    
    // Create cache key with script type
    const cacheKey = `${CACHE_KEYS.AYAHS_PREFIX}${surahNumber}_${scriptType}`;
    
    // Check cache first
    const cachedData = await AsyncStorage.getItem(cacheKey);
    
    if (cachedData) {
      const { data, timestamp } = JSON.parse(cachedData);
      
      // Check if cache is still valid (not expired)
      if (Date.now() - timestamp < CACHE_EXPIRATION) {
        console.log(`Using cached ayahs for surah ${surahNumber} with script ${scriptType}`);
        return data;
      }
      
      console.log(`Cache expired for surah ${surahNumber}, fetching fresh data`);
    }
    
    // Check database next
    console.log(`Fetching ayahs for surah ${surahNumber} from database with script ${scriptType}`);
    const rows = await executeQuery(
      'SELECT * FROM quran_ayahs WHERE surahNumber = ? AND scriptType = ? ORDER BY ayahNumber',
      [surahNumber, scriptType]
    );
    
    if (rows.length > 0) {
      console.log(`Found ${rows.length} ayahs for surah ${surahNumber} in database with script ${scriptType}`);
      
      // Map database rows to Ayah objects
      const ayahs = rows.map(mapRowToAyah);
      
      // Update cache
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ data: ayahs, timestamp: Date.now() })
      );
      
      return ayahs;
    }
    
    // If not in database, fetch from API
    console.log(`Fetching ayahs for surah ${surahNumber} from API with script ${scriptType}`);
    
    let response;
    let result;
    
    if (scriptType === 'indopak') {
      // Use Quran.com API for IndoPak script
      response = await fetch(`${QURAN_COM_API_URL}/quran/verses/indopak?chapter_number=${surahNumber}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      result = await response.json();
      
      // Extract ayahs from Quran.com API response
      const ayahs = result.verses.map((verse: any) => {
        // Parse verse_key to get ayah number (format: "1:1" where second part is ayah number)
        const ayahNumber = parseInt(verse.verse_key.split(':')[1]);
        
        return {
          surahNumber,
          ayahNumber,
          text: verse.text_indopak || '',
          translation: '',
          audioUrl: getAudioUrl(surahNumber, ayahNumber),
          audioPath: null,
          ruku: 0, // We'll need to update this later
          page: 0, // We'll need to update this later
          scriptType: 'indopak'
        };
      });
      
      // Update cache
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ data: ayahs, timestamp: Date.now() })
      );
      
      // Save to database
      await saveAyahsToDatabase(ayahs, 'indopak');
      
      console.log(`Successfully processed ${ayahs.length} ayahs for surah ${surahNumber} with IndoPak script`);
      
      // We still need to fetch the ruku and page information from QuranhHub API
      // This is a separate call to get the metadata we need
      const metadataResponse = await fetch(`${API_BASE_URL}/surah/${surahNumber}`);
      
      if (!metadataResponse.ok) {
        console.warn(`Could not fetch metadata for surah ${surahNumber}: ${metadataResponse.status}`);
        return ayahs;
      }
      
      const metadataResult = await metadataResponse.json();
      
      // Extract ruku and page information
      const rukus: number[] = [];
      const pages: number[] = [];
      
      metadataResult.data.ayahs.forEach((ayah: any) => {
        // Track unique ruku start positions
        if (ayah.numberInSurah === 1 || !rukus.includes(ayah.ruku)) {
          rukus.push(ayah.ruku);
        }
        
        // Track unique page start positions
        if (ayah.numberInSurah === 1 || !pages.includes(ayah.page)) {
          pages.push(ayah.page);
        }
        
        // Update the corresponding ayah in our array with ruku and page info
        const matchingAyah = ayahs.find(a => a.ayahNumber === ayah.numberInSurah);
        if (matchingAyah) {
          matchingAyah.ruku = ayah.ruku;
          matchingAyah.page = ayah.page;
        }
      });
      
      // Sort rukus and pages
      rukus.sort((a, b) => a - b);
      pages.sort((a, b) => a - b);
      
      console.log(`Extracted ruku information: ${JSON.stringify(rukus)}`);
      console.log(`Extracted page information: ${JSON.stringify(pages)}`);
      
      // Update surah with ruku and page information
      await executeUpdate(
        'UPDATE quran_surahs SET rukus = ?, pages = ? WHERE number = ?',
        [JSON.stringify(rukus), JSON.stringify(pages), surahNumber]
      );
      
      // Update ayahs in database with ruku and page information
      for (const ayah of ayahs) {
        await executeUpdate(
          'UPDATE quran_ayahs SET ruku = ?, page = ? WHERE surahNumber = ? AND ayahNumber = ? AND scriptType = ?',
          [ayah.ruku, ayah.page, surahNumber, ayah.ayahNumber, 'indopak']
        );
      }
      
      return ayahs;
    } else {
      // Use QuranhHub API for Uthmani script (default)
      response = await fetch(`${API_BASE_URL}/surah/${surahNumber}`);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      result = await response.json();
      
      // Extract ruku and page information
      const rukus: number[] = [];
      const pages: number[] = [];
      
      // Map to our model
      const ayahs = result.data.ayahs.map((ayah: any) => {
        // Track unique ruku start positions
        if (ayah.numberInSurah === 1 || !rukus.includes(ayah.ruku)) {
          rukus.push(ayah.ruku);
        }
        
        // Track unique page start positions
        if (ayah.numberInSurah === 1 || !pages.includes(ayah.page)) {
          pages.push(ayah.page);
        }
        
        return {
          surahNumber,
          ayahNumber: ayah.numberInSurah,
          text: ayah.text || '',
          translation: '', // Empty string instead of fetching translation
          audioUrl: getAudioUrl(surahNumber, ayah.numberInSurah),
          audioPath: null,
          ruku: ayah.ruku,
          page: ayah.page,
          scriptType: 'uthmani'
        };
      });
      
      // Sort rukus and pages
      rukus.sort((a, b) => a - b);
      pages.sort((a, b) => a - b);
      
      console.log(`Extracted ruku information: ${JSON.stringify(rukus)}`);
      console.log(`Extracted page information: ${JSON.stringify(pages)}`);
      
      // Update surah with ruku and page information
      await executeUpdate(
        'UPDATE quran_surahs SET rukus = ?, pages = ? WHERE number = ?',
        [JSON.stringify(rukus), JSON.stringify(pages), surahNumber]
      );
      
      // Update cache
      await AsyncStorage.setItem(
        cacheKey,
        JSON.stringify({ data: ayahs, timestamp: Date.now() })
      );
      
      // Save to database
      await saveAyahsToDatabase(ayahs, 'uthmani');
      
      console.log(`Successfully processed ${ayahs.length} ayahs for surah ${surahNumber} with Uthmani script`);
      return ayahs;
    }
  } catch (error) {
    console.error(`Error fetching ayahs for surah ${surahNumber}:`, error);
    throw error;
  }
};

// Download all Quran content for offline use
export const downloadQuranForOffline = async (
  progressCallback?: (progress: number) => void
): Promise<void> => {
  try {
    // Get all surahs
    const surahs = await fetchSurahs();
    const totalSurahs = surahs.length;
    
    // Get user's script preference
    const settings = await getSettings();
    const scriptType = settings.quranScript || 'uthmani';
    
    console.log(`Downloading Quran content for offline use with script type: ${scriptType}`);
    
    // Download each surah's ayahs and audio
    for (let i = 0; i < totalSurahs; i++) {
      const surah = surahs[i];
      
      // Fetch ayahs for this surah
      const ayahs = await fetchAyahsForSurah(surah.number);
      
      // Download audio for each ayah
      await downloadAudioForSurah(surah.number, ayahs);
      
      // Update progress
      if (progressCallback) {
        progressCallback((i + 1) / totalSurahs);
      }
    }
    
    // Update settings to indicate offline mode is enabled
    await executeUpdate(
      'UPDATE settings SET offlineMode = 1, updatedAt = ? WHERE id = ?',
      [new Date().toISOString(), 'default']
    );
  } catch (error) {
    console.error('Error downloading Quran for offline use:', error);
    throw error;
  }
};

// Preload audio for all ayahs in a session
export const preloadSessionAudio = async (
  ayahs: { surahNumber: number; ayahNumber: number }[]
): Promise<void> => {
  if (!ayahs || ayahs.length === 0) {
    console.log('No ayahs provided for audio preloading');
    return;
  }
  
  console.log(`Preloading audio for ${ayahs.length} ayahs in session`);
  
  // Group ayahs by surah for more efficient downloading
  const ayahsBySurah = new Map<number, number[]>();
  
  ayahs.forEach(ayah => {
    if (!ayahsBySurah.has(ayah.surahNumber)) {
      ayahsBySurah.set(ayah.surahNumber, []);
    }
    ayahsBySurah.get(ayah.surahNumber).push(ayah.ayahNumber);
  });
  
  // Track progress
  let completedCount = 0;
  let failedCount = 0;
  
  // Download audio for each surah's ayahs in parallel
  const downloadPromises = Array.from(ayahsBySurah.entries()).map(async ([surahNumber, ayahNumbers]) => {
    try {
      console.log(`Preloading audio for Surah ${surahNumber} with ${ayahNumbers.length} ayahs`);
      
      // Process ayahs in batches to avoid overwhelming the device
      const BATCH_SIZE = 5;
      for (let i = 0; i < ayahNumbers.length; i += BATCH_SIZE) {
        const batch = ayahNumbers.slice(i, i + BATCH_SIZE);
        
        // Download each ayah in the batch in parallel
        await Promise.all(batch.map(async (ayahNumber) => {
          try {
            await downloadAudio(surahNumber, ayahNumber);
            completedCount++;
            
            // Log progress every 10 ayahs
            if (completedCount % 10 === 0) {
              console.log(`Preloaded ${completedCount}/${ayahs.length} ayahs`);
            }
          } catch (error) {
            failedCount++;
            console.error(`Failed to preload audio for Surah ${surahNumber}, Ayah ${ayahNumber}:`, error);
          }
        }));
      }
    } catch (error) {
      console.error(`Error preloading audio for Surah ${surahNumber}:`, error);
    }
  });
  
  // Wait for all downloads to complete
  await Promise.all(downloadPromises);
  
  console.log(`Audio preloading complete: ${completedCount} successful, ${failedCount} failed`);
};
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { fetchInitialSurahs } from '../quran/initialData';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Database name
const DATABASE_NAME = 'murajaah.db';

// Singleton database connection
let db: SQLite.SQLiteDatabase;

// Debug flag to control database reset
export const RESET_DATABASE_ON_STARTUP = true;

// Initialize the database
export const initDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) {
    // Close existing connection if any
    await db.closeAsync();
    db = null;
  }

  // Reset database if debug flag is true
  if (RESET_DATABASE_ON_STARTUP) {
    try {
      // Clear all AsyncStorage data
      await AsyncStorage.clear();
      console.log('Cleared AsyncStorage');

      if (Platform.OS === 'ios' || Platform.OS === 'android') {
        // Delete the database file if it exists
        const dbPath = `${FileSystem.documentDirectory}SQLite/${DATABASE_NAME}`;
        const { exists } = await FileSystem.getInfoAsync(dbPath);
        if (exists) {
          await FileSystem.deleteAsync(dbPath);
          console.log('Deleted existing database');
        }

        // Clear the app's cache directory
        const cacheDir = `${FileSystem.cacheDirectory}muraajah`;
        const { exists: cacheExists } = await FileSystem.getInfoAsync(cacheDir);
        if (cacheExists) {
          await FileSystem.deleteAsync(cacheDir, { idempotent: true });
          console.log('Cleared cache directory');
        }
      }
    } catch (error) {
      console.error('Error resetting database:', error);
    }
  }

  // If on web, return a mock database
  if (Platform.OS === 'web') {
    db = {
      execAsync: () => Promise.resolve(),
      runAsync: () => Promise.resolve({ lastInsertRowId: -1, changes: 0 }),
      getFirstAsync: () => Promise.resolve(null),
      getAllAsync: () => Promise.resolve([]),
      closeAsync: () => Promise.resolve(),
    } as any;
    return db;
  }

  // For iOS/Android, open/create database
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    
    if (RESET_DATABASE_ON_STARTUP) {
      // Drop and recreate all tables to ensure clean state
      await db.execAsync(`
        DROP TABLE IF EXISTS ayah_progress;
        DROP TABLE IF EXISTS settings;
        DROP TABLE IF EXISTS session_statistics;
        DROP TABLE IF EXISTS quran_surahs;
        DROP TABLE IF EXISTS quran_ayahs;
      `);
      console.log('Dropped all tables');
    }
    
    await createTables();
    console.log('Created/verified tables');
    
    return db;
  }

  throw new Error(`Unsupported platform: ${Platform.OS}`);
};

// Create database tables
const createTables = async (): Promise<void> => {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      easeFactor REAL NOT NULL DEFAULT 2.5,
      requestRetention REAL NOT NULL DEFAULT 0.9,
      reviewLimit INTEGER NOT NULL DEFAULT 50,
      newAyahsPerDay INTEGER NOT NULL DEFAULT 5,
      groupingMethod TEXT NOT NULL DEFAULT 'recommended',
      groupingSize INTEGER NOT NULL DEFAULT 5,
      theme TEXT NOT NULL DEFAULT 'system',
      quranScript TEXT NOT NULL DEFAULT 'uthmani',
      audioEnabled INTEGER NOT NULL DEFAULT 1,
      offlineMode INTEGER NOT NULL DEFAULT 0,
      knownSurahs TEXT NOT NULL DEFAULT '[]',
      fsrsParameters TEXT NOT NULL DEFAULT '[]',
      learningSteps TEXT NOT NULL DEFAULT '[1, 10, 60, 360]',
      lapseSteps TEXT NOT NULL DEFAULT '[10, 60]',
      maxReviewsPerSession INTEGER NOT NULL DEFAULT 20,
      reviewAheadDays INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ayah_progress (
      id TEXT PRIMARY KEY,
      surahNumber INTEGER NOT NULL,
      ayahNumber INTEGER NOT NULL,
      groupId TEXT NOT NULL,
      recallScore REAL NOT NULL DEFAULT 0,
      lastReviewed TEXT,
      nextReview TEXT,
      easeFactor REAL NOT NULL DEFAULT 2.5,
      stability REAL NOT NULL DEFAULT 0,
      difficulty REAL NOT NULL DEFAULT 0,
      lapses INTEGER NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'new',
      interval INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      history TEXT NOT NULL DEFAULT '[]',
      testWithGroup INTEGER NOT NULL DEFAULT 0,
      groupPosition INTEGER NOT NULL DEFAULT 0,
      UNIQUE(surahNumber, ayahNumber)
    );

    CREATE TABLE IF NOT EXISTS ayah_groups (
      id TEXT PRIMARY KEY,
      surahNumber INTEGER NOT NULL,
      startAyah INTEGER NOT NULL,
      endAyah INTEGER NOT NULL,
      groupType TEXT NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      state TEXT NOT NULL DEFAULT 'new',
      ayahIds TEXT NOT NULL DEFAULT '[]',
      testAsGroup INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_statistics (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      totalReviewed INTEGER NOT NULL DEFAULT 0,
      newLearned INTEGER NOT NULL DEFAULT 0,
      reviewTime INTEGER NOT NULL DEFAULT 0,
      ratingAgain INTEGER NOT NULL DEFAULT 0,
      ratingHard INTEGER NOT NULL DEFAULT 0,
      ratingGood INTEGER NOT NULL DEFAULT 0,
      ratingEasy INTEGER NOT NULL DEFAULT 0,
      retention REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS quran_surahs (
      number INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      arabicName TEXT NOT NULL,
      englishName TEXT NOT NULL,
      ayahCount INTEGER NOT NULL,
      revelationType TEXT NOT NULL,
      rukus TEXT NOT NULL,
      pages TEXT NOT NULL,
      recommendedGroups TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quran_ayahs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      surahNumber INTEGER NOT NULL,
      ayahNumber INTEGER NOT NULL,
      text TEXT NOT NULL,
      translation TEXT,
      audioUrl TEXT NOT NULL,
      audioPath TEXT,
      ruku INTEGER,
      page INTEGER,
      scriptType TEXT NOT NULL DEFAULT 'uthmani',
      UNIQUE(surahNumber, ayahNumber, scriptType)
    );
  `);
};

// Execute a SQL query and return results
export const executeQuery = async (
  query: string,
  params: any[] = []
): Promise<any[]> => {
  // Ensure database is initialized
  if (!db) {
    await initDatabase();
  }
  return db.getAllAsync(query, params);
};

// Insert or update a record
export const executeUpdate = async (
  query: string,
  params: any[] = []
): Promise<number> => {
  // Ensure database is initialized
  if (!db) {
    await initDatabase();
  }
  const result = await db.runAsync(query, params);
  return result.changes;
};

// Load initial data if needed
export const loadInitialData = async (): Promise<void> => {
  // Check if surahs are already loaded
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM quran_surahs'
  );

  console.log(`Database check: ${result?.count || 0} surahs found in database`);

  // If surahs don't exist, fetch them from the API
  if (!result?.count) {
    try {
      console.log('No surahs found in database, fetching from API...');
      
      // Import the API module dynamically to avoid circular dependencies
      const { fetchSurahs } = await import('../quran/api');
      
      // Fetch surahs data from the API
      const surahsData = await fetchSurahs();
      console.log(`Fetched ${surahsData.length} surahs from API`);

      // Verification will happen in the fetchSurahs function
    } catch (error) {
      console.error('Error loading initial data:', error);
      throw error;
    }
  }
};

// Close the database
export const closeDatabase = async (): Promise<void> => {
  if (db) {
    await db.closeAsync();
  }
};

// Check and update ruku and page data if needed
export const checkAndUpdateSurahData = async (): Promise<void> => {
  try {
    console.log('Checking surah data for ruku and page information...');
    
    // Get all surahs from the database
    const surahs = await executeQuery('SELECT * FROM quran_surahs');
    let updatesNeeded = 0;
    
    for (const surah of surahs) {
      let rukus: number[] = [];
      let pages: number[] = [];
      
      try {
        rukus = JSON.parse(surah.rukus || '[]');
        pages = JSON.parse(surah.pages || '[]');
      } catch (error) {
        console.error(`Error parsing ruku/page data for surah ${surah.number}:`, error);
      }
      
      // Check if ruku or page data is missing
      if (rukus.length === 0 || pages.length === 0) {
        console.log(`Surah ${surah.number} (${surah.name}) is missing ruku or page data, updating...`);
        updatesNeeded++;
        
        // Generate default data
        const ayahCount = surah.ayahCount;
        const newRukus = rukus.length === 0 ? generateDefaultRukus(ayahCount) : rukus;
        const newPages = pages.length === 0 ? generateDefaultPages(ayahCount) : pages;
        
        // Update the database
        await executeUpdate(
          'UPDATE quran_surahs SET rukus = ?, pages = ? WHERE number = ?',
          [JSON.stringify(newRukus), JSON.stringify(newPages), surah.number]
        );
        
        console.log(`Updated surah ${surah.number} with ${newRukus.length} rukus and ${newPages.length} pages`);
      }
    }
    
    console.log(`Surah data check complete. ${updatesNeeded} surahs updated.`);
  } catch (error) {
    console.error('Error checking surah data:', error);
  }
};

// Generate default rukus for a surah
const generateDefaultRukus = (ayahCount: number): number[] => {
  const rukus: number[] = [1]; // First ruku always starts at ayah 1
  
  // For short surahs, just one ruku
  if (ayahCount <= 10) {
    return rukus;
  }
  
  // For medium surahs, create rukus of ~10 ayahs
  if (ayahCount <= 50) {
    for (let i = 11; i <= ayahCount; i += 10) {
      rukus.push(i);
    }
    return rukus;
  }
  
  // For long surahs, create rukus of ~15 ayahs
  for (let i = 16; i <= ayahCount; i += 15) {
    rukus.push(i);
  }
  
  return rukus;
};

// Generate default pages for a surah
const generateDefaultPages = (ayahCount: number): number[] => {
  const pages: number[] = [1]; // First page always starts at ayah 1
  
  // For short surahs, just one page
  if (ayahCount <= 15) {
    return pages;
  }
  
  // Create pages of ~15 ayahs
  for (let i = 16; i <= ayahCount; i += 15) {
    pages.push(i);
  }
  
  return pages;
};
import { executeQuery, executeUpdate } from './index';
import { UserSettings } from '../../types';
import { DEFAULT_PARAMETERS } from '../fsrs';

// Default settings ID
const DEFAULT_SETTINGS_ID = 'default';

// Get user settings
export const getSettings = async (): Promise<UserSettings> => {
  const rows = await executeQuery(
    'SELECT * FROM settings WHERE id = ?',
    [DEFAULT_SETTINGS_ID]
  );
  
  if (rows.length === 0) {
    // Create default settings if not found
    return createDefaultSettings();
  }
  
  return mapRowToSettings(rows[0]);
};

// Create default settings
export const createDefaultSettings = async (): Promise<UserSettings> => {
  const now = new Date();
  
  const defaultSettings: UserSettings = {
    id: DEFAULT_SETTINGS_ID,
    easeFactor: 2.5,
    requestRetention: DEFAULT_PARAMETERS.requestRetention,
    reviewLimit: 50,
    newAyahsPerDay: 5,
    groupingMethod: 'ruku',
    groupingSize: 5,
    theme: 'system',
    quranScript: 'uthmani',
    audioEnabled: true,
    offlineMode: false,
    knownSurahs: [],
    w: DEFAULT_PARAMETERS.w,
    learningSteps: [1, 10, 60, 360], // Minutes
    lapseSteps: [10, 60], // Minutes
    maxReviewsPerSession: 20,
    reviewAheadDays: 0,
    createdAt: now,
    updatedAt: now
  };
  
  await executeUpdate(
    `INSERT OR REPLACE INTO settings (
      id, easeFactor, requestRetention, reviewLimit, newAyahsPerDay,
      groupingMethod, groupingSize, theme, quranScript, audioEnabled, offlineMode,
      knownSurahs, fsrsParameters, learningSteps, lapseSteps,
      maxReviewsPerSession, reviewAheadDays, createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      defaultSettings.id,
      defaultSettings.easeFactor,
      defaultSettings.requestRetention,
      defaultSettings.reviewLimit,
      defaultSettings.newAyahsPerDay,
      defaultSettings.groupingMethod,
      defaultSettings.groupingSize,
      defaultSettings.theme,
      defaultSettings.quranScript,
      defaultSettings.audioEnabled ? 1 : 0,
      defaultSettings.offlineMode ? 1 : 0,
      JSON.stringify(defaultSettings.knownSurahs),
      JSON.stringify(defaultSettings.w),
      JSON.stringify(defaultSettings.learningSteps),
      JSON.stringify(defaultSettings.lapseSteps),
      defaultSettings.maxReviewsPerSession,
      defaultSettings.reviewAheadDays,
      defaultSettings.createdAt.toISOString(),
      defaultSettings.updatedAt.toISOString()
    ]
  );
  
  return defaultSettings;
};

// Update settings
export const updateSettings = async (settings: Partial<UserSettings>): Promise<UserSettings> => {
  // Get current settings
  const currentSettings = await getSettings();
  
  // Update with new values
  const updatedSettings: UserSettings = {
    ...currentSettings,
    ...settings,
    updatedAt: new Date()
  };
  
  await executeUpdate(
    `UPDATE settings SET
      easeFactor = ?,
      requestRetention = ?,
      reviewLimit = ?,
      newAyahsPerDay = ?,
      groupingMethod = ?,
      groupingSize = ?,
      theme = ?,
      quranScript = ?,
      audioEnabled = ?,
      offlineMode = ?,
      knownSurahs = ?,
      fsrsParameters = ?,
      learningSteps = ?,
      lapseSteps = ?,
      maxReviewsPerSession = ?,
      reviewAheadDays = ?,
      updatedAt = ?
    WHERE id = ?`,
    [
      updatedSettings.easeFactor,
      updatedSettings.requestRetention,
      updatedSettings.reviewLimit,
      updatedSettings.newAyahsPerDay,
      updatedSettings.groupingMethod,
      updatedSettings.groupingSize,
      updatedSettings.theme,
      updatedSettings.quranScript,
      updatedSettings.audioEnabled ? 1 : 0,
      updatedSettings.offlineMode ? 1 : 0,
      JSON.stringify(updatedSettings.knownSurahs),
      JSON.stringify(updatedSettings.w),
      JSON.stringify(updatedSettings.learningSteps),
      JSON.stringify(updatedSettings.lapseSteps),
      updatedSettings.maxReviewsPerSession,
      updatedSettings.reviewAheadDays,
      updatedSettings.updatedAt.toISOString(),
      DEFAULT_SETTINGS_ID
    ]
  );
  
  return updatedSettings;
};

// Reset settings to default
export const resetSettings = async (): Promise<UserSettings> => {
  await executeUpdate('DELETE FROM settings WHERE id = ?', [DEFAULT_SETTINGS_ID]);
  return createDefaultSettings();
};

// Helper function to map database row to UserSettings object
const mapRowToSettings = (row: any): UserSettings => {
  return {
    id: row.id,
    easeFactor: row.easeFactor,
    requestRetention: row.requestRetention,
    reviewLimit: row.reviewLimit,
    newAyahsPerDay: row.newAyahsPerDay,
    groupingMethod: row.groupingMethod as 'fixed' | 'ruku' | 'page',
    groupingSize: row.groupingSize,
    theme: row.theme as 'light' | 'dark' | 'system',
    quranScript: row.quranScript as 'uthmani' | 'indopak',
    audioEnabled: row.audioEnabled === 1,
    offlineMode: row.offlineMode === 1,
    knownSurahs: JSON.parse(row.knownSurahs),
    w: JSON.parse(row.fsrsParameters),
    learningSteps: JSON.parse(row.learningSteps),
    lapseSteps: JSON.parse(row.lapseSteps),
    maxReviewsPerSession: row.maxReviewsPerSession,
    reviewAheadDays: row.reviewAheadDays,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt)
  };
};
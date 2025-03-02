import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeUpdate } from './index';
import { AyahProgress, ReviewEntry, Rating } from '../../types';
import { initializeCard, scheduleReview } from '../fsrs';

// Get all ayah progress
export const getAllAyahProgress = async (): Promise<AyahProgress[]> => {
  const rows = await executeQuery('SELECT * FROM ayah_progress');
  return rows.map(mapRowToAyahProgress);
};

// Get ayah progress by surah and ayah number
export const getAyahProgress = async (
  surahNumber: number,
  ayahNumber: number
): Promise<AyahProgress | null> => {
  const rows = await executeQuery(
    'SELECT * FROM ayah_progress WHERE surahNumber = ? AND ayahNumber = ?',
    [surahNumber, ayahNumber]
  );
  
  if (rows.length === 0) {
    return null;
  }
  
  return mapRowToAyahProgress(rows[0]);
};

// Get ayah progress by group ID
export const getAyahProgressByGroup = async (groupId: string): Promise<AyahProgress[]> => {
  const rows = await executeQuery(
    'SELECT * FROM ayah_progress WHERE groupId = ?',
    [groupId]
  );
  
  return rows.map(mapRowToAyahProgress);
};

// Get due ayahs for review
export const getDueAyahs = async (limit?: number): Promise<AyahProgress[]> => {
  const now = new Date().toISOString();
  
  const query = `
    SELECT * FROM ayah_progress 
    WHERE nextReview IS NULL OR nextReview <= ? 
    ORDER BY 
      CASE 
        WHEN state = 'new' THEN 1 
        WHEN state = 'learning' THEN 2 
        WHEN state = 'relearning' THEN 3 
        ELSE 4 
      END,
      nextReview
    ${limit ? 'LIMIT ?' : ''}
  `;
  
  const params = limit ? [now, limit] : [now];
  const rows = await executeQuery(query, params);
  
  return rows.map(mapRowToAyahProgress);
};

// Create a new ayah progress entry
export const createAyahProgress = async (
  surahNumber: number,
  ayahNumber: number,
  groupId: string,
  testWithGroup: boolean = false,
  groupPosition: number = 0
): Promise<AyahProgress> => {
  const id = uuidv4();
  const now = new Date();
  
  // Initialize a new card using FSRS
  const card = initializeCard();
  
  const ayahProgress: AyahProgress = {
    id,
    surahNumber,
    ayahNumber,
    groupId,
    recallScore: 0,
    lastReviewed: null,
    nextReview: null,
    easeFactor: card.easeFactor,
    stability: card.stability,
    difficulty: card.difficulty,
    lapses: card.lapses,
    state: card.state,
    interval: card.interval,
    createdAt: now,
    history: [],
    testWithGroup,
    groupPosition
  };
  
  await executeUpdate(
    `INSERT INTO ayah_progress (
      id, surahNumber, ayahNumber, groupId, recallScore, lastReviewed, nextReview,
      easeFactor, stability, difficulty, lapses, state, interval, createdAt, history,
      testWithGroup, groupPosition
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      ayahProgress.id,
      ayahProgress.surahNumber,
      ayahProgress.ayahNumber,
      ayahProgress.groupId,
      ayahProgress.recallScore,
      ayahProgress.lastReviewed,
      ayahProgress.nextReview,
      ayahProgress.easeFactor,
      ayahProgress.stability,
      ayahProgress.difficulty,
      ayahProgress.lapses,
      ayahProgress.state,
      ayahProgress.interval,
      ayahProgress.createdAt.toISOString(),
      JSON.stringify(ayahProgress.history),
      ayahProgress.testWithGroup ? 1 : 0,
      ayahProgress.groupPosition
    ]
  );
  
  return ayahProgress;
};

// Update ayah progress after a review
export const updateAyahProgress = async (
  id: string,
  rating: Rating,
  elapsedTime?: number
): Promise<AyahProgress> => {
  // Get current ayah progress
  const rows = await executeQuery('SELECT * FROM ayah_progress WHERE id = ?', [id]);
  
  if (rows.length === 0) {
    throw new Error(`Ayah progress not found: ${id}`);
  }
  
  const currentProgress = mapRowToAyahProgress(rows[0]);
  const now = new Date();
  
  // Create a card from current progress
  const card = {
    state: currentProgress.state,
    easeFactor: currentProgress.easeFactor,
    stability: currentProgress.stability,
    difficulty: currentProgress.difficulty,
    lapses: currentProgress.lapses,
    lastReview: currentProgress.lastReviewed,
    dueDate: currentProgress.nextReview,
    interval: currentProgress.interval
  };
  
  // Schedule next review using FSRS
  const scheduled = scheduleReview(card, rating, now);
  
  // Create a review entry
  const reviewEntry: ReviewEntry = {
    date: now,
    rating,
    elapsedTime,
    previousInterval: currentProgress.interval,
    scheduledInterval: scheduled.interval
  };
  
  // Update the ayah progress
  const history = [...currentProgress.history, reviewEntry];
  
  // Calculate recall score based on history (percentage of Good/Easy ratings)
  const goodRatings = history.filter(entry => entry.rating >= 3).length;
  const recallScore = history.length > 0 ? (goodRatings / history.length) * 100 : 0;
  
  const updatedProgress: AyahProgress = {
    ...currentProgress,
    recallScore,
    lastReviewed: now,
    nextReview: scheduled.dueDate,
    easeFactor: scheduled.easeFactor,
    stability: scheduled.stability,
    difficulty: scheduled.difficulty,
    lapses: scheduled.lapses,
    state: scheduled.state,
    interval: scheduled.interval,
    history
  };
  
  await executeUpdate(
    `UPDATE ayah_progress SET
      recallScore = ?,
      lastReviewed = ?,
      nextReview = ?,
      easeFactor = ?,
      stability = ?,
      difficulty = ?,
      lapses = ?,
      state = ?,
      interval = ?,
      history = ?
    WHERE id = ?`,
    [
      updatedProgress.recallScore,
      updatedProgress.lastReviewed.toISOString(),
      updatedProgress.nextReview ? updatedProgress.nextReview.toISOString() : null,
      updatedProgress.easeFactor,
      updatedProgress.stability,
      updatedProgress.difficulty,
      updatedProgress.lapses,
      updatedProgress.state,
      updatedProgress.interval,
      JSON.stringify(updatedProgress.history),
      updatedProgress.id
    ]
  );
  
  return updatedProgress;
};

// Delete ayah progress
export const deleteAyahProgress = async (id: string): Promise<void> => {
  await executeUpdate('DELETE FROM ayah_progress WHERE id = ?', [id]);
};

// Reset all progress
export const resetAllProgress = async (): Promise<void> => {
  await executeUpdate('DELETE FROM ayah_progress');
  await executeUpdate('DELETE FROM ayah_groups');
  await executeUpdate('DELETE FROM session_statistics');
};

// Helper function to map database row to AyahProgress object
const mapRowToAyahProgress = (row: any): AyahProgress => {
  return {
    id: row.id,
    surahNumber: row.surahNumber,
    ayahNumber: row.ayahNumber,
    groupId: row.groupId,
    recallScore: row.recallScore,
    lastReviewed: row.lastReviewed ? new Date(row.lastReviewed) : null,
    nextReview: row.nextReview ? new Date(row.nextReview) : null,
    easeFactor: row.easeFactor,
    stability: row.stability,
    difficulty: row.difficulty,
    lapses: row.lapses,
    state: row.state,
    interval: row.interval,
    createdAt: new Date(row.createdAt),
    history: JSON.parse(row.history),
    testWithGroup: row.testWithGroup === 1,
    groupPosition: row.groupPosition || 0
  };
};
import { v4 as uuidv4 } from 'uuid';
import { executeQuery, executeUpdate } from '../database';
import { getSettings } from '../database/settings';
import { getDueAyahs } from '../database/ayahProgress';
import { AyahProgress, SessionStatistics } from '../../types';

// Get today's due reviews
export const getTodayDueReviews = async (): Promise<{
  due: number;
  new: number;
  learning: number;
  review: number;
}> => {
  try {
    const settings = await getSettings();
    const now = new Date().toISOString();
    
    // Get all due ayahs
    const dueAyahs = await executeQuery(
      `SELECT * FROM ayah_progress 
       WHERE nextReview IS NULL OR nextReview <= ?`,
      [now]
    );
    
    if (dueAyahs.length === 0) {
      return { due: 0, new: 0, learning: 0, review: 0 };
    }
    
    // Process ayahs to count unique groups
    const groupMap = new Map<string, any[]>();
    
    // Group ayahs by their group ID if they should be tested as a group
    dueAyahs.forEach(ayah => {
      if (ayah.testWithGroup === 1) {
        if (!groupMap.has(ayah.groupId)) {
          groupMap.set(ayah.groupId, []);
        }
        groupMap.get(ayah.groupId)?.push(ayah);
      } else {
        // For ayahs not tested as groups, use their ID as a unique "group"
        groupMap.set(ayah.id, [ayah]);
      }
    });
    
    // Count states for unique groups
    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    
    groupMap.forEach((groupAyahs, groupId) => {
      // Use the first ayah in the group to determine the state
      const firstAyah = groupAyahs[0];
      
      if (firstAyah.state === 'new') {
        newCount++;
      } else if (firstAyah.state === 'review') {
        reviewCount++;
      } else {
        // learning or relearning
        learningCount++;
      }
    });
    
    return {
      due: groupMap.size,
      new: newCount,
      learning: learningCount,
      review: reviewCount
    };
  } catch (error) {
    console.error('Error getting due reviews:', error);
    return { due: 0, new: 0, learning: 0, review: 0 };
  }
};

// Get ayahs for today's session
export const getSessionAyahs = async (): Promise<AyahProgress[]> => {
  try {
    const settings = await getSettings();
    
    // Limit is the sum of review limit and new ayahs per day
    const limit = settings.reviewLimit;
    
    // Get due ayahs up to the limit
    const dueAyahs = await getDueAyahs(limit);
    
    // Process ayahs to handle group testing
    const processedAyahs: AyahProgress[] = [];
    const processedGroupIds = new Set<string>();
    
    for (const ayah of dueAyahs) {
      // If this ayah should be tested with its group and we haven't processed this group yet
      if (ayah.testWithGroup && !processedGroupIds.has(ayah.groupId)) {
        // Get all ayahs in this group
        const groupAyahs = await executeQuery(
          `SELECT * FROM ayah_progress 
           WHERE groupId = ? 
           ORDER BY groupPosition ASC`,
          [ayah.groupId]
        );
        
        // Map rows to AyahProgress objects and add to processed ayahs
        const mappedGroupAyahs = groupAyahs.map(mapRowToAyahProgress);
        processedAyahs.push(...mappedGroupAyahs);
        
        // Mark this group as processed
        processedGroupIds.add(ayah.groupId);
      } 
      // If this ayah should not be tested with its group or we've already processed this group
      else if (!ayah.testWithGroup) {
        processedAyahs.push(ayah);
      }
    }
    
    return processedAyahs;
  } catch (error) {
    console.error('Error getting session ayahs:', error);
    return [];
  }
};

// Create a new session statistics record
export const createSessionStatistics = async (): Promise<SessionStatistics> => {
  const id = uuidv4();
  const now = new Date();
  
  const sessionStats: SessionStatistics = {
    id,
    date: now,
    totalReviewed: 0,
    newLearned: 0,
    reviewTime: 0,
    ratings: {
      again: 0,
      hard: 0,
      good: 0,
      easy: 0
    },
    retention: 0
  };
  
  await executeUpdate(
    `INSERT INTO session_statistics (
      id, date, totalReviewed, newLearned, reviewTime, 
      ratingAgain, ratingHard, ratingGood, ratingEasy, retention
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionStats.id,
      sessionStats.date.toISOString(),
      sessionStats.totalReviewed,
      sessionStats.newLearned,
      sessionStats.reviewTime,
      sessionStats.ratings.again,
      sessionStats.ratings.hard,
      sessionStats.ratings.good,
      sessionStats.ratings.easy,
      sessionStats.retention
    ]
  );
  
  return sessionStats;
};

// Update session statistics
export const updateSessionStatistics = async (
  id: string,
  stats: Partial<SessionStatistics>
): Promise<SessionStatistics> => {
  // Get current session stats
  const rows = await executeQuery(
    'SELECT * FROM session_statistics WHERE id = ?',
    [id]
  );
  
  if (rows.length === 0) {
    throw new Error(`Session statistics not found: ${id}`);
  }
  
  const currentStats = mapRowToSessionStats(rows[0]);
  
  // Update with new values
  const updatedStats: SessionStatistics = {
    ...currentStats,
    ...stats,
    ratings: {
      ...currentStats.ratings,
      ...(stats.ratings || {})
    }
  };
  
  await executeUpdate(
    `UPDATE session_statistics SET
      totalReviewed = ?,
      newLearned = ?,
      reviewTime = ?,
      ratingAgain = ?,
      ratingHard = ?,
      ratingGood = ?,
      ratingEasy = ?,
      retention = ?
    WHERE id = ?`,
    [
      updatedStats.totalReviewed,
      updatedStats.newLearned,
      updatedStats.reviewTime,
      updatedStats.ratings.again,
      updatedStats.ratings.hard,
      updatedStats.ratings.good,
      updatedStats.ratings.easy,
      updatedStats.retention,
      id
    ]
  );
  
  return updatedStats;
};

// Get session statistics by ID
export const getSessionStatistics = async (id: string): Promise<SessionStatistics | null> => {
  const rows = await executeQuery(
    'SELECT * FROM session_statistics WHERE id = ?',
    [id]
  );
  
  if (rows.length === 0) {
    return null;
  }
  
  return mapRowToSessionStats(rows[0]);
};

// Get recent session statistics
export const getRecentSessionStatistics = async (
  days: number = 30
): Promise<SessionStatistics[]> => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const rows = await executeQuery(
    'SELECT * FROM session_statistics WHERE date >= ? ORDER BY date DESC',
    [startDate.toISOString()]
  );
  
  return rows.map(mapRowToSessionStats);
};

// Helper function to map database row to SessionStatistics object
const mapRowToSessionStats = (row: any): SessionStatistics => {
  return {
    id: row.id,
    date: new Date(row.date),
    totalReviewed: row.totalReviewed,
    newLearned: row.newLearned,
    reviewTime: row.reviewTime,
    ratings: {
      again: row.ratingAgain,
      hard: row.ratingHard,
      good: row.ratingGood,
      easy: row.ratingEasy
    },
    retention: row.retention
  };
};

// Helper function to map database row to AyahProgress object
const mapRowToAyahProgress = (row: any): AyahProgress => {
  let history: any[] = [];
  try {
    history = JSON.parse(row.history || '[]');
  } catch (error) {
    console.error('Error parsing history:', error);
  }
  
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
    state: row.state as 'new' | 'learning' | 'review' | 'relearning',
    interval: row.interval,
    createdAt: new Date(row.createdAt),
    history: history,
    testWithGroup: row.testWithGroup === 1,
    groupPosition: row.groupPosition
  };
};
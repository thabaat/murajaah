import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AyahProgress, Rating, SessionStatistics } from '../types';
import { getSessionAyahs } from '../services/scheduler';
import { updateAyahProgress } from '../services/database/ayahProgress';
import { createSessionStatistics, updateSessionStatistics } from '../services/scheduler';
import { useSettings } from './SettingsContext';
import { router } from 'expo-router';
import { preloadSessionAudio } from '../services/quran/api';

interface SessionContextType {
  // Current session state
  isActive: boolean;
  currentAyah: AyahProgress | null;
  ayahIndex: number;
  ayahs: AyahProgress[];
  sessionStats: SessionStatistics | null;
  
  // Stat tracking
  totalReviewed: number;
  newLearned: number;
  startTime: Date | null;
  elapsedTime: number;
  
  // Session actions
  startSession: () => Promise<void>;
  endSession: (latestTotalReviewed?: number, latestRatings?: SessionStatistics['ratings']) => Promise<void>;
  pauseSession: () => void;
  resumeSession: () => void;
  rateAyah: (rating: Rating) => Promise<void>;
  goToNextAyah: () => void;
  resetSession: () => void;
  
  // Session status
  loading: boolean;
  error: string | null;
  
  // For group tracking
  uniqueGroups: string[];
  uniqueGroupIndex: number;
  totalGroups: number;
}

const SessionContext = createContext<SessionContextType>({
  // State
  isActive: false,
  currentAyah: null,
  ayahIndex: -1,
  ayahs: [],
  sessionStats: null,
  
  // Stats
  totalReviewed: 0,
  newLearned: 0,
  startTime: null,
  elapsedTime: 0,
  
  // Actions
  startSession: async () => {},
  endSession: async () => {},
  pauseSession: () => {},
  resumeSession: () => {},
  rateAyah: async () => {},
  goToNextAyah: () => {},
  resetSession: () => {},
  
  // Status
  loading: false,
  error: null,
  
  // For group tracking
  uniqueGroups: [],
  uniqueGroupIndex: -1,
  totalGroups: 0,
});

export const useSession = () => useContext(SessionContext);

interface SessionProviderProps {
  children: ReactNode;
}

export const SessionProvider: React.FC<SessionProviderProps> = ({ children }) => {
  const { settings } = useSettings();
  
  // State
  const [isActive, setIsActive] = useState<boolean>(false);
  const [ayahs, setAyahs] = useState<AyahProgress[]>([]);
  const [ayahIndex, setAyahIndex] = useState<number>(-1);
  const [currentAyah, setCurrentAyah] = useState<AyahProgress | null>(null);
  const [sessionStats, setSessionStats] = useState<SessionStatistics | null>(null);
  
  // For group tracking
  const [uniqueGroups, setUniqueGroups] = useState<string[]>([]);
  const [uniqueGroupIndex, setUniqueGroupIndex] = useState<number>(-1);
  
  // Stats
  const [totalReviewed, setTotalReviewed] = useState<number>(0);
  const [newLearned, setNewLearned] = useState<number>(0);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [ayahStartTime, setAyahStartTime] = useState<Date | null>(null);
  
  // Status
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timer for tracking session time
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Update current ayah when index changes
  useEffect(() => {
    if (ayahIndex >= 0 && ayahIndex < ayahs.length) {
      setCurrentAyah(ayahs[ayahIndex]);
      setAyahStartTime(new Date());
    } else {
      setCurrentAyah(null);
    }
  }, [ayahIndex, ayahs]);
  
  // Process ayahs to identify unique groups
  useEffect(() => {
    if (ayahs.length > 0) {
      // Create an array of unique group IDs for ayahs that should be tested as groups
      const groupMap = new Map<string, AyahProgress[]>();
      
      // Group ayahs by their group ID if they should be tested as a group
      ayahs.forEach(ayah => {
        if (ayah.testWithGroup) {
          if (!groupMap.has(ayah.groupId)) {
            groupMap.set(ayah.groupId, []);
          }
          groupMap.get(ayah.groupId)?.push(ayah);
        } else {
          // For ayahs not tested as groups, use their ID as a unique "group"
          groupMap.set(ayah.id, [ayah]);
        }
      });
      
      // Create an array of unique group IDs in the order they appear in the ayahs array
      const uniqueGroupIds: string[] = [];
      const processedGroups = new Set<string>();
      
      ayahs.forEach(ayah => {
        const groupId = ayah.testWithGroup ? ayah.groupId : ayah.id;
        if (!processedGroups.has(groupId)) {
          uniqueGroupIds.push(groupId);
          processedGroups.add(groupId);
        }
      });
      
      setUniqueGroups(uniqueGroupIds);
      
      // If we're at the beginning of the session, set the group index to 0
      if (uniqueGroupIndex === -1 && uniqueGroupIds.length > 0) {
        setUniqueGroupIndex(0);
      }
    }
  }, [ayahs]);
  
  // Start a new review session
  const startSession = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get ayahs due for review
      const dueAyahs = await getSessionAyahs();
      
      if (dueAyahs.length === 0) {
        setError('No ayahs due for review');
        setLoading(false);
        return;
      }
      
      // Create a new session statistics record
      const stats = await createSessionStatistics();
      
      // Initialize session state
      setAyahs(dueAyahs);
      setAyahIndex(0);
      setSessionStats(stats);
      setTotalReviewed(0);
      setNewLearned(0);
      setStartTime(new Date());
      setElapsedTime(0);
      setIsActive(true);
      
      // Start the timer
      const intervalId = setInterval(() => {
        setElapsedTime(prev => prev + 1000);
      }, 1000);
      
      setTimer(intervalId);
      
      // Preload audio for all ayahs in the session
      if (settings?.audioEnabled) {
        // Preload in the background to avoid blocking the UI
        setTimeout(() => {
          // Extract surah and ayah numbers for preloading
          const ayahsToPreload = dueAyahs.map(ayah => ({
            surahNumber: ayah.surahNumber,
            ayahNumber: ayah.ayahNumber
          }));
          
          preloadSessionAudio(ayahsToPreload)
            .catch(error => console.error('Error preloading session audio:', error));
        }, 100);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error starting session:', err);
      setError('Failed to start review session');
      setLoading(false);
    }
  };
  
  // End the current session
  const endSession = async (latestTotalReviewed?: number, latestRatings?: SessionStatistics['ratings']) => {
    try {
      // Stop the timer
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      }
      
      // Update session statistics if we have any
      if (sessionStats) {
        // Use the latest counts passed in, or fall back to the state values
        const finalTotalReviewed = latestTotalReviewed !== undefined ? latestTotalReviewed : totalReviewed;
        const finalRatings = latestRatings || sessionStats.ratings;
        
        console.debug(`Ending session: totalReviewed=${finalTotalReviewed}, uniqueGroupIndex=${uniqueGroupIndex + 1}/${uniqueGroups.length}`);
        console.debug(`Ratings: again=${finalRatings.again}, hard=${finalRatings.hard}, good=${finalRatings.good}, easy=${finalRatings.easy}`);
        
        await updateSessionStatistics(sessionStats.id, {
          totalReviewed: finalTotalReviewed,
          newLearned,
          reviewTime: elapsedTime,
          ratings: finalRatings,
          retention: calculateRetention(finalRatings)
        });
        
        // Navigate to the summary page with the session ID
        router.push({
          pathname: '/session/summary',
          params: { sessionId: sessionStats.id }
        });
      }
      
      // Reset session state
      setIsActive(false);
      setAyahs([]);
      setAyahIndex(-1);
      setCurrentAyah(null);
      setSessionStats(null);
      setUniqueGroups([]);
      setUniqueGroupIndex(-1);
    } catch (err) {
      console.error('Error ending session:', err);
    }
  };
  
  // Pause the session timer
  const pauseSession = () => {
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
  };
  
  // Resume the session timer
  const resumeSession = () => {
    if (!timer) {
      const intervalId = setInterval(() => {
        setElapsedTime(prev => prev + 1000);
      }, 1000);
      setTimer(intervalId);
    }
  };
  
  // Rate the current ayah and move to the next one
  const rateAyah = async (rating: Rating) => {
    if (!currentAyah) return;
    
    try {
      // Calculate elapsed time for this ayah
      const elapsed = ayahStartTime ? new Date().getTime() - ayahStartTime.getTime() : 0;
      
      // Update the ayah progress in the database
      await updateAyahProgress(currentAyah.id, rating, elapsed);
      
      // If this ayah is part of a group, update all ayahs in the group with the same rating
      if (currentAyah.testWithGroup) {
        const groupAyahs = ayahs.filter(a => 
          a.groupId === currentAyah.groupId && 
          a.testWithGroup && 
          a.id !== currentAyah.id
        );
        
        for (const groupAyah of groupAyahs) {
          await updateAyahProgress(groupAyah.id, rating, elapsed);
        }
      }
      
      // Update session statistics
      let updatedRatings = { again: 0, hard: 0, good: 0, easy: 0 };
      
      if (sessionStats) {
        updatedRatings = { ...sessionStats.ratings };
        
        switch (rating) {
          case 1:
            updatedRatings.again += 1;
            break;
          case 2:
            updatedRatings.hard += 1;
            break;
          case 3:
            updatedRatings.good += 1;
            break;
          case 4:
            updatedRatings.easy += 1;
            break;
        }
        
        setSessionStats({
          ...sessionStats,
          ratings: updatedRatings
        });
      }
      
      // Update stats - increment by 1 regardless of whether it's a group or individual ayah
      // This ensures we count each review interaction, not each ayah
      const newTotalReviewed = totalReviewed + 1;
      setTotalReviewed(newTotalReviewed);
      console.debug(`Rated ayah: totalReviewed=${newTotalReviewed}, uniqueGroupIndex=${uniqueGroupIndex + 1}/${uniqueGroups.length}`);
      
      let newLearned = currentAyah.state === 'new' ? 1 : 0;
      if (newLearned > 0) {
        setNewLearned(prev => prev + newLearned);
      }
      
      // Check if this is the last ayah/group
      const isLastAyah = ayahIndex >= ayahs.length - 1;
      const isLastGroup = uniqueGroupIndex >= uniqueGroups.length - 1;
      
      if (isLastAyah || (currentAyah.testWithGroup && isLastGroup)) {
        // If this is the last ayah/group, end the session with the updated counts
        // Pass the new count and ratings directly to endSession to avoid state update delay
        await endSession(newTotalReviewed, updatedRatings);
      } else {
        // Otherwise, move to the next ayah or group
        goToNextAyah();
      }
    } catch (err) {
      console.error('Error rating ayah:', err);
    }
  };
  
  // Move to the next ayah or group
  const goToNextAyah = () => {
    console.debug(`goToNextAyah: ayahIndex=${ayahIndex}, uniqueGroupIndex=${uniqueGroupIndex}, totalGroups=${uniqueGroups.length}`);
    
    // If we're at the end of the ayahs, don't do anything
    // The rateAyah function will handle ending the session
    if (ayahIndex >= ayahs.length - 1) {
      console.debug(`At end of ayahs, not moving to next ayah`);
      return;
    }
    
    // If the current ayah is part of a group, find the next ayah that's not in this group
    if (currentAyah?.testWithGroup) {
      // Move to the next group
      if (uniqueGroupIndex < uniqueGroups.length - 1) {
        setUniqueGroupIndex(uniqueGroupIndex + 1);
        
        // Find the first ayah in the next group
        const nextGroupId = uniqueGroups[uniqueGroupIndex + 1];
        const nextGroupIndex = ayahs.findIndex(a => 
          (a.testWithGroup && a.groupId === nextGroupId) || 
          (!a.testWithGroup && a.id === nextGroupId)
        );
        
        if (nextGroupIndex !== -1) {
          console.debug(`Moving to next group: ${uniqueGroupIndex + 1} -> ${uniqueGroupIndex + 2}, ayahIndex: ${ayahIndex} -> ${nextGroupIndex}`);
          setAyahIndex(nextGroupIndex);
        } else {
          // Fallback to just incrementing the index
          console.debug(`Could not find next group ayah, incrementing index: ${ayahIndex} -> ${ayahIndex + 1}`);
          setAyahIndex(ayahIndex + 1);
        }
      } else {
        // We're at the end of the groups, don't do anything
        // The rateAyah function will handle ending the session
        console.debug(`At end of groups, not moving to next group`);
        return;
      }
    } else {
      // For non-grouped ayahs, just move to the next one
      console.debug(`Moving to next ayah: ${ayahIndex} -> ${ayahIndex + 1}`);
      setAyahIndex(ayahIndex + 1);
      
      // Also update the group index if needed
      if (uniqueGroupIndex < uniqueGroups.length - 1) {
        console.debug(`Updating group index: ${uniqueGroupIndex} -> ${uniqueGroupIndex + 1}`);
        setUniqueGroupIndex(uniqueGroupIndex + 1);
      }
    }
  };
  
  // Reset the session
  const resetSession = () => {
    // Stop the timer
    if (timer) {
      clearInterval(timer);
      setTimer(null);
    }
    
    // Reset session state
    setIsActive(false);
    setAyahs([]);
    setAyahIndex(-1);
    setCurrentAyah(null);
    setSessionStats(null);
    setTotalReviewed(0);
    setNewLearned(0);
    setStartTime(null);
    setElapsedTime(0);
    setUniqueGroups([]);
    setUniqueGroupIndex(-1);
  };
  
  // Calculate retention rate
  const calculateRetention = (ratings: { again: number; hard: number; good: number; easy: number }) => {
    const total = ratings.again + ratings.hard + ratings.good + ratings.easy;
    if (total === 0) return 0;
    
    // Consider "again" as failed, everything else as passed
    const passed = ratings.hard + ratings.good + ratings.easy;
    return (passed / total) * 100;
  };
  
  // Provide the context value
  const contextValue: SessionContextType = {
    isActive,
    currentAyah,
    ayahIndex,
    ayahs,
    sessionStats,
    totalReviewed,
    newLearned,
    startTime,
    elapsedTime,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    rateAyah,
    goToNextAyah,
    resetSession,
    loading,
    error,
    // Add group-related values
    uniqueGroups,
    uniqueGroupIndex,
    totalGroups: uniqueGroups.length
  };
  
  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
};

export default SessionContext;
// src/types/quran.ts
export interface Ayah {
    surahNumber: number;
    ayahNumber: number;
    text: string;              // Arabic text
    translation?: string;      // Optional translation
    audioUrl: string;          // URL for Abdullah Basfar recitation
    audioPath: string | null;  // Local path to audio file
    ruku?: number;             // Ruku number from QuranhHub API
    page?: number;             // Page number from QuranhHub API
    scriptType: string;        // Script type (uthmani or indopak)
  }
  
  export interface Surah {
    number: number;
    name: string;
    arabicName: string;
    englishName: string;
    ayahCount: number;
    revelationType: 'Meccan' | 'Medinan';
    rukus: number[];           // Starting ayah numbers for each ruku
    pages: number[];           // Starting ayah numbers for each page
    ayahs?: Ayah[];            // Optional ayahs array (loaded on demand)
  }
  
  // src/types/progress.ts
  export interface AyahProgress {
    id: string;                // UUID
    surahNumber: number;       // Surah reference
    ayahNumber: number;        // Ayah reference
    groupId: string;           // ID of the group this ayah belongs to
    recallScore: number;       // FSRS-based retention score
    lastReviewed: Date | null; // Last review date
    nextReview: Date | null;   // FSRS-calculated next review date
    easeFactor: number;        // FSRS parameter
    stability: number;         // FSRS stability parameter
    difficulty: number;        // FSRS difficulty parameter
    lapses: number;            // Count of "Again" responses
    state: 'new' | 'learning' | 'review' | 'relearning'; // Current learning state
    interval: number;          // Current interval in days
    createdAt: Date;           // When this ayah was added to learning
    history: ReviewEntry[];    // Review history
    testWithGroup: boolean;    // Whether this ayah should be tested with its group
    groupPosition: number;     // Position within the group (1-based)
  }
  
  export interface ReviewEntry {
    date: Date;
    rating: 1 | 2 | 3 | 4;     // Again(1), Hard(2), Good(3), Easy(4)
    elapsedTime?: number;      // Time spent on review (milliseconds)
    previousInterval?: number; // Previous interval before this review
    scheduledInterval?: number; // Scheduled interval after this review
  }
  
  export interface AyahGroup {
    id: string;                // UUID
    surahNumber: number;       // Surah reference
    startAyah: number;         // First ayah in group
    endAyah: number;           // Last ayah in group
    groupType: 'fixed' | 'ruku' | 'page' | 'custom';
    progress: number;          // Percentage complete (0-100)
    state: 'new' | 'learning' | 'review' | 'complete';
    ayahIds: string[];         // IDs of AyahProgress items in this group
    testAsGroup: boolean;      // Whether to test ayahs as a group
  }
  
  export interface SessionStatistics {
    id: string;                // UUID
    date: Date;                // Session date
    totalReviewed: number;     // Total ayahs reviewed
    newLearned: number;        // New ayahs introduced
    reviewTime: number;        // Total time spent (milliseconds)
    ratings: {                 // Count of each rating
      again: number;
      hard: number;
      good: number;
      easy: number;
    };
    retention: number;         // Retention rate (percentage)
  }
  
  // src/types/settings.ts
  export interface UserSettings {
    id: string;                // UUID (default 'default')
    easeFactor: number;        // Default FSRS parameter (default 2.5)
    requestRetention: number;  // Target retention rate (default 0.9 = 90%)
    reviewLimit: number;       // Max daily reviews (default 50)
    newAyahsPerDay: number;    // New ayahs per day (default 5)
    groupingMethod: 'fixed' | 'ruku' | 'page';
    groupingSize: number;      // For fixed grouping, number of ayahs
    theme: 'light' | 'dark' | 'system';
    quranScript: 'uthmani' | 'indopak'; // Quran text script style
    audioEnabled: boolean;     // Whether audio plays automatically
    offlineMode: boolean;      // Whether Quran is downloaded for offline
    knownSurahs: number[];     // Array of surah numbers the user already knows
    w: number[];               // FSRS weight parameters [w₀, w₁, ..., w₁₁]
    learningSteps: number[];   // Steps in minutes for learning cards
    lapseSteps: number[];      // Steps in minutes for lapsed cards
    maxReviewsPerSession: number; // Max reviews per session (default 20)
    reviewAheadDays: number;   // How many days ahead to allow reviews
    createdAt: Date;           // When settings were created
    updatedAt: Date;           // When settings were last updated
  }
  
  // src/types/fsrs.ts
  export interface FSRSParameters {
    w: number[];               // Weights [w₀, w₁, ..., w₁₁]
    requestRetention: number;  // Target retention rate (0-1)
  }
  
  export interface FSRSCard {
    state: 'new' | 'learning' | 'review' | 'relearning';
    easeFactor: number;
    stability: number;
    difficulty: number;
    lapses: number;
    lastReview: Date | null;
    dueDate: Date | null;
    interval: number;          // Current interval in days
  }
  
  export interface SchedulingInfo {
    state: 'new' | 'learning' | 'review' | 'relearning';
    easeFactor: number;
    stability: number;
    difficulty: number;
    lapses: number;
    interval: number;
    dueDate: Date | null;
  }
  
  export type Rating = 1 | 2 | 3 | 4; // Again(1), Hard(2), Good(3), Easy(4)
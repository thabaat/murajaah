import { FSRSCard, FSRSParameters, Rating, SchedulingInfo } from '../../types';

/**
 * Free Spaced Repetition System (FSRS) implementation
 * Based on the algorithm by Jarrett Ye
 * https://github.com/open-spaced-repetition/fsrs-js
 */

// Default FSRS parameters
export const DEFAULT_PARAMETERS: FSRSParameters = {
  // Default weights based on FSRS research
  w: [
    0.4, // w₀: initial stability for new cards (optimized from 0.4 to 2.4)
    0.6, // w₁: initial difficulty modifier
    2.4, // w₂: exponent for converting elapsed time to forgetting
    0.94, // w₃: "Again" penalty factor (stability)
    0.86, // w₄: "Hard" penalty factor (stability)
    1.01, // w₅: "Good" reward factor (stability)
    1.3, // w₆: "Easy" reward factor (stability)
    0.7, // w₇: "Again" penalty factor (difficulty)
    1.0, // w₈: "Hard" penalty factor (difficulty)
    1.0, // w₉: "Good" reward factor (difficulty)
    0.9, // w₁₀: "Easy" reward factor (difficulty)
    0.2 // w₁₁: elapsed time in days to forgetting probability scaling factor
  ],
  requestRetention: 0.9 // Default target retention rate (90%)
};

// Initialize a new card
export const initializeCard = (): FSRSCard => {
  return {
    state: 'new',
    easeFactor: 2.5,
    stability: 0,
    difficulty: 0,
    lapses: 0,
    lastReview: null,
    dueDate: null,
    interval: 0
  };
};

// Calculate forgetting curve memory retention
export const memoryRetention = (stability: number, elapsedDays: number, w: number[]): number => {
  if (elapsedDays <= 0) return 1; // No forgetting if no time has passed
  return Math.exp(Math.log(0.9) * elapsedDays / stability);
};

// Calculate the next interval based on stability
export const nextInterval = (stability: number, requestRetention: number): number => {
  if (stability <= 0) return 0;
  const interval = Math.round(stability * Math.log(requestRetention) / Math.log(0.9));
  return Math.max(1, interval); // Minimum interval is 1 day
};

// Schedule the next review based on rating
export const scheduleReview = (
  card: FSRSCard,
  rating: Rating,
  now: Date = new Date(),
  params: FSRSParameters = DEFAULT_PARAMETERS
): SchedulingInfo => {
  const { w, requestRetention } = params;
  
  // Make a copy of the card to modify
  const result: SchedulingInfo = { ...card };
  
  // Calculate elapsed time since last review
  const elapsedDays = card.lastReview 
    ? (now.getTime() - card.lastReview.getTime()) / (24 * 60 * 60 * 1000)
    : 0;
  
  // Initialize stability and difficulty for new cards
  if (card.state === 'new') {
    result.difficulty = w[1];
    result.stability = w[0];
  }

  // Update the card based on the rating
  switch (rating) {
    case 1: // Again
      if (card.state === 'new' || card.state === 'learning') {
        result.state = 'learning';
      } else {
        result.state = 'relearning';
        result.lapses += 1;
      }
      
      // Adjust stability and difficulty
      if (result.stability > 0) {
        result.stability = result.stability * w[3];
      }
      result.difficulty = Math.min(Math.max(0, result.difficulty + w[7]), 1);
      
      // Learning/relearning cards are due immediately
      result.interval = 0;
      result.dueDate = now;
      break;
      
    case 2: // Hard
      if (card.state === 'new') {
        result.state = 'learning';
        result.interval = 1;
        result.dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day
      } else if (card.state === 'learning' || card.state === 'relearning') {
        result.interval = 1;
        result.dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day
      } else {
        // Apply stability and difficulty adjustments
        const retrievability = memoryRetention(card.stability, elapsedDays, w);
        const hardStability = card.stability * w[4] * Math.pow(retrievability, -w[2]);
        
        result.stability = hardStability;
        result.difficulty = Math.min(Math.max(0, result.difficulty + w[8]), 1);
        
        // Calculate new interval based on updated stability
        result.interval = nextInterval(hardStability, requestRetention);
        result.dueDate = new Date(now.getTime() + result.interval * 24 * 60 * 60 * 1000);
      }
      result.state = card.state === 'relearning' ? 'review' : card.state;
      break;
      
    case 3: // Good
      if (card.state === 'new' || card.state === 'learning') {
        result.state = 'review';
        // First review interval for new/learning cards
        result.interval = 1;
        result.dueDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day
      } else if (card.state === 'relearning') {
        result.state = 'review';
        // Relearning cards get interval based on adjusted stability
        const retrievability = memoryRetention(card.stability, elapsedDays, w);
        const goodStability = card.stability * w[5] * Math.pow(retrievability, -w[2]);
        
        result.stability = goodStability;
        result.interval = nextInterval(goodStability, requestRetention);
        result.dueDate = new Date(now.getTime() + result.interval * 24 * 60 * 60 * 1000);
      } else {
        // Regular review
        const retrievability = memoryRetention(card.stability, elapsedDays, w);
        const goodStability = card.stability * w[5] * Math.pow(retrievability, -w[2]);
        
        result.stability = goodStability;
        result.interval = nextInterval(goodStability, requestRetention);
        result.dueDate = new Date(now.getTime() + result.interval * 24 * 60 * 60 * 1000);
      }
      
      result.difficulty = Math.min(Math.max(0, result.difficulty + w[9]), 1);
      break;
      
    case 4: // Easy
      if (card.state === 'new' || card.state === 'learning' || card.state === 'relearning') {
        result.state = 'review';
        // First review interval for new/learning/relearning cards with Easy rating
        result.interval = 4; // Jump ahead more days for "Easy"
        result.dueDate = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
      } else {
        // Regular review with Easy rating
        const retrievability = memoryRetention(card.stability, elapsedDays, w);
        const easyStability = card.stability * w[6] * Math.pow(retrievability, -w[2]);
        
        result.stability = easyStability;
        result.interval = nextInterval(easyStability, requestRetention);
        result.dueDate = new Date(now.getTime() + result.interval * 24 * 60 * 60 * 1000);
      }
      
      result.difficulty = Math.min(Math.max(0, result.difficulty + w[10]), 1);
      break;
  }
  
  // Update last review time
  result.lastReview = now;
  
  return result;
};

// Calculate the memory retention for a card
export const calculateRetention = (card: FSRSCard, now: Date = new Date(), params: FSRSParameters = DEFAULT_PARAMETERS): number => {
  if (!card.lastReview || card.state === 'new') return 0;
  
  const elapsedDays = (now.getTime() - card.lastReview.getTime()) / (24 * 60 * 60 * 1000);
  return memoryRetention(card.stability, elapsedDays, params.w);
};

// Determine if a card is due for review
export const isDue = (card: FSRSCard, now: Date = new Date()): boolean => {
  if (card.state === 'new') return true;
  if (!card.dueDate) return false;
  return card.dueDate.getTime() <= now.getTime();
};

// Calculate optimal intervals for each rating
export const calculateOptimalIntervals = (
  card: FSRSCard,
  now: Date = new Date(),
  params: FSRSParameters = DEFAULT_PARAMETERS
): { [key in Rating]: number } => {
  const result: { [key in Rating]: number } = { 1: 0, 2: 0, 3: 0, 4: 0 };
  
  for (let rating = 1; rating <= 4; rating++) {
    const scheduledCard = scheduleReview(card, rating as Rating, now, params);
    result[rating as Rating] = scheduledCard.interval;
  }
  
  return result;
};
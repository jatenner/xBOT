/**
 * Learning Scheduler - Debounce heavy learning operations
 * Prevents hammering OpenAI API during quota exhaustion
 */

import { kvGet, kvSet } from '../utils/kv';
import { FEATURE_FLAGS } from '../config/featureFlags';

export interface LearningStatus {
  should_run: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  minutes_remaining: number;
}

const LEARNING_KEY = 'learning:last_run_at';

/**
 * Check if learning operations should run based on debounce interval
 */
export async function shouldRunLearning(): Promise<boolean> {
  try {
    const lastRunISO = await kvGet(LEARNING_KEY);
    const now = new Date();
    
    if (!lastRunISO) {
      // First run
      await updateLearningTimestamp();
      return true;
    }
    
    const lastRun = new Date(lastRunISO);
    const timeSinceLastRun = now.getTime() - lastRun.getTime();
    const debounceMs = FEATURE_FLAGS.LEARNING_DEBOUNCE_MINUTES * 60 * 1000;
    
    if (timeSinceLastRun >= debounceMs) {
      await updateLearningTimestamp();
      return true;
    }
    
    const remainingMs = debounceMs - timeSinceLastRun;
    console.log(`🧠 LEARNING_DEBOUNCE: Skipping (${Math.ceil(remainingMs / 1000 / 60)} minutes remaining)`);
    return false;
  } catch (error) {
    console.warn('Learning scheduler check failed:', error);
    // On error, allow learning to proceed
    return true;
  }
}

/**
 * Update the learning timestamp to now
 */
export async function updateLearningTimestamp(): Promise<void> {
  try {
    const now = new Date().toISOString();
    const ttlSeconds = FEATURE_FLAGS.LEARNING_DEBOUNCE_MINUTES * 60 * 2; // 2x TTL for safety
    await kvSet(LEARNING_KEY, now, ttlSeconds);
    console.log(`🧠 LEARNING_TIMESTAMP: Updated to ${now}`);
  } catch (error) {
    console.warn('Failed to update learning timestamp:', error);
  }
}

/**
 * Get current learning status for reporting
 */
export async function getLearningStatus(): Promise<LearningStatus> {
  try {
    const lastRunISO = await kvGet(LEARNING_KEY);
    const now = new Date();
    
    if (!lastRunISO) {
      return {
        should_run: true,
        last_run_at: null,
        next_run_at: null,
        minutes_remaining: 0
      };
    }
    
    const lastRun = new Date(lastRunISO);
    const debounceMs = FEATURE_FLAGS.LEARNING_DEBOUNCE_MINUTES * 60 * 1000;
    const timeSinceLastRun = now.getTime() - lastRun.getTime();
    
    if (timeSinceLastRun >= debounceMs) {
      return {
        should_run: true,
        last_run_at: lastRunISO,
        next_run_at: null,
        minutes_remaining: 0
      };
    }
    
    const remainingMs = debounceMs - timeSinceLastRun;
    const nextRunAt = new Date(now.getTime() + remainingMs);
    
    return {
      should_run: false,
      last_run_at: lastRunISO,
      next_run_at: nextRunAt.toISOString(),
      minutes_remaining: Math.ceil(remainingMs / 1000 / 60)
    };
  } catch (error) {
    console.warn('Failed to get learning status:', error);
    return {
      should_run: true,
      last_run_at: null,
      next_run_at: null,
      minutes_remaining: 0
    };
  }
}

/**
 * Force reset learning debounce (admin function)
 */
export async function resetLearningDebounce(): Promise<void> {
  try {
    await kvSet(LEARNING_KEY, new Date(0).toISOString()); // Set to epoch
    console.log('🔄 LEARNING_DEBOUNCE: Reset - next call will execute immediately');
  } catch (error) {
    console.warn('Failed to reset learning debounce:', error);
  }
}

/**
 * Wrapper for learning operations that respects debouncing
 */
export async function withLearningDebounce<T>(
  operation: () => Promise<T>,
  operationName: string = 'learning'
): Promise<T | null> {
  if (await shouldRunLearning()) {
    console.log(`🧠 LEARNING_EXECUTION: Running ${operationName}`);
    try {
      return await operation();
    } catch (error) {
      console.error(`Failed ${operationName}:`, error);
      throw error;
    }
  } else {
    console.log(`🧠 LEARNING_SKIP: Debounced ${operationName}`);
    return null;
  }
}

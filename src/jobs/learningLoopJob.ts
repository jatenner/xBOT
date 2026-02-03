/**
 * 🧠 LEARNING LOOP JOB
 * 
 * Daily job that updates outcome scores and strategy/hour weights
 */

import { runLearningLoop } from '../rateController/learningLoop';

export async function learningLoopJob(): Promise<void> {
  console.log('[LEARNING_LOOP_JOB] 🧠 Starting learning loop job...');
  
  try {
    await runLearningLoop();
    console.log('[LEARNING_LOOP_JOB] ✅ Learning loop job complete');
  } catch (error: any) {
    console.error(`[LEARNING_LOOP_JOB] ❌ Failed: ${error.message}`);
    throw error;
  }
}

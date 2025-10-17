/**
 * 🤖 AI SYSTEMS JOB
 * Runs AI-driven discovery and learning systems
 * 
 * Jobs:
 * - Account discovery (finds new targets)
 * - Learning analysis (learns what works)
 * - Score refresh (updates account scores)
 */

import { aiAccountDiscovery } from '../ai/accountDiscovery';
import { replyLearningSystem } from '../learning/replyLearningSystem';

/**
 * Run AI account discovery
 * Finds new health influencers to target
 * Runs: Daily
 */
export async function runAccountDiscovery(): Promise<void> {
  console.log('[AI_SYSTEMS] 🔍 Running AI account discovery...');
  
  try {
    await aiAccountDiscovery.runDiscoveryLoop();
    console.log('[AI_SYSTEMS] ✅ Account discovery completed');
  } catch (error: any) {
    console.error('[AI_SYSTEMS] ❌ Account discovery failed:', error.message);
  }
}

/**
 * Run learning analysis
 * Analyzes reply performance and extracts insights
 * Runs: Daily
 */
export async function runLearningAnalysis(): Promise<void> {
  console.log('[AI_SYSTEMS] 🧠 Running learning analysis...');
  
  try {
    await replyLearningSystem.runLearningLoop();
    console.log('[AI_SYSTEMS] ✅ Learning analysis completed');
  } catch (error: any) {
    console.error('[AI_SYSTEMS] ❌ Learning analysis failed:', error.message);
  }
}

/**
 * Run both AI systems
 * Called by job manager
 */
export async function runAISystems(): Promise<void> {
  console.log('[AI_SYSTEMS] 🤖 Starting AI systems...');
  
  // Run discovery (finds new accounts)
  await runAccountDiscovery();
  
  // Run learning (improves strategy)
  await runLearningAnalysis();
  
  console.log('[AI_SYSTEMS] ✅ AI systems completed');
}


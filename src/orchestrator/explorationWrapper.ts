/**
 * 🔍 EXPLORATION WRAPPER
 * Wraps content generation to apply exploration mode dynamically
 */

import { ContentOrchestrator, type OrchestratedContent } from './contentOrchestrator';
import { getCurrentMode, getModeStatus } from '../exploration/explorationModeManager';
import { getVarietyRecommendation } from '../exploration/coldStartOptimizer';

export async function generateWithExplorationMode(params?: {
  topicHint?: string;
  formatHint?: 'single' | 'thread';
}): Promise<OrchestratedContent> {
  
  const mode = await getCurrentMode();
  const status = await getModeStatus();
  
  console.log(`[EXPLORATION_WRAPPER] 🔍 Mode: ${mode}`);
  console.log(`[EXPLORATION_WRAPPER] 👥 Current followers: ${status.currentFollowers}`);
  console.log(`[EXPLORATION_WRAPPER] 📊 Avg engagement: ${status.avgEngagement.toFixed(2)}`);
  console.log(`[EXPLORATION_WRAPPER] 💡 Reason: ${status.reason}`);
  
  if (mode === 'exploration') {
    // Get variety recommendation
    const recommendation = await getVarietyRecommendation();
    console.log(`[EXPLORATION_WRAPPER] 🎲 Forcing variety: ${recommendation.recommendedType} @ controversy ${recommendation.controversyLevel}`);
    console.log(`[EXPLORATION_WRAPPER] 📝 Reason: ${recommendation.reason}`);
    
    // In exploration mode, we want to force variety
    // Don't override topicHint, but log that we're in exploration mode
    // The generators will pick up exploration mode through enhanced prompts
  }
  
  // Generate content using normal orchestrator
  const orchestrator = ContentOrchestrator.getInstance();
  const content = await orchestrator.generateContent(params);
  
  // Log what was generated
  console.log(`[EXPLORATION_WRAPPER] ✅ Generated ${content.format} using: ${content.metadata.generator_used}`);
  console.log(`[EXPLORATION_WRAPPER] 🎯 Viral score: ${content.metadata.viral_score || 'N/A'}`);
  console.log(`[EXPLORATION_WRAPPER] ⭐ Quality score: ${content.metadata.quality_score || 'N/A'}`);
  
  return content;
}


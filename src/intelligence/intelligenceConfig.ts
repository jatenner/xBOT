/**
 * INTELLIGENCE CONFIGURATION
 * Controls AI intelligence system behavior
 */

import { IntelligenceConfig } from './intelligenceTypes';

export const intelligenceConfig: IntelligenceConfig = {
  preGeneration: {
    enabled: process.env.ENABLE_PRE_GENERATION_INTELLIGENCE !== 'false', // Default ON
    skipIfBudgetLow: true,
    cacheResults: true,
    cacheDurationMinutes: 60 // Cache intelligence for 1 hour per topic
  },
  postGeneration: {
    enabled: process.env.ENABLE_POST_GENERATION_INTELLIGENCE !== 'false', // Default ON
    minimumScore: 75 // Intelligence score threshold
  },
  enhancement: {
    enabled: process.env.ENABLE_INTELLIGENCE_ENHANCEMENT !== 'false', // Default ON
    maxAttempts: 2,
    minScoreToEnhance: 75 // Enhance if below this score
  }
};

export function isIntelligenceEnabled(): boolean {
  return intelligenceConfig.preGeneration.enabled ||
         intelligenceConfig.postGeneration.enabled ||
         intelligenceConfig.enhancement.enabled;
}

export function getIntelligenceStatus(): string {
  const status = [];
  if (intelligenceConfig.preGeneration.enabled) status.push('PreGen');
  if (intelligenceConfig.postGeneration.enabled) status.push('PostGen');
  if (intelligenceConfig.enhancement.enabled) status.push('Enhancement');
  
  return status.length > 0 ? status.join('+') : 'Disabled';
}


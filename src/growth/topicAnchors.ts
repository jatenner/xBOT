/**
 * 🎯 TOPIC ANCHORS
 * Phase 6.3: Precomputed anchor embeddings for topic-fit scoring
 * 
 * Defines health/wellness topic anchors:
 * - sleep
 * - nutrition
 * - training
 * - longevity
 * - recovery
 */

import { getTextEmbedding } from './embeddings';
import { cosineSimilarity } from './embeddings';

/**
 * Topic anchor texts (short, focused)
 */
export const TOPIC_ANCHORS = {
  sleep: 'Sleep quality, circadian rhythm, REM sleep, deep sleep stages, sleep hygiene',
  nutrition: 'Nutrition, macronutrients, micronutrients, dietary patterns, meal timing, supplements',
  training: 'Exercise, strength training, cardiovascular fitness, workout routines, training adaptations',
  longevity: 'Longevity, lifespan extension, anti-aging, cellular health, biomarkers of aging',
  recovery: 'Recovery, muscle recovery, rest days, active recovery, sleep for recovery',
} as const;

export type TopicAnchorKey = keyof typeof TOPIC_ANCHORS;

/**
 * Precomputed anchor embeddings (lazy-loaded and cached)
 */
let anchorEmbeddingsCache: Map<TopicAnchorKey, number[]> | null = null;

/**
 * Get or compute anchor embeddings (cached in memory after first load)
 */
async function getAnchorEmbeddings(): Promise<Map<TopicAnchorKey, number[]>> {
  if (anchorEmbeddingsCache) {
    return anchorEmbeddingsCache;
  }
  
  const embeddings = new Map<TopicAnchorKey, number[]>();
  
  // Generate embeddings for all anchors (with caching via getTextEmbedding)
  for (const [key, text] of Object.entries(TOPIC_ANCHORS)) {
    try {
      const embedding = await getTextEmbedding(text, { useCache: true });
      embeddings.set(key as TopicAnchorKey, embedding);
    } catch (error: any) {
      console.warn(`[TOPIC_ANCHORS] Failed to generate embedding for ${key}:`, error.message);
      // Continue with other anchors
    }
  }
  
  anchorEmbeddingsCache = embeddings;
  return embeddings;
}

/**
 * Compute topic fit score (0-1) for candidate text
 * Returns highest similarity across all topic anchors
 */
export async function computeTopicFit(candidateText: string): Promise<number> {
  try {
    // Get candidate embedding
    const candidateEmbedding = await getTextEmbedding(candidateText, { useCache: true });
    
    // Get anchor embeddings
    const anchorEmbeddings = await getAnchorEmbeddings();
    
    if (anchorEmbeddings.size === 0) {
      // No anchors available - fallback
      console.warn('[TOPIC_FIT] No anchor embeddings available, using fallback');
      return 0.5;
    }
    
    // Calculate similarity to each anchor, take maximum
    let maxSimilarity = -1;
    let bestAnchor: TopicAnchorKey | null = null;
    
    for (const [anchorKey, anchorEmbedding] of anchorEmbeddings.entries()) {
      const similarity = cosineSimilarity(candidateEmbedding, anchorEmbedding);
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestAnchor = anchorKey;
      }
    }
    
    // Normalize: cosine similarity is typically -1 to 1, but embeddings are usually 0.2-0.9
    // Map to 0-1 range: assume 0.3 is low (0.0) and 0.8 is high (1.0)
    const normalized = Math.max(0, Math.min(1, (maxSimilarity - 0.3) / 0.5));
    
    return normalized;
  } catch (error: any) {
    // Fallback on error
    console.warn('[TOPIC_FIT] Error computing topic fit, using fallback:', error.message);
    return 0.5;
  }
}

/**
 * Compute topic fit with anchor details (for auditability)
 */
export async function computeTopicFitWithDetails(candidateText: string): Promise<{
  score: number;
  bestAnchor: TopicAnchorKey | null;
  similarities: Record<TopicAnchorKey, number>;
}> {
  try {
    const candidateEmbedding = await getTextEmbedding(candidateText, { useCache: true });
    const anchorEmbeddings = await getAnchorEmbeddings();
    
    if (anchorEmbeddings.size === 0) {
      return {
        score: 0.5,
        bestAnchor: null,
        similarities: {} as Record<TopicAnchorKey, number>,
      };
    }
    
    const similarities: Record<TopicAnchorKey, number> = {} as any;
    let maxSimilarity = -1;
    let bestAnchor: TopicAnchorKey | null = null;
    
    for (const [anchorKey, anchorEmbedding] of anchorEmbeddings.entries()) {
      const similarity = cosineSimilarity(candidateEmbedding, anchorEmbedding);
      similarities[anchorKey] = similarity;
      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestAnchor = anchorKey;
      }
    }
    
    const normalized = Math.max(0, Math.min(1, (maxSimilarity - 0.3) / 0.5));
    
    return {
      score: normalized,
      bestAnchor,
      similarities,
    };
  } catch (error: any) {
    return {
      score: 0.5,
      bestAnchor: null,
      similarities: {} as Record<TopicAnchorKey, number>,
    };
  }
}

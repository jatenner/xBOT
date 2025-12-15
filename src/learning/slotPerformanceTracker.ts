/**
 * Slot Performance Tracker
 * 
 * Provides slot performance scores based on v2 learning signals
 * Used by Phase 4 routing to make intelligent model selection decisions
 */

import { getSupabaseClient } from '../db';

export interface SlotPerformance {
  slot: string;
  avg_primary_objective_score: number;
  avg_followers_gained_weighted: number;
  sample_size: number;
  last_updated: Date;
}

// Cache slot performance (6-hour TTL)
let slotPerformanceCache: Map<string, { data: SlotPerformance; timestamp: number }> = new Map();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Get slot performance score (0-1 scale)
 * 
 * Returns average primary_objective_score for the slot from vw_learning
 * Cached for 6 hours to avoid excessive DB queries
 */
export async function getSlotPerformanceScore(slot: string): Promise<number | null> {
  // Check cache first
  const cached = slotPerformanceCache.get(slot);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
    return cached.data.avg_primary_objective_score;
  }

  try {
    const supabase = getSupabaseClient();
    
    // Query vw_learning for slot performance (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('vw_learning')
      .select('primary_objective_score, followers_gained_weighted')
      .eq('content_slot', slot)
      .gte('posted_at', thirtyDaysAgo)
      .not('primary_objective_score', 'is', null);

    if (error) {
      console.warn(`[PHASE4][SlotPerformance] Failed to query slot performance for ${slot}:`, error.message);
      return null;
    }

    if (!data || data.length === 0) {
      // No data yet for this slot
      return null;
    }

    // Calculate average primary_objective_score
    const scores = data
      .map(row => row.primary_objective_score)
      .filter((score): score is number => score !== null && typeof score === 'number');
    
    if (scores.length === 0) {
      return null;
    }

    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Cache the result
    const performance: SlotPerformance = {
      slot,
      avg_primary_objective_score: avgScore,
      avg_followers_gained_weighted: 0, // Not used for routing decisions
      sample_size: scores.length,
      last_updated: new Date()
    };

    slotPerformanceCache.set(slot, {
      data: performance,
      timestamp: now
    });

    console.log(`[PHASE4][SlotPerformance] Slot ${slot}: score=${avgScore.toFixed(3)}, samples=${scores.length}`);
    
    return avgScore;
  } catch (error: any) {
    console.warn(`[PHASE4][SlotPerformance] Error getting slot performance for ${slot}:`, error.message);
    return null;
  }
}

/**
 * Clear cache (useful for testing or forced refresh)
 */
export function clearSlotPerformanceCache(): void {
  slotPerformanceCache.clear();
}


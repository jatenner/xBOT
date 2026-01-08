/**
 * Weighted seed sampling using seed_account_stats
 * Prefers seeds that produce gate-pass opportunities
 */

import { getSupabaseClient } from '../db/index';

interface SeedStats {
  handle: string;
  scraped_count: number;
  stored_count: number;
  tier1_pass?: number;
  tier2_pass?: number;
  tier3_pass?: number;
  disallowed_count?: number;
  last_harvest_at?: string;
}

interface SeedWeight {
  handle: string;
  weight: number;
  passRate: number;
  reason: string;
}

const RECENTNESS_THRESHOLD_HOURS = 24; // Seeds not harvested in 24h get slight boost

/**
 * Pick seeds using weighted sampling based on performance stats
 */
export async function pickSeedsWeighted(
  allSeeds: string[],
  seedsPerRun: number
): Promise<{ seeds: string[]; weights: SeedWeight[] }> {
  const supabase = getSupabaseClient();
  
  // Fetch stats for all seeds
  const { data: statsRows, error } = await supabase
    .from('seed_account_stats')
    .select('handle, scraped_count, stored_count, tier1_pass, tier2_pass, tier3_pass, disallowed_count, last_harvest_at')
    .in('handle', allSeeds);
  
  if (error) {
    console.warn(`[SEED_PICK] ⚠️ Failed to fetch seed stats: ${error.message}, using uniform sampling`);
    return {
      seeds: allSeeds.slice(0, seedsPerRun),
      weights: allSeeds.map(h => ({ handle: h, weight: 1.0, passRate: 0, reason: 'no_stats' })),
    };
  }
  
  // Create stats map
  const statsMap = new Map<string, SeedStats>();
  if (statsRows) {
    for (const row of statsRows) {
      statsMap.set(row.handle, {
        handle: row.handle,
        scraped_count: row.scraped_count || 0,
        stored_count: row.stored_count || 0,
        tier1_pass: row.tier1_pass || 0,
        tier2_pass: row.tier2_pass || 0,
        tier3_pass: row.tier3_pass || 0,
        disallowed_count: row.disallowed_count || 0,
        last_harvest_at: row.last_harvest_at || undefined,
      });
    }
  }
  
  // Calculate weights for each seed
  const weights: SeedWeight[] = [];
  const now = Date.now();
  
  for (const handle of allSeeds) {
    const stats = statsMap.get(handle);
    
    if (!stats || stats.stored_count === 0) {
      // No stats or no stored opportunities - neutral weight
      weights.push({
        handle,
        weight: 1.0,
        passRate: 0,
        reason: stats ? 'no_stored' : 'no_stats',
      });
      continue;
    }
    
    // Calculate pass rate (weighted by tier quality)
    // Tier1 = 1.0, Tier2 = 0.6, Tier3 = 0.3
    const weightedPasses = (stats.tier1_pass || 0) * 1.0 +
                          (stats.tier2_pass || 0) * 0.6 +
                          (stats.tier3_pass || 0) * 0.3;
    
    // Pass rate formula: (weighted_passes + 1) / (stored + 5)
    // +1 and +5 prevent division by zero and give new seeds a chance
    const passRate = (weightedPasses + 1) / (stats.stored_count + 5);
    
    // Recentness boost: if not harvested in last 24h, add small boost
    let recentnessBoost = 1.0;
    if (stats.last_harvest_at) {
      const lastHarvestMs = new Date(stats.last_harvest_at).getTime();
      const hoursSinceHarvest = (now - lastHarvestMs) / (1000 * 60 * 60);
      if (hoursSinceHarvest > RECENTNESS_THRESHOLD_HOURS) {
        recentnessBoost = 1.1; // 10% boost for stale seeds
      }
    } else {
      // Never harvested - slight boost
      recentnessBoost = 1.15;
    }
    
    // Final weight: clamp between 0.05 and 5.0
    const finalWeight = Math.max(0.05, Math.min(5.0, passRate * recentnessBoost));
    
    weights.push({
      handle,
      weight: finalWeight,
      passRate,
      reason: `passRate=${passRate.toFixed(3)} recentness=${recentnessBoost.toFixed(2)}`,
    });
  }
  
  // Weighted random sampling without replacement
  const selectedSeeds: string[] = [];
  const remainingWeights = [...weights];
  
  for (let i = 0; i < Math.min(seedsPerRun, allSeeds.length); i++) {
    // Calculate total weight
    const totalWeight = remainingWeights.reduce((sum, w) => sum + w.weight, 0);
    
    // Random selection
    let random = Math.random() * totalWeight;
    let selectedIndex = 0;
    
    for (let j = 0; j < remainingWeights.length; j++) {
      random -= remainingWeights[j].weight;
      if (random <= 0) {
        selectedIndex = j;
        break;
      }
    }
    
    const selected = remainingWeights[selectedIndex];
    selectedSeeds.push(selected.handle);
    remainingWeights.splice(selectedIndex, 1);
  }
  
  // Log top 5 weights and selected seeds
  const topWeights = weights
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5)
    .map(w => `@${w.handle}=${w.weight.toFixed(2)}`);
  
  console.log(`[SEED_PICK] strategy=weighted seeds=${selectedSeeds.length} top_weights=${topWeights.join(', ')}`);
  console.log(`[SEED_PICK] selected=${selectedSeeds.join(', ')}`);
  
  return { seeds: selectedSeeds, weights };
}


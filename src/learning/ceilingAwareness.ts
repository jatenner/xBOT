/**
 * 🚨 CEILING AWARENESS SYSTEM
 * 
 * Detects when system is SETTLING for "good enough"
 * Prevents optimization trap: "100 views is our best" → stuck at 100
 * 
 * Core Principle: "Never settle - always aim higher"
 */

import { getSupabaseClient } from '../db';

export interface CeilingStatus {
  isSettling: boolean;
  currentCeiling: number;
  potentialCeiling: number;
  currentBaseline: number;
  variance: number;
  recommendation: string;
}

/**
 * Evaluate if system is settling for current performance
 */
export async function evaluateIfSettling(): Promise<CeilingStatus> {
  console.log('[CEILING] 🚨 Checking for settling behavior...');
  
  const supabase = getSupabaseClient();
  
  // Get last 7 days of posts
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const { data: recent, error } = await supabase
    .from('content_with_outcomes')
    .select('actual_impressions, posted_at')
    .in('decision_type', ['single', 'thread'])  // ✅ Filter out replies - only learn from posts
    .gte('posted_at', sevenDaysAgo.toISOString())
    .not('actual_impressions', 'is', null)
    .order('posted_at', { ascending: false });
  
  if (error || !recent || recent.length < 20) {
    console.log('[CEILING] ⚠️ Insufficient data (need 20+ posts in last 7 days)');
    return {
      isSettling: false,
      currentCeiling: 0,
      potentialCeiling: 10000,
      currentBaseline: 0,
      variance: 0,
      recommendation: 'Not enough data yet - keep experimenting!'
    };
  }
  
  const views = recent.map(p => Number(p.actual_impressions) || 0);
  const recentAvg = average(views);
  const recentMax = Math.max(...views);
  const recentMin = Math.min(...views);
  const recentStdDev = standardDeviation(views);
  
  console.log(`[CEILING] Recent avg: ${recentAvg.toFixed(0)}, max: ${recentMax}, min: ${recentMin}`);
  console.log(`[CEILING] Std dev: ${recentStdDev.toFixed(0)}, CV: ${(recentStdDev / recentAvg).toFixed(2)}`);
  
  // Check for settling pattern
  // LOW VARIANCE + MODEST NUMBERS = SETTLING
  const coefficientOfVariation = recentStdDev / recentAvg; // Normalized variance
  const isLowVariance = coefficientOfVariation < 0.3; // <30% variation
  const isModestNumbers = recentMax < 1000; // Haven't hit viral
  const isSettling = isLowVariance && isModestNumbers;
  
  // Estimate potential based on account size and niche
  const potentialCeiling = estimatePotential(recent);
  
  let recommendation: string;
  
  if (isSettling) {
    recommendation = `🚨 SETTLING DETECTED! 
    Current: ${recentAvg.toFixed(0)} avg, ${recentMax} max
    Potential: ${potentialCeiling}+ views possible
    
    Action: BREAK THE PATTERN!
    ├─ Try completely new topics
    ├─ Experiment with wild formats
    ├─ Test controversial angles
    └─ Don't optimize current approach - it's hitting its limit!`;
  } else if (recentMax > recentAvg * 5) {
    recommendation = `✅ GOOD! High variance detected (${recentMax} vs ${recentAvg.toFixed(0)} avg)
    You're discovering what works. Keep experimenting!`;
  } else {
    recommendation = `📊 Need more variance. Current max (${recentMax}) is only ${(recentMax / recentAvg).toFixed(1)}x average.
    Try bolder experiments - aim for 10x outliers!`;
  }
  
  console.log(`[CEILING] ${isSettling ? '🚨 SETTLING' : '✅ HEALTHY'}`);
  
  return {
    isSettling,
    currentCeiling: recentMax,
    potentialCeiling,
    currentBaseline: recentMin,
    variance: coefficientOfVariation,
    recommendation
  };
}

/**
 * Estimate potential ceiling based on current performance
 * 
 * Health/wellness accounts typically can hit:
 * - Average post: 50-200 views
 * - Good post: 500-2,000 views
 * - Viral post: 5,000-50,000 views
 */
export function estimatePotential(recentPosts: any[]): number {
  if (!recentPosts || recentPosts.length === 0) return 10000;
  
  const views = recentPosts.map(p => Number(p.actual_impressions) || 0);
  const currentMax = Math.max(...views);
  
  // Estimate potential as 10x current max (always aim higher!)
  if (currentMax < 200) {
    return 2000; // 10x potential
  } else if (currentMax < 1000) {
    return 10000; // 10x potential
  } else if (currentMax < 5000) {
    return 50000; // 10x potential
  } else {
    return 100000; // Always aim higher!
  }
}

/**
 * HELPER: Calculate average
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  return numbers.reduce((a, b) => a + b, 0) / numbers.length;
}

/**
 * HELPER: Calculate standard deviation
 */
function standardDeviation(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const avg = average(numbers);
  const squaredDiffs = numbers.map(n => Math.pow(n - avg, 2));
  const variance = average(squaredDiffs);
  
  return Math.sqrt(variance);
}


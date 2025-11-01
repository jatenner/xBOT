/**
 * 🎲 EXPLORATION ENFORCER
 * 
 * Ensures system NEVER stops exploring (even when "succeeding")
 * Prevents convergence on single pattern
 * 
 * Core Rule: Exploration NEVER below 30%, even if crushing it
 */

import { getSupabaseClient } from '../db';
import { analyzeWeeklyGrowth } from '../analytics/growthAnalytics';
import { evaluateIfSettling } from './ceilingAwareness';

export interface ExplorationDecision {
  rate: number; // 0.3-0.7
  reasoning: string;
}

export interface DiversityHealth {
  healthy: boolean;
  issues: string[];
  fixes: string[];
}

/**
 * Calculate optimal exploration rate based on system health
 * 
 * NEVER below 30% - always discovering!
 */
export async function calculateExplorationRate(): Promise<ExplorationDecision> {
  console.log('[EXPLORATION] 🎲 Calculating optimal exploration rate...');
  
  // Get system health signals
  const [growth, ceiling] = await Promise.all([
    analyzeWeeklyGrowth(),
    evaluateIfSettling()
  ]);
  
  let explorationRate = 0.3; // Default 30% (minimum)
  let reasoning = '';
  
  // RULE 1: If settling, FORCE high exploration
  if (ceiling.isSettling) {
    explorationRate = 0.7; // 70% exploration!
    reasoning = 'Settling detected (low variance) - forcing high exploration to break plateau';
  }
  
  // RULE 2: If declining, MAXIMUM exploration
  else if (growth.trend === 'declining') {
    explorationRate = 0.9; // 90% exploration!
    reasoning = 'Declining performance - need radical new approaches';
  }
  
  // RULE 3: If growing/accelerating, still explore (don't exploit too much!)
  else if (growth.trend === 'growing' || growth.trend === 'accelerating') {
    explorationRate = 0.4; // 40% exploration
    reasoning = 'Growing but KEEP exploring - discover what could work even better';
  }
  
  // RULE 4: If flat, balanced exploration
  else {
    explorationRate = 0.5; // 50% exploration
    reasoning = 'Flat performance - balanced exploration to find new winners';
  }
  
  // 🚨 CRITICAL: NEVER go below 30% exploration!
  // Always keep discovering, never fully exploit
  explorationRate = Math.max(0.3, explorationRate);
  
  console.log(`[EXPLORATION] Rate: ${(explorationRate * 100).toFixed(0)}% - ${reasoning}`);
  
  return { rate: explorationRate, reasoning };
}

/**
 * Check diversity health - detect if system is converging on patterns
 */
export async function checkDiversityHealth(): Promise<DiversityHealth> {
  console.log('[EXPLORATION] 🔍 Checking diversity health...');
  
  const supabase = getSupabaseClient();
  
  // Get last 50 posts
  const { data: recent } = await supabase
    .from('content_metadata')
    .select('generator_name, format_strategy, visual_format, raw_topic')
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (!recent || recent.length < 20) {
    return {
      healthy: true,
      issues: [],
      fixes: []
    };
  }
  
  const issues: string[] = [];
  const fixes: string[] = [];
  
  // CHECK 1: Generator distribution
  const generatorCounts = countDistribution(recent, 'generator_name');
  const maxGeneratorUsage = Math.max(...Object.values(generatorCounts)) / recent.length;
  
  if (maxGeneratorUsage > 0.4) { // One generator >40% usage
    const dominantGenerator = Object.entries(generatorCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
    issues.push(`One generator dominates: ${dominantGenerator} (${(maxGeneratorUsage * 100).toFixed(0)}% usage)`);
    fixes.push('FORCE even distribution - actively pick underused generators');
  }
  
  // CHECK 2: Format diversity
  const uniqueFormats = new Set(recent.map(p => p.format_strategy).filter(Boolean)).size;
  
  if (uniqueFormats < 10) { // Less than 10 unique formats in 50 posts
    issues.push(`Low format diversity (only ${uniqueFormats} unique strategies)`);
    fixes.push('System converging on patterns - inject randomness!');
  }
  
  // CHECK 3: Visual diversity
  const visualCounts = countDistribution(recent, 'visual_format');
  const plainTextRatio = (visualCounts['plain'] || visualCounts[''] || 0) / recent.length;
  
  if (plainTextRatio > 0.7) { // >70% plain text
    issues.push('Visual formatting underutilized (70%+ plain text)');
    fixes.push('Encourage more visual variety - bullets, spacing, emojis');
  }
  
  // CHECK 4: Topic diversity
  const uniqueTopics = new Set(recent.map(p => p.raw_topic).filter(Boolean)).size;
  const topicReuseRate = recent.length / uniqueTopics;
  
  if (topicReuseRate > 2) { // Average topic used 2+ times
    issues.push(`Topics being reused too frequently (${topicReuseRate.toFixed(1)}x average)`);
    fixes.push('Generate more unique topics - avoid repetition');
  }
  
  const healthy = issues.length === 0;
  
  console.log(`[EXPLORATION] ${healthy ? '✅ HEALTHY' : '⚠️ ISSUES'}: ${issues.length} issues found`);
  
  return {
    healthy,
    issues,
    fixes
  };
}

/**
 * HELPER: Count distribution of a dimension
 */
function countDistribution(posts: any[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  
  posts.forEach(post => {
    const value = String(post[field] || '');
    counts[value] = (counts[value] || 0) + 1;
  });
  
  return counts;
}


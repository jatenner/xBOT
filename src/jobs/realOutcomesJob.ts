/**
 * 📊 REAL OUTCOMES JOB  
 * Collects real Twitter analytics and stores outcomes for learning
 */

import { getConfig, getModeFlags } from '../config/config';
import { getSupabaseClient } from '../db/index';

export async function collectRealOutcomes(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);
  
  console.log('[REAL_OUTCOMES] 📊 Starting real outcomes collection...');
  
  try {
    // Only run in live mode
    if (flags.useSyntheticGeneration) {
      console.log('[REAL_OUTCOMES] ℹ️ Skipping in shadow mode (using simulated outcomes)');
      return;
    }
    
    // 1. Get recent posted decisions without outcomes
    const recentDecisions = await getRecentPostedDecisions();
    if (recentDecisions.length === 0) {
      console.log('[REAL_OUTCOMES] ℹ️ No recent posted decisions without outcomes');
      return;
    }
    
    console.log(`[REAL_OUTCOMES] 📋 Found ${recentDecisions.length} posted decisions needing outcomes`);
    
    // 2. Collect real analytics for each decision  
    const { collectRealEngagementData, storeUnifiedOutcome } = await import('./outcomeWriter');
    // Convert PostedDecision to Decision format expected by outcomeWriter
    const decisionsForAnalytics = recentDecisions.map(pd => ({
      id: pd.id,
      content: pd.content,
      decision_type: pd.decision_type,
      bandit_arm: pd.bandit_arm,
      timing_arm: pd.timing_arm,
      predicted_er: pd.predicted_er,
      posted_at: new Date(pd.posted_at), // Convert string to Date
      tweet_id: pd.tweet_id
    }));
    const outcomes = await collectRealEngagementData(decisionsForAnalytics);
    
    if (outcomes.length === 0) {
      console.log('[REAL_OUTCOMES] ⚠️ No analytics data available yet');
      return;
    }
    
    // 3. Store unified outcomes
    let successCount = 0;
    for (const outcome of outcomes) {
      try {
        await storeUnifiedOutcome(outcome);
        successCount++;
      } catch (error) {
        console.error(`[REAL_OUTCOMES] ❌ Failed to store outcome for ${outcome.decision_id}:`, error.message);
      }
    }
    
    console.log(`[REAL_OUTCOMES] ✅ Stored ${successCount}/${outcomes.length} real outcomes`);
    
  } catch (error) {
    console.error('[REAL_OUTCOMES] ❌ Real outcomes collection failed:', error.message);
    throw error;
  }
}

interface PostedDecision {
  id: string;
  content: string;
  tweet_id: string;
  posted_at: string;
  decision_type: 'content' | 'reply';
  bandit_arm?: string;
  timing_arm?: string;
  predicted_er?: number;
}

async function getRecentPostedDecisions(): Promise<PostedDecision[]> {
  try {
    const supabase = getSupabaseClient();
    
    // Get decisions posted in the last 24 hours that don't have outcomes yet
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // Query from posted_decisions (the authoritative table for posted content)
    const { data: decisions, error: decisionsError } = await supabase
      .from('posted_decisions')
      .select('*')
      .not('tweet_id', 'is', null)
      .gte('posted_at', twentyFourHoursAgo)
      .order('posted_at', { ascending: false });
    
    if (decisionsError) {
      console.error('[REAL_OUTCOMES] ❌ Failed to fetch posted decisions:', decisionsError.message);
      return [];
    }
    
    if (!decisions || decisions.length === 0) {
      return [];
    }
    
    // Filter out decisions that already have outcomes
    const { data: existingOutcomes, error: outcomesError } = await supabase
      .from('outcomes')
      .select('decision_id')
      .in('decision_id', decisions.map(d => d.id))
      .eq('simulated', false);
    
    if (outcomesError) {
      console.warn('[REAL_OUTCOMES] ⚠️ Failed to check existing outcomes:', outcomesError.message);
      // Continue anyway - duplicates will be handled by unique constraints
    }
    
    const existingOutcomeIds = new Set((existingOutcomes || []).map(o => o.decision_id));
    
    // Define a proper row interface for safer mapping
    interface DecisionRow {
      [key: string]: unknown;
      id: unknown;
      content: unknown;
      tweet_id: unknown;
      posted_at: unknown;
      decision_type: unknown;
      bandit_arm?: unknown;
      timing_arm?: unknown;
      predicted_er?: unknown;
    }
    
    const rows = decisions as DecisionRow[];
    const filteredDecisions = rows
      .filter(d => !existingOutcomeIds.has(String(d.id)))
      .map(d => ({
        id: String(d.id ?? ''),
        content: String(d.content ?? ''),
        tweet_id: String(d.tweet_id ?? ''),
        posted_at: String(d.posted_at ?? new Date().toISOString()),
        decision_type: String(d.decision_type ?? 'content') as 'content' | 'reply',
        bandit_arm: d.bandit_arm ? String(d.bandit_arm) : undefined,
        timing_arm: d.timing_arm ? String(d.timing_arm) : undefined,
        predicted_er: d.predicted_er ? Number(d.predicted_er) : undefined
      }));
    
    console.log(`[REAL_OUTCOMES] 📋 Found ${filteredDecisions.length} decisions needing real outcomes`);
    
    return filteredDecisions;
    
  } catch (error) {
    console.error('[REAL_OUTCOMES] ❌ Failed to get recent posted decisions:', error.message);
    return [];
  }
}

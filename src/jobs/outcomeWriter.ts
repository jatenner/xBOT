/**
 * 🎯 OUTCOME WRITER
 * Collects real engagement data and stores unified outcomes for learning
 */

import { getSupabaseClient } from '../db/index';
import { getConfig, getModeFlags } from '../config/config';

export interface Decision {
  id: string;
  content: string;
  tweet_id?: string;
  posted_at: Date;
  decision_type: 'content' | 'reply';
  bandit_arm?: string;
  timing_arm?: string;
  predicted_er?: number;
}

export interface OutcomeData {
  decision_id: string;
  tweet_id?: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks?: number;
  er_calculated: number;
  followers_delta_24h: number;
  viral_score: number;
  simulated: boolean;
  collected_at: Date;
}

/**
 * Collect real engagement data from Twitter API/scraping for recent decisions
 */
export async function collectRealEngagementData(decisions: Decision[]): Promise<OutcomeData[]> {
  console.log(`[OUTCOME_WRITER] 📊 Collecting real engagement for ${decisions.length} decisions...`);
  
  const supabase = getSupabaseClient();
  const outcomes: OutcomeData[] = [];

  for (const decision of decisions) {
    if (!decision.tweet_id) {
      console.log(`[OUTCOME_WRITER] ⚠️ Skipping decision ${decision.id} - no tweet_id`);
      continue;
    }

    try {
      // Query real Twitter analytics data
      const { data: analytics, error } = await supabase
        .from('tweet_analytics')
        .select('*')
        .eq('tweet_id', decision.tweet_id)
        .order('snapshot_time', { ascending: false })
        .limit(1)
        .single();

      if (error || !analytics) {
        console.log(`[OUTCOME_WRITER] ⚠️ No analytics found for tweet ${decision.tweet_id}`);
        continue;
      }

      // Get follower delta (simplified - would need real follower tracking)
      const followersDelta = Math.max(0, Math.floor((analytics.likes as number || 0) * 0.02)); // Rough estimate: 2% of likes convert to follows

      const outcome: OutcomeData = {
        decision_id: decision.id,
        tweet_id: decision.tweet_id,
        impressions: (analytics.views as number) || Math.max((analytics.likes as number || 0) * 30, 100), // Estimate if not available
        likes: (analytics.likes as number) || 0,
        retweets: (analytics.retweets as number) || 0,
        replies: (analytics.replies as number) || 0,
        bookmarks: (analytics.bookmarks as number) || 0,
        er_calculated: (analytics.engagement_rate as number) || 0,
        followers_delta_24h: followersDelta,
        viral_score: (analytics.viral_score as number) || 0,
        simulated: false,
        collected_at: new Date()
      };

      outcomes.push(outcome);
      console.log(`[OUTCOME_WRITER] ✅ Real data for ${decision.tweet_id}: ${outcome.likes}L, ${outcome.retweets}RT, ER=${(outcome.er_calculated * 100).toFixed(2)}%`);

    } catch (error) {
      console.error(`[OUTCOME_WRITER] ❌ Failed to collect data for ${decision.tweet_id}:`, error.message);
    }
  }

  console.log(`[OUTCOME_WRITER] 📈 Collected real outcomes for ${outcomes.length}/${decisions.length} decisions`);
  return outcomes;
}

/**
 * Store unified outcome data in the outcomes table
 */
export async function storeUnifiedOutcome(outcome: OutcomeData): Promise<void> {
  console.log(`[OUTCOME_WRITER] 💾 Storing ${outcome.simulated ? 'simulated' : 'real'} outcome for decision ${outcome.decision_id}`);
  
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('outcomes')
      .upsert([{
        decision_id: outcome.decision_id,
        tweet_id: outcome.tweet_id,
        impressions: outcome.impressions,
        likes: outcome.likes,
        retweets: outcome.retweets,
        replies: outcome.replies,
        bookmarks: outcome.bookmarks || 0,
        er_calculated: outcome.er_calculated,
        followers_delta_24h: outcome.followers_delta_24h,
        viral_score: outcome.viral_score,
        simulated: outcome.simulated,
        collected_at: outcome.collected_at.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }], {
        onConflict: 'decision_id'
      });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    console.log(`[OUTCOME_WRITER] ✅ Stored outcome for decision ${outcome.decision_id}`);
    
    // Update metrics
    const { updateMockMetrics } = await import('../api/metrics');
    updateMockMetrics({ outcomesWritten: 1 });
  } catch (error) {
    console.error(`[OUTCOME_WRITER] ❌ Failed to store outcome:`, error.message);
    throw error;
  }
}

/**
 * Real outcomes job - collects actual Twitter metrics for live mode
 */
export async function runRealOutcomesJob(): Promise<void> {
  const config = getConfig();
  const flags = getModeFlags(config);

  if (flags.simulateOutcomes) {
    console.log('[REAL_OUTCOMES_JOB] ⏭️ Skipping - in shadow mode');
    return;
  }

  console.log('[REAL_OUTCOMES_JOB] 🔍 Collecting real Twitter engagement data...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Get recent posted decisions that don't have real outcomes yet
    const { data: decisions, error } = await supabase
      .from('posted_decisions')
      .select(`
        id, decision_id, content, tweet_id, posted_at, decision_type, 
        bandit_arm, timing_arm, generation_source
      `)
      .not('tweet_id', 'is', null)
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false })
      .limit(50);

    if (error) {
      throw new Error(`Failed to fetch decisions: ${error.message}`);
    }

    if (!decisions || decisions.length === 0) {
      console.log('[REAL_OUTCOMES_JOB] ℹ️ No decisions needing real outcome collection');
      return;
    }

    console.log(`[REAL_OUTCOMES_JOB] 📋 Found ${decisions.length} decisions needing real outcome data`);

    // Collect real engagement data
    const outcomes = await collectRealEngagementData(decisions as Decision[]);

    // Store each outcome
    for (const outcome of outcomes) {
      await storeUnifiedOutcome(outcome);
    }

    console.log(`[REAL_OUTCOMES_JOB] ✅ Processed ${outcomes.length} real outcomes`);
  } catch (error) {
    console.error('[REAL_OUTCOMES_JOB] ❌ Failed:', error.message);
    throw error;
  }
}

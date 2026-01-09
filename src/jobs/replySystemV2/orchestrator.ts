/**
 * 🎼 REPLY SYSTEM V2 ORCHESTRATOR
 * 
 * Coordinates all components:
 * 1. Fetch candidates from feeds
 * 2. Score and filter candidates
 * 3. Refresh queue
 * 4. Schedule posts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../db/index';
import { fetchCuratedAccountsFeed } from './curatedAccountsFeed';
import { fetchKeywordFeed } from './keywordFeed';
import { fetchViralWatcherFeed } from './viralWatcherFeed';
import { scoreCandidate } from './candidateScorer';
import { refreshCandidateQueue } from './queueManager';

/**
 * Fetch candidates from all feeds and evaluate them
 */
export async function fetchAndEvaluateCandidates(): Promise<{
  fetched: number;
  evaluated: number;
  passed_filters: number;
  feed_run_id: string;
}> {
  console.log('[ORCHESTRATOR] 🎼 Fetching and evaluating candidates...');
  
  // Validate environment variables
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_URL) {
    const errorMsg = '[ORCHESTRATOR] ❌ Missing required environment variables: DATABASE_URL or SUPABASE_URL';
    console.error(errorMsg);
    
    // Log to system_events if possible
    try {
      const { getSupabaseClient } = await import('../../db/index');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_env_var_missing',
        severity: 'critical',
        message: errorMsg,
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      // If we can't log, at least throw
    }
    
    throw new Error(errorMsg);
  }
  
  const supabase = getSupabaseClient();
  const feedRunId = `feed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  console.log(`[ORCHESTRATOR] 🆔 Feed run ID: ${feedRunId}`);
  
  // Log job start to system_events
  try {
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_fetch_job_started',
      severity: 'info',
      message: `Reply V2 fetch job started: feed_run_id=${feedRunId}`,
      event_data: { feed_run_id: feedRunId },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn(`[ORCHESTRATOR] Failed to log job start: ${(e as Error).message}`);
  }
  
  let totalFetched = 0;
  let totalEvaluated = 0;
  let totalPassed = 0;
  
  // Get control plane state for feed weights
  const { data: controlState } = await supabase
    .from('control_plane_state')
    .select('feed_weights')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single();
  
  const feedWeights = controlState?.feed_weights || {
    curated_accounts: 0.5,
    keyword_search: 0.3,
    viral_watcher: 0.2
  };
  
  console.log(`[ORCHESTRATOR] 🎛️ Using feed weights: ${JSON.stringify(feedWeights)}`);
  
  // Fetch from all sources (feed weights used for logging/prioritization, but all feeds run)
  // TODO: Future optimization - skip low-weight feeds if queue is full
  const sources = [
    { name: 'curated_accounts', fetchFn: fetchCuratedAccountsFeed, weight: feedWeights.curated_accounts || 0.5 },
    { name: 'keyword_search', fetchFn: fetchKeywordFeed, weight: feedWeights.keyword_search || 0.3 },
    { name: 'viral_watcher', fetchFn: fetchViralWatcherFeed, weight: feedWeights.viral_watcher || 0.2 },
  ];
  
  // Sort by weight (highest first) for processing order
  sources.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  
  for (const source of sources) {
    console.log(`[ORCHESTRATOR] 📡 Fetching from ${source.name} (weight: ${source.weight.toFixed(2)})...`);
    try {
      console.log(`[ORCHESTRATOR] 📡 Fetching from ${source.name}...`);
      
      // Add timeout protection (5 minutes per source - feeds need more time for multiple keywords/accounts)
      const fetchPromise = source.fetchFn();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`Fetch timeout for ${source.name} after 5 minutes`)), 5 * 60 * 1000);
      });
      
      let tweets: any[] = [];
      try {
        tweets = await Promise.race([fetchPromise, timeoutPromise]);
      } catch (timeoutError: any) {
        console.error(`[ORCHESTRATOR] ⏱️ Timeout or error fetching ${source.name}: ${timeoutError.message}`);
        // Continue with next source instead of failing entire job
        continue;
      }
      
      if (!Array.isArray(tweets)) {
        console.warn(`[ORCHESTRATOR] ⚠️ ${source.name} returned non-array: ${typeof tweets}`);
        tweets = [];
      }
      
      totalFetched += tweets.length;
      console.log(`[ORCHESTRATOR] ✅ ${source.name}: fetched ${tweets.length} tweets`);
      
      // Get source record
      const { data: sourceRecord } = await supabase
        .from('candidate_sources')
        .select('id')
        .eq('source_type', source.name)
        .single();
      
      const sourceId = sourceRecord?.id;
      
      // Evaluate each tweet
      for (const tweet of tweets) {
        try {
          // Check if already evaluated
          const { data: existing } = await supabase
            .from('candidate_evaluations')
            .select('id')
            .eq('candidate_tweet_id', tweet.tweet_id)
            .single();
          
          if (existing) {
            continue; // Skip if already evaluated
          }
          
          // Score candidate (with feed_run_id for traceability)
          const score = await scoreCandidate(
            tweet.tweet_id,
            tweet.author_username,
            tweet.content,
            tweet.posted_at,
            tweet.like_count || 0,
            tweet.reply_count || 0,
            tweet.retweet_count || 0,
            feedRunId
          );
          
          totalEvaluated++;
          
          if (score.passed_hard_filters) {
            totalPassed++;
          }
          
          // Store evaluation (with AI judge decision if available)
          await supabase
            .from('candidate_evaluations')
            .insert({
              candidate_tweet_id: tweet.tweet_id,
              candidate_author_username: tweet.author_username,
              candidate_content: tweet.content,
              candidate_posted_at: tweet.posted_at,
              source_id: sourceId,
              source_type: source.name,
              source_feed_name: source.name,
              feed_run_id: feedRunId, // 🆔 Traceability
              is_root_tweet: score.is_root_tweet,
              is_parody: score.is_parody,
              topic_relevance_score: score.topic_relevance_score,
              spam_score: score.spam_score,
              velocity_score: score.velocity_score,
              recency_score: score.recency_score,
              author_signal_score: score.author_signal_score,
              overall_score: score.overall_score,
              passed_hard_filters: score.passed_hard_filters,
              filter_reason: score.filter_reason,
              predicted_24h_views: score.predicted_24h_views,
              predicted_tier: score.predicted_tier,
              status: score.passed_hard_filters ? 'evaluated' : 'blocked',
              // AI Judge fields
              ai_judge_decision: score.judge_decision ? {
                relevance: score.judge_decision.relevance,
                replyability: score.judge_decision.replyability,
                momentum: score.judge_decision.momentum,
                audience_fit: score.judge_decision.audience_fit,
                spam_risk: score.judge_decision.spam_risk,
                expected_views_bucket: score.judge_decision.expected_views_bucket,
                decision: score.judge_decision.decision,
                reasons: score.judge_decision.reasons
              } : null,
              judge_relevance: score.judge_decision?.relevance,
              judge_replyability: score.judge_decision?.replyability,
              judge_momentum: score.judge_decision?.momentum,
              judge_audience_fit: score.judge_decision?.audience_fit,
              judge_spam_risk: score.judge_decision?.spam_risk,
              judge_expected_views_bucket: score.judge_decision?.expected_views_bucket,
              judge_decision: score.judge_decision?.decision,
              judge_reasons: score.judge_decision?.reasons,
            });
          
        } catch (error: any) {
          console.error(`[ORCHESTRATOR] ⚠️ Failed to evaluate ${tweet.tweet_id}: ${error.message}`);
        }
      }
      
      // Update source last_fetched_at
      if (sourceId) {
        await supabase
          .from('candidate_sources')
          .update({ last_fetched_at: new Date().toISOString() })
          .eq('id', sourceId);
      }
      
    } catch (error: any) {
      console.error(`[ORCHESTRATOR] ❌ Failed to fetch from ${source.name}: ${error.message}`);
      console.error(`[ORCHESTRATOR] Stack: ${error.stack}`);
      
      // Log error to system_events
      try {
        await supabase.from('system_events').insert({
          event_type: 'reply_v2_fetch_job_error',
          severity: 'error',
          message: `Reply V2 fetch failed for ${source.name}: ${error.message}`,
          event_data: { 
            source_name: source.name, 
            error: error.message, 
            stack: error.stack?.substring(0, 500),
            feed_run_id: feedRunId 
          },
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.error(`[ORCHESTRATOR] Failed to log error: ${(e as Error).message}`);
      }
    }
  }
  
  // Always log completion, even if no candidates fetched
  // 🔒 CRITICAL: Use finally block to ensure completion event is ALWAYS logged
  try {
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_fetch_job_completed',
      severity: 'info',
      message: `Reply V2 fetch job completed: fetched=${totalFetched} evaluated=${totalEvaluated} passed=${totalPassed}`,
      event_data: { feed_run_id: feedRunId, fetched: totalFetched, evaluated: totalEvaluated, passed: totalPassed },
      created_at: new Date().toISOString(),
    });
    console.log(`[ORCHESTRATOR] ✅ Completion event logged`);
  } catch (e) {
    console.error(`[ORCHESTRATOR] ❌ CRITICAL: Failed to log completion: ${(e as Error).message}`);
    // Try one more time with error details
    try {
      await supabase.from('system_events').insert({
        event_type: 'reply_v2_fetch_job_completed',
        severity: 'warning',
        message: `Reply V2 fetch job completed (logging retry): fetched=${totalFetched} evaluated=${totalEvaluated} passed=${totalPassed}`,
        event_data: { 
          feed_run_id: feedRunId, 
          fetched: totalFetched, 
          evaluated: totalEvaluated, 
          passed: totalPassed,
          logging_error: (e as Error).message 
        },
        created_at: new Date().toISOString(),
      });
    } catch (retryError) {
      console.error(`[ORCHESTRATOR] ❌ Failed retry logging: ${(retryError as Error).message}`);
    }
  }
  
  console.log(`[ORCHESTRATOR] ✅ Fetched ${totalFetched} tweets, evaluated ${totalEvaluated}, passed ${totalPassed}`);
  
  return {
    fetched: totalFetched,
    evaluated: totalEvaluated,
    passed_filters: totalPassed,
    feed_run_id: feedRunId,
  };
}

/**
 * Run full cycle: fetch -> evaluate -> queue refresh
 */
export async function runFullCycle(): Promise<void> {
  console.log('[ORCHESTRATOR] 🔄 Running full cycle...');
  
  // Step 1: Fetch and evaluate
  const fetchResult = await fetchAndEvaluateCandidates();
  
  // Step 2: Refresh queue
  const queueResult = await refreshCandidateQueue();
  
  console.log(`[ORCHESTRATOR] ✅ Cycle complete: ${fetchResult.evaluated} evaluated, ${queueResult.queued} queued`);
}


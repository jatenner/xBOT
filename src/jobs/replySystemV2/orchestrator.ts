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
  const supabase = getSupabaseClient();
  const feedRunId = `feed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const startTime = Date.now();
  const FETCH_TIMEOUT_MS = 6 * 60 * 1000; // 6 minutes hard timeout
  
  console.log(`[ORCHESTRATOR] 🎼 Fetching and evaluating candidates: feed_run_id=${feedRunId}`);
  
  // Validate environment variables
  if (!process.env.DATABASE_URL && !process.env.SUPABASE_URL) {
    const errorMsg = '[ORCHESTRATOR] ❌ Missing required environment variables: DATABASE_URL or SUPABASE_URL';
    console.error(errorMsg);
    
    // Log to system_events if possible
    try {
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
  let fetchError: Error | null = null;
  
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
  
  // 🔒 MANDATE 3: Hard timeout wrapper
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Fetch timeout after ${FETCH_TIMEOUT_MS / 1000}s`));
    }, FETCH_TIMEOUT_MS);
  });
  
  const fetchPromise = (async () => {
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
    
    return {
      fetched: totalFetched,
      evaluated: totalEvaluated,
      passed_filters: totalPassed,
      feed_run_id: feedRunId,
    };
  })();
  
  // Race fetch against timeout
  try {
    const result = await Promise.race([fetchPromise, timeoutPromise]);
    fetchError = null;
    return result;
  } catch (error: any) {
    fetchError = error;
    throw error;
  } finally {
    // 🔒 MANDATE 3: ALWAYS log completion/failure in finally block
    const duration = Date.now() - startTime;
    const result = await fetchPromise.catch(() => null);
    
    // Determine if partial completion
    const isPartial = result ? (result.partial_sources.length > 0 || result.failed_sources.length > 0) : false;
    const success = !fetchError && !isPartial;
    
    if (fetchError) {
      // Log failure
      try {
        await supabase.from('system_events').insert({
          event_type: 'reply_v2_fetch_job_failed',
          severity: 'error',
          message: `Reply V2 fetch job failed: ${fetchError.message}`,
          event_data: {
            feed_run_id: feedRunId,
            error: fetchError.message,
            stack: fetchError.stack?.substring(0, 1000),
            duration_ms: duration,
            fetched: totalFetched,
            evaluated: totalEvaluated,
            passed: totalPassed,
            success: false,
            partial: false,
            reason_code: 'fetch_timeout',
            stage_timings: {
              browser_acquire_ms: 0, // Will be populated by feed sources
              nav_ms: 0,
              extract_ms: 0,
              db_ms: 0,
            },
          },
          created_at: new Date().toISOString(),
        });
        console.log(`[ORCHESTRATOR] ✅ Failure event logged`);
      } catch (e) {
        console.error(`[ORCHESTRATOR] ❌ Failed to log failure: ${(e as Error).message}`);
      }
    } else {
      // 🔒 MANDATE 3: Log completion (treat partial as completion)
      try {
        await supabase.from('system_events').insert({
          event_type: 'reply_v2_fetch_job_completed',
          severity: isPartial ? 'warning' : 'info',
          message: `Reply V2 fetch job completed: fetched=${totalFetched} evaluated=${totalEvaluated} passed=${totalPassed}${isPartial ? ' (PARTIAL)' : ''}`,
          event_data: {
            feed_run_id: feedRunId,
            fetched: totalFetched,
            evaluated: totalEvaluated,
            passed: totalPassed,
            duration_ms: duration,
            success: success,
            partial: isPartial,
            partial_sources: partialSourcesList,
            failed_sources: failedSourcesList,
            reason_code: isPartial ? 'partial_completion' : 'success',
          },
          created_at: new Date().toISOString(),
        });
        console.log(`[ORCHESTRATOR] ✅ Completion event logged (success=${success}, partial=${isPartial})`);
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
              duration_ms: duration,
              success: success,
              partial: isPartial,
              logging_error: (e as Error).message,
            },
            created_at: new Date().toISOString(),
          });
        } catch (retryError) {
          console.error(`[ORCHESTRATOR] ❌ Failed retry logging: ${(retryError as Error).message}`);
        }
      }
    }
    
    console.log(`[ORCHESTRATOR] ✅ Fetched ${totalFetched} tweets, evaluated ${totalEvaluated}, passed ${totalPassed} (${duration}ms, success=${success}, partial=${isPartial})`);
  }
}

/**
 * Run full cycle: fetch -> evaluate -> queue refresh + auto-repair
 */
export async function runFullCycle(): Promise<void> {
  console.log('[ORCHESTRATOR] 🔄 Running full cycle...');
  
  // Step 1: Fetch and evaluate
  const fetchResult = await fetchAndEvaluateCandidates();
  
  // Step 2: Refresh queue
  const queueResult = await refreshCandidateQueue();
  
  // 🔒 MANDATE 3: Queue health auto-repair
  const supabase = getSupabaseClient();
  const { count: queueSize } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  if ((queueSize || 0) < 5) {
    console.log(`[ORCHESTRATOR] 🔧 Queue size ${queueSize} < 5, triggering immediate refill...`);
    await refreshCandidateQueue(); // Refill immediately
  }
  
  // Reset stuck "selected" candidates (after 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: stuckCount } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'selected')
    .lt('selected_at', tenMinutesAgo);
  
  if ((stuckCount || 0) > 0) {
    console.log(`[ORCHESTRATOR] 🔧 Resetting ${stuckCount} stuck "selected" candidates...`);
    await supabase
      .from('reply_candidate_queue')
      .update({ status: 'queued', selected_at: null, scheduler_run_id: null })
      .eq('status', 'selected')
      .lt('selected_at', tenMinutesAgo);
  }
  
  console.log(`[ORCHESTRATOR] ✅ Cycle complete: ${fetchResult.evaluated} evaluated, ${queueResult.queued} queued, queue_size=${queueSize}`);
}


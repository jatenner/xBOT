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
import { fetchDiscoveredAccountsFeed } from './discoveredAccountsFeed';
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
  partial_sources?: string[];
  failed_sources?: string[];
}> {
  const supabase = getSupabaseClient();
  const feedRunId = `feed_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const startTime = Date.now();
  const FETCH_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes hard timeout (per mandate)
  
  // 🔒 PROOF_MODE: Skip all feed fetching during proofs
  if (process.env.PROOF_MODE === 'true') {
    console.log(`[ORCHESTRATOR] 🔒 PROOF_MODE: Skipping feed fetching (feed_run_id=${feedRunId})`);
    return {
      fetched: 0,
      evaluated: 0,
      passed_filters: 0,
      feed_run_id: feedRunId,
      partial_sources: [],
      failed_sources: [],
    };
  }
  
  console.log(`[ORCHESTRATOR] 🎼 Fetching and evaluating candidates: feed_run_id=${feedRunId}`);
  
  // 🎯 COOLDOWN: Check if feeds should be paused
  const { getConsentWallCooldown } = await import('../../utils/consentWallCooldown');
  const cooldown = getConsentWallCooldown();
  const cooldownStatus = cooldown.getStatus();
  
  if (cooldownStatus.active) {
    console.warn(`[ORCHESTRATOR] ⏸️ Feed fetching paused: consent wall cooldown active (${cooldownStatus.remainingSeconds}s remaining, ${cooldownStatus.recentWalls} recent walls)`);
    return {
      fetched: 0,
      evaluated: 0,
      passed_filters: 0,
      feed_run_id: feedRunId,
      partial_sources: [],
      failed_sources: [],
    };
  }
  
  // Validate environment
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not set');
  }
  
  // Log job start
  try {
    await supabase.from('system_events').insert({
      event_type: 'reply_v2_fetch_job_started',
      severity: 'info',
      message: `Reply V2 fetch job started: feed_run_id=${feedRunId}`,
      event_data: {
        feed_run_id: feedRunId,
        started_at: new Date().toISOString(),
      },
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error(`[ORCHESTRATOR] Failed to log job start: ${(e as Error).message}`);
  }
  
  let totalFetched = 0;
  let totalEvaluated = 0;
  let totalPassed = 0;
  let fetchError: Error | null = null;
  
  // Track partial/failed sources for completion logging
  let partialSources: string[] = [];
  let failedSources: string[] = [];
  
  // 🎯 GROWTH_CONTROLLER: Get feed weights from active plan (if enabled)
  let feedWeights: {
    curated_accounts: number;
    keyword_search: number;
    viral_watcher: number;
    discovered_accounts: number;
  };
  
  if (process.env.GROWTH_CONTROLLER_ENABLED === 'true') {
    try {
      const { getFeedWeights } = await import('../../jobs/growthController');
      feedWeights = await getFeedWeights();
      console.log(`[ORCHESTRATOR] 🎯 Using feed weights from Growth Controller: ${JSON.stringify(feedWeights)}`);
    } catch (controllerError: any) {
      console.warn(`[ORCHESTRATOR] ⚠️ Failed to get feed weights from controller: ${controllerError.message}, using defaults`);
      // Fallback to control plane or defaults
      const { data: controlState } = await supabase
        .from('control_plane_state')
        .select('feed_weights')
        .is('expires_at', null)
        .order('effective_at', { ascending: false })
        .limit(1)
        .single();
      
      feedWeights = controlState?.feed_weights || {
        curated_accounts: 0.35,
        keyword_search: 0.30,
        viral_watcher: 0.20,
        discovered_accounts: 0.15,
      };
    }
  } else {
    // Controller disabled, use control plane or defaults
    const { data: controlState } = await supabase
      .from('control_plane_state')
      .select('feed_weights')
      .is('expires_at', null)
      .order('effective_at', { ascending: false })
      .limit(1)
      .single();
    
    feedWeights = controlState?.feed_weights || {
      curated_accounts: 0.35, // Reduced from 0.4
      keyword_search: 0.30,
      viral_watcher: 0.20,
      discovered_accounts: 0.15, // 🔒 TASK 3: 15% from discovered accounts (10-20% range)
    };
  }
  
  console.log(`[ORCHESTRATOR] 🎛️ Using feed weights: ${JSON.stringify(feedWeights)}`);
  
  const sources = [
    { name: 'curated_accounts', fetchFn: fetchCuratedAccountsFeed, weight: feedWeights.curated_accounts || 0.4 },
    { name: 'keyword_search', fetchFn: fetchKeywordFeed, weight: feedWeights.keyword_search || 0.3 },
    { name: 'viral_watcher', fetchFn: fetchViralWatcherFeed, weight: feedWeights.viral_watcher || 0.2 },
    { name: 'discovered_accounts', fetchFn: fetchDiscoveredAccountsFeed, weight: feedWeights.discovered_accounts || 0.1 }, // 🔒 TASK 3: New source
  ];
  
  // Sort by weight (highest first) for processing order
  sources.sort((a, b) => (b.weight || 0) - (a.weight || 0));
  
  // 🔒 MANDATE 2: Hard timeout wrapper (4 minutes)
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Fetch timeout after ${FETCH_TIMEOUT_MS / 1000}s`));
    }, FETCH_TIMEOUT_MS);
  });
  
  const fetchPromise = (async () => {
    for (const source of sources) {
      const sourceStartTime = Date.now();
      console.log(`[ORCHESTRATOR] 📡 Fetching from ${source.name} (weight: ${source.weight.toFixed(2)})...`);
      
      try {
        // 🔒 MANDATE 2: Feeds already have 90s timeboxes, just call them
        // They will abort themselves if timeout exceeded
        const tweets = await source.fetchFn();
        
        if (!Array.isArray(tweets)) {
          console.warn(`[ORCHESTRATOR] ⚠️ ${source.name} returned non-array: ${typeof tweets}`);
          continue;
        }
        
        const sourceDuration = Date.now() - sourceStartTime;
        totalFetched += tweets.length;
        console.log(`[ORCHESTRATOR] ✅ ${source.name}: fetched ${tweets.length} tweets (${sourceDuration}ms)`);
        
        // Get source record
        const { data: sourceRecord } = await supabase
          .from('candidate_sources')
          .select('id')
          .eq('source_type', source.name)
          .single();
        
        const sourceId = sourceRecord?.id;
        
        // 🔒 TASK 4: Limit evaluations per tick (throughput knob)
        // 🎯 THROTTLE: Hard cap to prevent pool overload (reduced default)
        let REPLY_V2_MAX_EVAL_PER_TICK = parseInt(process.env.REPLY_V2_MAX_EVAL_PER_TICK || '7', 10); // Default 7 (was 15)
        
        // 🎯 ADAPTIVE THROTTLING: If ancestry timeout rate > 25% in last 10 min, halve eval rate
        try {
          const { getSupabaseClient } = await import('../../db');
          const supabase = getSupabaseClient();
          const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
          
          const { data: recentDecisions } = await supabase
            .from('reply_decisions')
            .select('decision, deny_reason_code')
            .gte('created_at', tenMinutesAgo);
          
          if (recentDecisions && recentDecisions.length > 0) {
            const total = recentDecisions.length;
            const ancestryTimeouts = recentDecisions.filter(
              (r: any) => r.decision === 'DENY' && r.deny_reason_code === 'ANCESTRY_TIMEOUT'
            ).length;
            const timeoutRate = total > 0 ? (ancestryTimeouts / total) : 0;
            
            if (timeoutRate > 0.25) {
              REPLY_V2_MAX_EVAL_PER_TICK = Math.max(3, Math.floor(REPLY_V2_MAX_EVAL_PER_TICK / 2));
              console.log(`[ORCHESTRATOR] 🎯 ADAPTIVE THROTTLE: Timeout rate ${(timeoutRate * 100).toFixed(1)}% > 25%, reducing eval per tick to ${REPLY_V2_MAX_EVAL_PER_TICK}`);
            }
          }
        } catch (e: any) {
          console.warn(`[ORCHESTRATOR] ⚠️ Adaptive throttling check failed: ${e.message}`);
        }
        
        const tweetsToEvaluate = REPLY_V2_MAX_EVAL_PER_TICK > 0 
          ? tweets.slice(0, REPLY_V2_MAX_EVAL_PER_TICK)
          : tweets;
        
        if (tweets.length > tweetsToEvaluate.length) {
          console.log(`[ORCHESTRATOR] 🎯 THROTTLE: Limited ${source.name} from ${tweets.length} to ${tweetsToEvaluate.length} candidates`);
        }
        
        // Evaluate each tweet
        for (const tweet of tweetsToEvaluate) {
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
            
            // 🎯 ANALYTICS: Record DENY decision for scoring failures
            if (!score.passed_hard_filters) {
              const { mapFilterReasonToDenyCode } = await import('./denyReasonMapper');
              const { resolveTweetAncestry, recordReplyDecision } = await import('./replyDecisionRecorder');
              
              // Resolve ancestry for DENY decision (needed for reply_decisions schema)
              const ancestry = await resolveTweetAncestry(tweet.tweet_id);
              const denyReasonCode = mapFilterReasonToDenyCode(score.filter_reason);
              
              // Record DENY decision with deny_reason_code
              await recordReplyDecision({
                target_tweet_id: tweet.tweet_id,
                target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
                root_tweet_id: ancestry.rootTweetId || 'null',
                ancestry_depth: ancestry.ancestryDepth ?? -1,
                is_root: ancestry.isRoot,
                decision: 'DENY',
                reason: `Scoring filter failed: ${score.filter_reason}`,
                deny_reason_code: denyReasonCode, // 🎯 ANALYTICS: Structured deny reason
                deny_reason_detail: null, // Scoring filters don't have stage details
                status: ancestry.status,
                confidence: ancestry.confidence,
                method: ancestry.method || 'unknown',
                cache_hit: ancestry.cache_hit || false,
                candidate_features: {
                  topic_relevance: score.topic_relevance_score,
                  velocity: score.velocity_score,
                  recency: score.recency_score,
                  author_signal: score.author_signal_score,
                  overall_score: score.overall_score,
                  filter_reason: score.filter_reason,
                },
                candidate_score: score.overall_score,
                scored_at: new Date().toISOString(),
                template_status: 'FAILED',
                trace_id: feedRunId,
                pipeline_source: 'reply_v2_scoring',
              } as any);
            }
            
            // 🎨 QUALITY TRACKING: Log candidate features for learning
            if (score.passed_hard_filters) {
              const { logCandidateFeatures } = await import('./candidateFeatureLogger');
              const postedTime = new Date(tweet.posted_at).getTime();
              const ageMinutes = (Date.now() - postedTime) / (1000 * 60);
              
              await logCandidateFeatures({
                candidate_tweet_id: tweet.tweet_id,
                feed_run_id: feedRunId,
                candidate_score: score.overall_score,
                topic_relevance_score: score.topic_relevance_score,
                spam_score: score.spam_score,
                velocity_score: score.velocity_score,
                recency_score: score.recency_score,
                author_signal_score: score.author_signal_score,
                current_likes: tweet.like_count || 0,
                current_replies: tweet.reply_count || 0,
                current_retweets: tweet.retweet_count || 0,
                age_minutes: ageMinutes,
                predicted_24h_views: score.predicted_24h_views,
                predicted_tier: score.predicted_tier,
                features_json: {
                  judge_decision: score.judge_decision,
                  filter_reason: score.filter_reason,
                },
              });
            }
            
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
        const sourceDuration = Date.now() - sourceStartTime;
        console.error(`[ORCHESTRATOR] ❌ Failed to fetch from ${source.name}: ${error.message} (${sourceDuration}ms)`);
        
        // Check if it's a timeout (partial completion)
        if (error.message?.includes('timeout')) {
          partialSources.push(source.name);
        } else {
          failedSources.push(source.name);
        }
        
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
              feed_run_id: feedRunId,
              duration_ms: sourceDuration,
            },
            created_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error(`[ORCHESTRATOR] Failed to log error: ${(e as Error).message}`);
        }
        
        // Continue with next source (don't fail entire job)
        continue;
      }
    }
    
    return {
      fetched: totalFetched,
      evaluated: totalEvaluated,
      passed_filters: totalPassed,
      feed_run_id: feedRunId,
      partial_sources: partialSources,
      failed_sources: failedSources,
    };
  })();
  
  // Race fetch against timeout
  let fetchResult: any = null;
  try {
    fetchResult = await Promise.race([fetchPromise, timeoutPromise]);
    fetchError = null;
    
    // Update totals from result
    if (fetchResult) {
      totalFetched = fetchResult.fetched || totalFetched;
      totalEvaluated = fetchResult.evaluated || totalEvaluated;
      totalPassed = fetchResult.passed_filters || totalPassed;
      partialSources = fetchResult.partial_sources || [];
      failedSources = fetchResult.failed_sources || [];
    }
    
    return fetchResult || {
      fetched: totalFetched,
      evaluated: totalEvaluated,
      passed_filters: totalPassed,
      feed_run_id: feedRunId,
      partial_sources: partialSources,
      failed_sources: failedSources,
    };
  } catch (error: any) {
    fetchError = error;
    // Don't throw - return partial results instead
    fetchResult = {
      fetched: totalFetched,
      evaluated: totalEvaluated,
      passed_filters: totalPassed,
      feed_run_id: feedRunId,
      partial_sources: partialSources,
      failed_sources: failedSources,
    };
  } finally {
    // 🔒 MANDATE 3: ALWAYS log completion/failure in finally block
    const duration = Date.now() - startTime;
    const result = fetchResult;
    
    // Determine if partial completion
    const isPartial = result ? (result.partial_sources?.length > 0 || result.failed_sources?.length > 0) : (partialSources.length > 0 || failedSources.length > 0);
    const success = !fetchError && !isPartial;
    const partialSourcesList = result?.partial_sources || partialSources;
    const failedSourcesList = result?.failed_sources || failedSources;
    
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
              browser_acquire_ms: 0,
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
  
  // 🔒 TASK 3: Run account discovery periodically (every 6 hours)
  const supabase = getSupabaseClient();
  const { data: lastDiscovery } = await supabase
    .from('system_events')
    .select('created_at')
    .eq('event_type', 'account_discovery_completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const shouldRunDiscovery = !lastDiscovery || lastDiscovery.created_at < sixHoursAgo;
  
  if (shouldRunDiscovery) {
    console.log('[ORCHESTRATOR] 🔍 Running account discovery...');
    try {
      const { runAccountDiscovery } = await import('./accountDiscovery');
      const discoveryResult = await runAccountDiscovery();
      console.log(`[ORCHESTRATOR] ✅ Account discovery: ${discoveryResult.high_performers.discovered + discoveryResult.curated_replies.discovered} new, ${discoveryResult.high_performers.updated + discoveryResult.curated_replies.updated} updated`);
      
      // Log discovery completion
      await supabase.from('system_events').insert({
        event_type: 'account_discovery_completed',
        severity: 'info',
        message: `Account discovery completed: ${discoveryResult.high_performers.discovered + discoveryResult.curated_replies.discovered} new accounts`,
        event_data: discoveryResult,
        created_at: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error(`[ORCHESTRATOR] ⚠️ Account discovery failed: ${error.message}`);
    }
  }
  
  // 🔒 MANDATE 3: Queue health auto-repair
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
  
  // 🎯 ANALYTICS: Adaptive tuning - widen candidate pool if 0 ALLOW decisions
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentDecisions } = await supabase
    .from('reply_decisions')
    .select('decision')
    .gte('created_at', oneHourAgo);
  
  const allowCount = recentDecisions?.filter(r => r.decision === 'ALLOW').length || 0;
  
  if (allowCount === 0 && (recentDecisions?.length || 0) > 0) {
    console.log(`[ORCHESTRATOR] 🎯 Adaptive tuning: 0 ALLOW decisions in last hour, relaxing non-safety thresholds...`);
    
    // Get current control plane state
    const { data: currentState } = await supabase
      .from('control_plane_state')
      .select('*')
      .is('expires_at', null)
      .order('effective_at', { ascending: false })
      .limit(1)
      .single();
    
    const currentThreshold = currentState?.acceptance_threshold || 0.6;
    const currentShortlistSize = currentState?.shortlist_size || 25;
    
    // Relax ONLY non-safety thresholds within safe bounds
    // Never change: root-only, fail-closed ancestry, method=unknown DENY
    const newThreshold = Math.max(0.3, Math.min(0.9, currentThreshold - 0.05)); // Lower by 0.05 (wider pool)
    const newShortlistSize = Math.min(50, currentShortlistSize + 5); // Increase by 5 (wider pool)
    
    if (newThreshold !== currentThreshold || newShortlistSize !== currentShortlistSize) {
      // Expire old state
      if (currentState) {
        await supabase
          .from('control_plane_state')
          .update({ expires_at: new Date().toISOString() })
          .eq('id', currentState.id);
      }
      
      // Insert new adaptive state
      await supabase
        .from('control_plane_state')
        .insert({
          effective_at: new Date().toISOString(),
          acceptance_threshold: newThreshold,
          shortlist_size: newShortlistSize,
          feed_weights: currentState?.feed_weights || { curated_accounts: 0.4, keyword_search: 0.3, viral_watcher: 0.2, discovered_accounts: 0.1 },
          exploration_rate: currentState?.exploration_rate || 0.1,
          budget_caps: currentState?.budget_caps || { hourly_max: 5.0, daily_max: 50.0, per_reply_max: 0.1 },
          model_preferences: currentState?.model_preferences || { default: 'gpt-4o-mini', fallback: 'gpt-4o-mini' },
          updated_by: 'adaptive_tuning',
          update_reason: `0 ALLOW decisions in last hour - relaxed thresholds: ${currentThreshold.toFixed(2)} -> ${newThreshold.toFixed(2)}, shortlist ${currentShortlistSize} -> ${newShortlistSize}`,
        });
      
      console.log(`[ORCHESTRATOR] ✅ Adaptive tuning applied: threshold ${currentThreshold.toFixed(2)} -> ${newThreshold.toFixed(2)}, shortlist ${currentShortlistSize} -> ${newShortlistSize}`);
      
      // Log adaptive tuning event
      await supabase.from('system_events').insert({
        event_type: 'adaptive_tuning_applied',
        severity: 'info',
        message: `Adaptive tuning: relaxed thresholds due to 0 ALLOW decisions`,
        event_data: {
          old_threshold: currentThreshold,
          new_threshold: newThreshold,
          old_shortlist_size: currentShortlistSize,
          new_shortlist_size: newShortlistSize,
          recent_decisions_count: recentDecisions?.length || 0,
        },
        created_at: new Date().toISOString(),
      });
    }
  }
  
  console.log(`[ORCHESTRATOR] ✅ Cycle complete: ${fetchResult.evaluated} evaluated, ${queueResult.queued} queued, queue_size=${queueSize}`);
}

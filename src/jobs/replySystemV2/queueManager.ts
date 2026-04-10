/**
 * 📋 QUEUE MANAGER
 * 
 * Maintains shortlist queue of top N candidates
 * Refreshes every 5 min
 */

import { getSupabaseClient } from '../../db/index';

// 🔒 TASK 4: Throughput knobs via env vars (safe, reversible)
const REPLY_V2_MAX_QUEUE_PER_TICK = parseInt(process.env.REPLY_V2_MAX_QUEUE_PER_TICK || '25', 10); // Default: 25
const QUEUE_SIZE = REPLY_V2_MAX_QUEUE_PER_TICK; // Top N candidates
const DEFAULT_TTL_MINUTES = 60; // Default TTL

// 🎯 STALE QUEUE FIX: Don't re-queue tweets older than this (minutes). Reduces stale pollution.
// 🎯 CONTROLLED_LIVE: When REPLY_CONTROLLED_LIVE=true, default to stricter 120 min unless overridden
const REPLY_CONTROLLED_LIVE = process.env.REPLY_CONTROLLED_LIVE === 'true';
const DEFAULT_MAX_AGE = REPLY_CONTROLLED_LIVE ? 120 : 360;
const MAX_TWEET_AGE_MINUTES = parseInt(process.env.REPLY_QUEUE_MAX_TWEET_AGE_MINUTES || String(DEFAULT_MAX_AGE), 10); // 2h controlled-live default, 6h otherwise

/** Summary stats for reply cycle observability */
export interface RefreshQueueSummary {
  fetched?: number;
  root_confirmed: number;
  rejected_non_root: number;
  rejected_freshness: number;
  rejected_judge: number;
  rejected_controlled_live?: number;
  queued: number;
  top_scores: number[];
  sample_rejects: string[];
}

/**
 * Refresh the candidate queue
 * @param runStartedAt Optional timestamp to prioritize fresh evaluations created after this time
 */
const REFRESH_QUEUE_FALLBACK = { evaluated: 0, queued: 0, expired: 0, summary: null as RefreshQueueSummary | null };

export async function refreshCandidateQueue(runStartedAt?: string): Promise<{
  evaluated: number;
  queued: number;
  expired: number;
  summary?: RefreshQueueSummary | null;
}> {
  let expiredCount = 0;
  let rejectedNonRoot = 0;
  try {
    const supabase = getSupabaseClient();
  
  // Get current control plane state for shortlist_size
  const { data: controlState } = await supabase
    .from('control_plane_state')
    .select('shortlist_size')
    .is('expires_at', null)
    .order('effective_at', { ascending: false })
    .limit(1)
    .single();
  
  const shortlistSize = controlState?.shortlist_size || 25;
  console.log('[QUEUE_MANAGER] 📋 Refreshing candidate queue (shortlist_size: ' + shortlistSize + ')...');
  
  // Step 1: Expire old queue entries
  const { data: expired } = await supabase
    .from('reply_candidate_queue')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .lt('expires_at', new Date().toISOString())
    .eq('status', 'queued')
    .select();

  expiredCount = expired?.length || 0;

  // Step 1b: Aggressively purge ancient entries (>3h) regardless of TTL
  // Stale candidates poison the queue and prevent fresh ones from being selected
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { data: purged } = await supabase
    .from('reply_candidate_queue')
    .update({ status: 'expired', updated_at: new Date().toISOString() })
    .lt('created_at', threeHoursAgo)
    .eq('status', 'queued')
    .select();

  const purgedCount = purged?.length || 0;
  if (expiredCount > 0 || purgedCount > 0) {
    console.log(`[QUEUE_MANAGER] ⏰ Expired ${expiredCount} (TTL) + purged ${purgedCount} (>3h stale) queue entries`);
  }
  
  // Step 2: Get top candidates from evaluations
  // If runStartedAt provided, prioritize fresh evaluations (created after run start)
  // Otherwise use evaluations from last 2h to ensure recent ones are included
  let query = supabase
    .from('candidate_evaluations')
    .select('*')
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 4) // Allow all tiers including tier 4 at bootstrap (was 3)
    .in('status', ['evaluated', 'queued']) // Include both evaluated and already-queued (for re-queuing expired ones)
    .order('overall_score', { ascending: false });
  
  if (runStartedAt) {
    // ONE_SHOT_FRESH_ONLY=true: Filter strictly by runStartedAt
    query = query.gte('created_at', runStartedAt);
    console.log(`[QUEUE_MANAGER] 🔍 Filtering for fresh evaluations (created_at >= ${runStartedAt})`);
  } else {
    // Freshness window: 3h max — stale candidates poison the queue and block fresh ones
    // At 0 followers, replying to tweets >3h old has near-zero visibility
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', threeHoursAgo);
    console.log(`[QUEUE_MANAGER] 🔍 Filtering for recent evaluations (created_at >= ${threeHoursAgo}, 3h window)`);
  }
  
  const { data: rawTopCandidates } = await query.limit(shortlistSize * 2);
  // 🚫 Exclude consent-wall placeholder IDs (never real candidates)
  let topCandidates = (rawTopCandidates || []).filter((c: { candidate_tweet_id?: string }) => !(c.candidate_tweet_id || '').startsWith('consent_wall_'));
  if ((rawTopCandidates?.length || 0) > topCandidates.length) {
    console.log(`[QUEUE_MANAGER] 🚫 Filtered ${(rawTopCandidates?.length || 0) - topCandidates.length} consent_wall_* placeholder(s)`);
  }

  if (topCandidates.length === 0) {
    console.log('[QUEUE_MANAGER] ⚠️ No candidates available for queue');
    return { evaluated: 0, queued: 0, expired: expiredCount, summary: { root_confirmed: 0, rejected_non_root: 0, rejected_freshness: 0, rejected_judge: 0, queued: 0, top_scores: [], sample_rejects: [] } };
  }

  console.log(`[QUEUE_MANAGER] 📊 Found ${topCandidates.length} candidates to consider`);
  let rootConfirmedForSummary = topCandidates.length; // After root filter (or all if not root-only)
  if (REPLY_CONTROLLED_LIVE) {
    console.log('[QUEUE_MANAGER] 🎯 REPLY_CONTROLLED_LIVE=true: applying stricter freshness/engagement/health_angle/followers gates');
  }

  // 🔒 ROOT_ONLY FILTER: When ROOT_ONLY mode is active, only queue candidates that exist in reply_opportunities as root tweets
  const rootOnlyMode = process.env.REPLY_V2_ROOT_ONLY !== 'false'; // Default true
  
  // 🔗 BRIDGE: Evaluate root opportunities that don't have evaluations yet
  if (rootOnlyMode) {
    const runId = `root_eval_${Date.now()}`;
    const p1MaxAgeHours = parseInt(process.env.P1_TARGET_MAX_AGE_HOURS || '3', 10);
    console.log(`[ROOT_EVAL] ENTER refreshCandidateQueue run_id=${runId} root_only=${rootOnlyMode} max_age_hours=${p1MaxAgeHours}`);
    
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    // 🔒 P1 FRESHNESS FILTER: For P1 proving, prefer very fresh targets (<3h default) to avoid deleted/inaccessible
    // But don't filter too strictly - if no fresh ones exist, widen to 6h, then 24h
    const p1MaxAgeMs = p1MaxAgeHours * 60 * 60 * 1000;
    const p1CutoffTime = new Date(Date.now() - p1MaxAgeMs).toISOString();
    
    // 🔧 FIX: Use COALESCE(tweet_posted_at, created_at) for freshness filtering
    // Query all root opportunities first, then filter in memory to handle NULL tweet_posted_at
    // 🎯 P1: Filter out forbidden/login_wall/deleted opportunities upstream
    let { data: rootOpps } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, target_username, target_tweet_content, tweet_posted_at, created_at, like_count, reply_count, retweet_count, is_root_tweet, target_in_reply_to_tweet_id, accessibility_status, discovery_source, target_followers, account_size_tier')
      .eq('replied_to', false)
      .or('is_root_tweet.eq.true,target_in_reply_to_tweet_id.is.null') // 🔧 FIX: Use OR condition for root detection
      .or('accessibility_status.is.null,accessibility_status.eq.unknown,accessibility_status.eq.ok') // 🎯 P1: Exclude forbidden/login_wall/deleted
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false }) // Order by created_at (always present)
      .limit(200); // Get more to filter in memory
    
    // Filter in memory using COALESCE logic
    if (rootOpps && rootOpps.length > 0) {
      const tweetPostedAtNullCount = rootOpps.filter(o => o.tweet_posted_at === null).length;
      console.log(`[ROOT_EVAL] opps_selected=${rootOpps.length} tweet_posted_at_null_count=${tweetPostedAtNullCount}`);
      
      // Filter by freshness using COALESCE(tweet_posted_at, created_at)
      // 🔧 FIX: Use created_at for freshness if tweet_posted_at is very old (harvester may have old tweet_posted_at)
      const beforeFilter = rootOpps.length;
      rootOpps = rootOpps.filter(opp => {
        const effectiveTime = opp.tweet_posted_at || opp.created_at;
        const effectiveTimeMs = new Date(effectiveTime).getTime();
        const cutoffMs = new Date(p1CutoffTime).getTime();
        
        // Also check if created_at is fresh (opportunity was just harvested)
        const createdMs = new Date(opp.created_at).getTime();
        const createdFresh = createdMs >= cutoffMs;
        
        // Include if either tweet_posted_at OR created_at is fresh
        return effectiveTimeMs >= cutoffMs || createdFresh;
      });
      
      // Sort by effective time (newest first), prefer created_at if tweet_posted_at is very old
      rootOpps.sort((a, b) => {
        // Use created_at if tweet_posted_at is >24h old (likely stale)
        const timeA = (() => {
          const tweetTime = a.tweet_posted_at ? new Date(a.tweet_posted_at).getTime() : 0;
          const createdTime = new Date(a.created_at).getTime();
          const tweetAge = Date.now() - tweetTime;
          return tweetAge > 24 * 60 * 60 * 1000 ? createdTime : Math.max(tweetTime, createdTime);
        })();
        const timeB = (() => {
          const tweetTime = b.tweet_posted_at ? new Date(b.tweet_posted_at).getTime() : 0;
          const createdTime = new Date(b.created_at).getTime();
          const tweetAge = Date.now() - tweetTime;
          return tweetAge > 24 * 60 * 60 * 1000 ? createdTime : Math.max(tweetTime, createdTime);
        })();
        return timeB - timeA;
      });
      
      rootOpps = rootOpps.slice(0, 100); // Limit to 100
      
      console.log(`[ROOT_EVAL] After freshness filter (<${p1MaxAgeHours}h): ${rootOpps.length} opportunities (filtered ${beforeFilter - rootOpps.length})`);
    } else {
      console.log(`[ROOT_EVAL] No root opportunities found in initial query`);
    }
    
    // If no fresh opportunities, fallback to 6h window (for P1 proving, we need some candidates)
    if (!rootOpps || rootOpps.length === 0 && p1MaxAgeHours < 6) {
      console.log(`[ROOT_EVAL] No fresh opportunities (<${p1MaxAgeHours}h), falling back to 6h window...`);
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: fallback6hOpps } = await supabase
        .from('reply_opportunities')
        .select('target_tweet_id, target_username, target_tweet_content, tweet_posted_at, created_at, like_count, reply_count, retweet_count, is_root_tweet, target_in_reply_to_tweet_id, accessibility_status, discovery_source, target_followers, account_size_tier')
        .eq('replied_to', false)
        .or('is_root_tweet.eq.true,target_in_reply_to_tweet_id.is.null')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (fallback6hOpps && fallback6hOpps.length > 0) {
        // Filter in memory using COALESCE logic
        rootOpps = fallback6hOpps.filter(opp => {
          const effectiveTime = opp.tweet_posted_at || opp.created_at;
          return effectiveTime >= sixHoursAgo;
        });
        rootOpps.sort((a, b) => {
          const timeA = new Date(a.tweet_posted_at || a.created_at).getTime();
          const timeB = new Date(b.tweet_posted_at || b.created_at).getTime();
          return timeB - timeA;
        });
        rootOpps = rootOpps.slice(0, 75);
        console.log(`[ROOT_EVAL] Fallback 6h: ${rootOpps.length} opportunities`);
      }
    }
    
    // If still no opportunities, fallback to 24h window
    if (!rootOpps || rootOpps.length === 0) {
      console.log(`[ROOT_EVAL] No opportunities (<6h), falling back to 24h window...`);
      const { data: fallback24hOpps } = await supabase
        .from('reply_opportunities')
        .select('target_tweet_id, target_username, target_tweet_content, tweet_posted_at, created_at, like_count, reply_count, retweet_count, is_root_tweet, target_in_reply_to_tweet_id, accessibility_status, discovery_source, target_followers, account_size_tier')
        .eq('replied_to', false)
        .or('is_root_tweet.eq.true,target_in_reply_to_tweet_id.is.null')
        .gte('created_at', twentyFourHoursAgo)
        .order('created_at', { ascending: false })
        .limit(50); // Smaller limit for fallback
      rootOpps = fallback24hOpps;
      console.log(`[ROOT_EVAL] Fallback 24h: ${rootOpps?.length || 0} opportunities`);
    }

    // 🎯 FRESHNESS BUCKETS: Log root opportunity counts by tweet age
    if (rootOpps && rootOpps.length > 0) {
      const nowMs = Date.now();
      const bucket30m = rootOpps.filter(o => {
        const t = o.tweet_posted_at || o.created_at;
        return t && (nowMs - new Date(t).getTime()) <= 30 * 60 * 1000;
      }).length;
      const bucket60m = rootOpps.filter(o => {
        const t = o.tweet_posted_at || o.created_at;
        return t && (nowMs - new Date(t).getTime()) <= 60 * 60 * 1000;
      }).length;
      const bucket3h = rootOpps.filter(o => {
        const t = o.tweet_posted_at || o.created_at;
        return t && (nowMs - new Date(t).getTime()) <= 3 * 60 * 60 * 1000;
      }).length;
      const bucket6h = rootOpps.filter(o => {
        const t = o.tweet_posted_at || o.created_at;
        return t && (nowMs - new Date(t).getTime()) <= 6 * 60 * 60 * 1000;
      }).length;
      const bucket24h = rootOpps.filter(o => {
        const t = o.tweet_posted_at || o.created_at;
        return t && (nowMs - new Date(t).getTime()) <= 24 * 60 * 60 * 1000;
      }).length;
      console.log(`[QUEUE_MANAGER] freshness_buckets root_opps <30m=${bucket30m} <60m=${bucket60m} <3h=${bucket3h} >3h=${rootOpps.length - bucket3h} >6h=${rootOpps.length - bucket6h} >24h=${rootOpps.length - bucket24h}`);
    } else {
      console.log(`[QUEUE_MANAGER] freshness_buckets root_opps=0 (no opportunities in reply_opportunities)`);
    }

    // Get all evaluated tweet IDs
    const { data: evaluatedIds } = await supabase
      .from('candidate_evaluations')
      .select('candidate_tweet_id')
      .limit(10000);
    
    const evaluatedSet = new Set((evaluatedIds || []).map(e => e.candidate_tweet_id));
    
    // Filter to only unevaluated opportunities
    const unevaluatedRootOpps = (rootOpps || []).filter(opp => !evaluatedSet.has(opp.target_tweet_id)).slice(0, 50); // Limit to 50 at a time
    
    if (unevaluatedRootOpps && unevaluatedRootOpps.length > 0) {
      console.log(`[ROOT_EVAL] 🔗 Evaluating ${unevaluatedRootOpps.length} root opportunities without evaluations...`);
      
      const { scoreCandidate } = await import('./candidateScorer');
      let evaluatedCount = 0;
      let skippedCount = 0;
      
      for (const opp of unevaluatedRootOpps) {
        try {
          // Check if evaluation already exists (race condition protection)
          const { data: existing } = await supabase
            .from('candidate_evaluations')
            .select('candidate_tweet_id')
            .eq('candidate_tweet_id', opp.target_tweet_id)
            .maybeSingle();
          
          if (existing) {
            skippedCount++;
            console.log(`[ROOT_EVAL] skipped — evaluation already exists ${opp.target_tweet_id}`);
            continue;
          }
          
          // Score the opportunity
          // 🔧 FIX: Use COALESCE(tweet_posted_at, created_at) for scoring
          const effectivePostedAt = opp.tweet_posted_at || opp.created_at || new Date().toISOString();
          
          // Set DISCOVERY_SOURCE env var for P1 manual bypass detection
          const originalDiscoverySource = process.env.DISCOVERY_SOURCE;
          if (opp.discovery_source === 'public_search_manual') {
            process.env.DISCOVERY_SOURCE = 'public_search_manual';
          }
          
          let score: Awaited<ReturnType<typeof scoreCandidate>> | null = null;
          try {
            score = await scoreCandidate(
              opp.target_tweet_id,
              opp.target_username || 'unknown',
              opp.target_tweet_content || '',
              effectivePostedAt,
              opp.like_count || 0,
              opp.reply_count || 0,
              opp.retweet_count || 0,
              `root_opp_bridge_${Date.now()}`,
              opp.target_followers ?? undefined,
              opp
            );
          } catch (scoreErr: any) {
            console.error(`[ROOT_EVAL] ⚠️ scoreCandidate threw for ${opp.target_tweet_id}: ${scoreErr?.message ?? scoreErr}`);
            if (originalDiscoverySource !== undefined) process.env.DISCOVERY_SOURCE = originalDiscoverySource;
            else delete process.env.DISCOVERY_SOURCE;
            continue;
          }
          if (!score) {
            console.warn(`[ROOT_EVAL] ⚠️ scoreCandidate returned empty for ${opp.target_tweet_id}, skipping`);
            if (originalDiscoverySource !== undefined) process.env.DISCOVERY_SOURCE = originalDiscoverySource;
            else delete process.env.DISCOVERY_SOURCE;
            continue;
          }
          
          // Restore original env var
          if (originalDiscoverySource !== undefined) {
            process.env.DISCOVERY_SOURCE = originalDiscoverySource;
          } else {
            delete process.env.DISCOVERY_SOURCE;
          }
          
          // Insert evaluation with idempotency (opportunity_upside_score, health_angle_fit_score for learning)
          const { error: insertError } = await supabase
            .from('candidate_evaluations')
            .insert({
              candidate_tweet_id: opp.target_tweet_id,
              candidate_author_username: opp.target_username || 'unknown',
              candidate_content: opp.target_tweet_content || '',
              candidate_posted_at: effectivePostedAt,
              source_id: null, // No candidate_source for opportunities
              source_type: 'reply_opportunity',
              source_feed_name: 'root_opportunity_bridge',
              feed_run_id: `root_opp_bridge_${Date.now()}`,
              is_root_tweet: score.is_root_tweet,
              is_parody: score.is_parody,
              topic_relevance_score: score.topic_relevance_score,
              spam_score: score.spam_score,
              velocity_score: score.velocity_score,
              recency_score: score.recency_score,
              author_signal_score: score.author_signal_score,
              overall_score: score.overall_score,
              opportunity_upside_score: score.opportunity_upside_score,
              health_angle_fit_score: score.health_angle_fit_score,
              passed_hard_filters: score.passed_hard_filters,
              filter_reason: score.filter_reason,
              predicted_24h_views: score.predicted_24h_views,
              predicted_tier: score.predicted_tier,
              status: score.passed_hard_filters ? 'evaluated' : 'blocked',
              ai_judge_decision: score.judge_decision ? {
                relevance: score.judge_decision.relevance,
                replyability: score.judge_decision.replyability,
                momentum: score.judge_decision.momentum,
                audience_fit: score.judge_decision.audience_fit,
                spam_risk: score.judge_decision.spam_risk,
                expected_views_bucket: score.judge_decision.expected_views_bucket,
                topic_category: score.judge_decision.topic_category,
                decision: score.judge_decision.decision,
                reasons: score.judge_decision.reasons
              } : null,
              judge_relevance: score.judge_decision?.relevance,
              judge_replyability: score.judge_decision?.replyability,
            })
            .select('candidate_tweet_id')
            .maybeSingle();
          
          if (insertError) {
            // Check if it's a duplicate/unique constraint error (idempotency)
            if (insertError.message.includes('duplicate') || insertError.message.includes('unique') || insertError.code === '23505') {
              skippedCount++;
              console.log(`[ROOT_EVAL] skipped — evaluation already exists ${opp.target_tweet_id} (race condition)`);
            } else if (insertError.message?.includes('health_angle_fit_score') || insertError.message?.includes('opportunity_upside_score') || insertError.message?.includes('schema cache') || insertError.message?.includes('does not exist')) {
              // Schema missing phase1 columns: retry without them (run migration 20260319000000 to fix)
              const { error: retryErr } = await supabase.from('candidate_evaluations').insert({
                candidate_tweet_id: opp.target_tweet_id,
                candidate_author_username: opp.target_username || 'unknown',
                candidate_content: opp.target_tweet_content || '',
                candidate_posted_at: effectivePostedAt,
                source_id: null,
                source_type: 'reply_opportunity',
                source_feed_name: 'root_opportunity_bridge',
                feed_run_id: `root_opp_bridge_${Date.now()}`,
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
                ai_judge_decision: score.judge_decision ? { relevance: score.judge_decision.relevance, replyability: score.judge_decision.replyability, momentum: score.judge_decision.momentum, audience_fit: score.judge_decision.audience_fit, spam_risk: score.judge_decision.spam_risk, expected_views_bucket: score.judge_decision.expected_views_bucket, decision: score.judge_decision.decision, reasons: score.judge_decision.reasons } : null,
                judge_relevance: score.judge_decision?.relevance,
                judge_replyability: score.judge_decision?.replyability,
              }).select('candidate_tweet_id').maybeSingle();
              if (retryErr) {
                console.error(`[ROOT_EVAL] ⚠️ Failed to create evaluation for ${opp.target_tweet_id} (fallback): ${retryErr.message}`);
              } else {
                evaluatedCount++;
                console.log(`[ROOT_EVAL] created candidate_evaluation for root opportunity ${opp.target_tweet_id} (passed=${score.passed_hard_filters}, schema fallback)`);
              }
            } else {
              console.error(`[ROOT_EVAL] ⚠️ Failed to create evaluation for ${opp.target_tweet_id}: ${insertError.message}`);
            }
          } else {
            evaluatedCount++;
            console.log(`[ROOT_EVAL] created candidate_evaluation for root opportunity ${opp.target_tweet_id} (passed=${score.passed_hard_filters} tier=${score.predicted_tier})`);
          }
        } catch (evalError: any) {
          console.error(`[ROOT_EVAL] ⚠️ Error evaluating ${opp.target_tweet_id}: ${evalError.message}`);
        }
      }
      
      console.log(`[ROOT_EVAL] ✅ Bridge complete: evaluated=${evaluatedCount} skipped=${skippedCount} total=${unevaluatedRootOpps.length}`);
      
      // If we created new evaluations, re-query topCandidates to include them
      if (evaluatedCount > 0) {
        const { data: refreshedCandidates } = await query.limit(shortlistSize * 2);
        if (refreshedCandidates && refreshedCandidates.length > topCandidates.length) {
          topCandidates.length = 0;
          topCandidates.push(...refreshedCandidates);
          console.log(`[QUEUE_MANAGER] 📊 Refreshed candidates after bridge: ${topCandidates.length} total`);
        }
      }
    }
  }
  
  if (rootOnlyMode && topCandidates.length > 0) {
    const candidateTweetIds = topCandidates.map(c => c.candidate_tweet_id);
    
    // Join with reply_opportunities to filter to root tweets only
    // 🔗 BRIDGE FIX: Don't filter opportunities by age - if evaluation exists, opportunity should exist
    const { data: rootOpportunities } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, is_root_tweet, target_in_reply_to_tweet_id')
      .in('target_tweet_id', candidateTweetIds)
      .eq('replied_to', false); // Only unclaimed opportunities
    
    const rootTweetIds = new Set<string>();
    if (rootOpportunities) {
      for (const opp of rootOpportunities) {
        // Consider root if: is_root_tweet=true OR target_in_reply_to_tweet_id is null
        const isRoot = opp.is_root_tweet === true ||
                       (opp.is_root_tweet !== false && opp.target_in_reply_to_tweet_id === null);
        if (isRoot) {
          rootTweetIds.add(opp.target_tweet_id);
        }
      }
    }
    // 🔗 BRIDGE: Passed candidates from orchestrator (feeds) exist only in candidate_evaluations, not reply_opportunities.
    // Treat evaluations with is_root_tweet=true as root so they can be queued and scheduled.
    for (const c of topCandidates) {
      if (c.is_root_tweet === true && !rootTweetIds.has(c.candidate_tweet_id)) {
        rootTweetIds.add(c.candidate_tweet_id);
      }
    }

    const beforeCount = topCandidates.length;
    const filteredCandidates = topCandidates.filter(c => rootTweetIds.has(c.candidate_tweet_id));
    const filteredOutCount = beforeCount - filteredCandidates.length;

    if (filteredOutCount > 0 || rootOpportunities?.length === 0) {
      console.log(`[QUEUE_MANAGER][ROOT_ONLY] Filtered during refresh: kept_roots=${filteredCandidates.length} filtered_out=${filteredOutCount} opportunities_found=${rootOpportunities?.length || 0}`);

      if (rootOpportunities?.length === 0 && filteredCandidates.length > 0) {
        console.log(`[QUEUE_MANAGER][ROOT_ONLY] ✅ Using evaluation-only roots (no reply_opportunities rows) for queue`);
      }
    }
    rejectedNonRoot = filteredOutCount;
    
    // Replace topCandidates with filtered list
    topCandidates.length = 0;
    topCandidates.push(...filteredCandidates);
    
    if (topCandidates.length === 0) {
      console.log(`[QUEUE_MANAGER] ⚠️ No root candidates available after ROOT_ONLY filter`);
      return { evaluated: beforeCount, queued: 0, expired: expiredCount, summary: { root_confirmed: 0, rejected_non_root: rejectedNonRoot, rejected_freshness: 0, rejected_judge: 0, queued: 0, top_scores: [], sample_rejects: ['non_root'] } };
    }
    rootConfirmedForSummary = topCandidates.length;
  }
  
  // 🔒 STEP 2.5: Filter out candidates that are known to be inaccessible
  // Check recent runtime preflight results for inaccessible/deleted status
  const candidateTweetIds = topCandidates.map(c => c.candidate_tweet_id);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentPreflights } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('target_tweet_id, features')
    .in('target_tweet_id', candidateTweetIds)
    .gte('updated_at', oneHourAgo)
    .eq('decision_type', 'reply');
  
  const inaccessibleTweetIds = new Set<string>();
  if (recentPreflights) {
    recentPreflights.forEach((preflight: any) => {
      const features = preflight.features || {};
      const status = features.runtime_preflight_status;
      if (status === 'inaccessible' || status === 'deleted') {
        inaccessibleTweetIds.add(preflight.target_tweet_id);
      }
    });
  }
  
  if (inaccessibleTweetIds.size > 0) {
    console.log(`[QUEUE_MANAGER] 🔒 Filtering out ${inaccessibleTweetIds.size} inaccessible/deleted candidates`);
    const filteredCandidates = topCandidates.filter(c => !inaccessibleTweetIds.has(c.candidate_tweet_id));
    if (filteredCandidates.length < topCandidates.length) {
      console.log(`[QUEUE_MANAGER] 📊 After filtering: ${filteredCandidates.length} accessible candidates (removed ${topCandidates.length - filteredCandidates.length})`);
      // Replace topCandidates with filtered list
      topCandidates.length = 0;
      topCandidates.push(...filteredCandidates);
    }
  }

  // 🎯 CONTROLLED_LIVE: Stricter gates (env-driven, default-safe)
  let rejectedControlledLive = 0;
  const controlledLiveRejectSamples: string[] = [];
  if (REPLY_CONTROLLED_LIVE && topCandidates.length > 0) {
    const oppTweetIds = topCandidates.map(c => c.candidate_tweet_id);
    const { data: oppsForLive } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, like_count, reply_count, retweet_count, target_followers')
      .in('target_tweet_id', oppTweetIds);
    const oppMap = new Map<string, { like_count: number; reply_count: number; retweet_count: number; target_followers: number | null }>();
    (oppsForLive || []).forEach((o: any) => {
      oppMap.set(o.target_tweet_id, {
        like_count: o.like_count ?? 0,
        reply_count: o.reply_count ?? 0,
        retweet_count: o.retweet_count ?? 0,
        target_followers: o.target_followers ?? null,
      });
    });
    const minEngagement = parseInt(process.env.REPLY_CONTROLLED_LIVE_MIN_ENGAGEMENT || '1', 10);
    const requireFollowers = process.env.REPLY_CONTROLLED_LIVE_REQUIRE_FOLLOWERS !== 'false';
    const minHealthAngleFit = parseFloat(process.env.REPLY_CONTROLLED_LIVE_MIN_HEALTH_ANGLE_FIT || '0.4');
    const beforeLive = topCandidates.length;
    topCandidates = topCandidates.filter(c => {
      const opp = oppMap.get(c.candidate_tweet_id);
      const engagement = opp ? (opp.like_count + opp.reply_count + opp.retweet_count) : 0;
      if (engagement < minEngagement) {
        rejectedControlledLive++;
        if (controlledLiveRejectSamples.length < 2) controlledLiveRejectSamples.push(`${c.candidate_tweet_id}:low_engagement(${engagement})`);
        return false;
      }
      if (requireFollowers) {
        const hasFollowers = opp != null && opp.target_followers != null && opp.target_followers >= 0;
        if (!hasFollowers) {
          rejectedControlledLive++;
          if (controlledLiveRejectSamples.length < 2) controlledLiveRejectSamples.push(`${c.candidate_tweet_id}:missing_target_followers`);
          return false;
        }
      }
      const healthFit = (c as any).health_angle_fit_score;
      if (healthFit != null && typeof healthFit === 'number' && healthFit < minHealthAngleFit) {
        rejectedControlledLive++;
        if (controlledLiveRejectSamples.length < 2) controlledLiveRejectSamples.push(`${c.candidate_tweet_id}:low_health_angle_fit(${healthFit})`);
        return false;
      }
      return true;
    });
    if (rejectedControlledLive > 0) {
      console.log(`[QUEUE_MANAGER] 🎯 CONTROLLED_LIVE: filtered ${beforeLive - topCandidates.length} (min_engagement=${minEngagement} require_followers=${requireFollowers} min_health_angle_fit=${minHealthAngleFit})`);
    }
  }
  
  // Step 3: Check which are already in queue (non-expired)
  const { data: existingQueue } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString()); // Only count non-expired entries
  
  const existingIds = new Set(existingQueue?.map(q => q.candidate_tweet_id) || []);
  
  // Step 4: Add new candidates to queue (filter synthetic/missing metadata)
  let queuedCount = 0;
  let rejectedSynthetic = 0;
  let rejectedMissingMetadata = 0;
  let rejectedAlreadyQueued = 0;
  let rejectedStaleTweet = 0;
  let rejectedLiveQuality = 0;
  const liveQualityRejectedSamples: Array<{ tweet_id: string; overall_score: number; predicted_tier: number; reason: string }> = [];
  const missingMetadataFields: Record<string, number> = {};
  const now = new Date();
  const diagnosticSamples: Array<{ tweet_id: string; evaluation_id: string; created_at: string; reason: string }> = [];
  const queuedScores: number[] = [];

  // Live quality gates (optional env): prefer stronger candidates for controlled live
  // When REPLY_CONTROLLED_LIVE=true, default min score 0.45 unless REPLY_LIVE_MIN_OVERALL_SCORE set
  const liveMinScore = parseInt(process.env.REPLY_LIVE_MIN_OVERALL_SCORE || (REPLY_CONTROLLED_LIVE ? '0.45' : '0'), 10);
  const liveMaxTier = parseInt(process.env.REPLY_LIVE_MAX_TIER || '3', 10);

  for (const candidate of topCandidates) {
    // Track if already in queue
    if (existingIds.has(candidate.candidate_tweet_id)) {
      rejectedAlreadyQueued++;
      if (diagnosticSamples.length < 3 && runStartedAt && candidate.created_at >= runStartedAt) {
        diagnosticSamples.push({
          tweet_id: candidate.candidate_tweet_id || 'unknown',
          evaluation_id: candidate.id || 'unknown',
          created_at: candidate.created_at || 'unknown',
          reason: 'already_queued'
        });
      }
      continue;
    }
    
    // Skip if we have enough
    if (queuedCount >= shortlistSize) {
      break;
    }
    
    // FILTER: Reject synthetic and consent-wall placeholder IDs
    const tweetId = candidate.candidate_tweet_id || '';
    if (/^2000000000000000\d{3}$/.test(tweetId) || tweetId.startsWith('consent_wall_')) {
      rejectedSynthetic++;
      console.log(`[REPLY_CANDIDATE] tweet_id=${tweetId} target_username=${candidate.candidate_author_username ?? 'n/a'} passed=false rejection_reason=synthetic_or_consent_wall rejection_stage=rejected_by_queue_limits`);
      if (tweetId.startsWith('consent_wall_')) {
        console.log(`[QUEUE_MANAGER] 🚫 Rejected consent_wall_ placeholder: ${tweetId}`);
      } else {
        console.log(`[QUEUE_MANAGER] 🚫 Rejected synthetic candidate: ${tweetId}`);
      }
      continue;
    }
    
    // FILTER: Reject missing required metadata
    const authorUsername = candidate.candidate_author_username || null;
    const content = candidate.candidate_content || null;
    if (!tweetId || !authorUsername || !content) {
      rejectedMissingMetadata++;
      if (!tweetId) missingMetadataFields['candidate_tweet_id'] = (missingMetadataFields['candidate_tweet_id'] || 0) + 1;
      if (!authorUsername) missingMetadataFields['candidate_author_username'] = (missingMetadataFields['candidate_author_username'] || 0) + 1;
      if (!content) missingMetadataFields['candidate_content'] = (missingMetadataFields['candidate_content'] || 0) + 1;
      console.log(`[REPLY_CANDIDATE] tweet_id=${tweetId} target_username=${authorUsername ?? 'n/a'} passed=false rejection_reason=missing_metadata rejection_stage=rejected_by_missing_metadata`);
      console.log(`[QUEUE_MANAGER] 🚫 Rejected missing metadata: ${tweetId} (missing: ${Object.keys(missingMetadataFields).join(', ')})`);
      continue;
    }

    // Calculate tweet age and TTL
    const postedTime = new Date(candidate.candidate_posted_at || now).getTime();
    const ageMinutes = (now.getTime() - postedTime) / (1000 * 60);

    // 🎯 STALE FIX: Don't queue tweets older than MAX_TWEET_AGE_MINUTES (default 6h)
    if (ageMinutes > MAX_TWEET_AGE_MINUTES) {
      rejectedStaleTweet++;
      console.log(`[REPLY_CANDIDATE] tweet_id=${tweetId} target_username=${authorUsername} passed=false rejection_reason=stale_tweet_age_${ageMinutes.toFixed(0)}m rejection_stage=rejected_by_queue_limits`);
      continue;
    }

    // Live quality: minimum overall_score and max predicted_tier (when env set)
    if (liveMinScore > 0 && (candidate.overall_score ?? 0) < liveMinScore) {
      rejectedLiveQuality++;
      if (liveQualityRejectedSamples.length < 2) {
        liveQualityRejectedSamples.push({
          tweet_id: tweetId,
          overall_score: candidate.overall_score ?? 0,
          predicted_tier: candidate.predicted_tier ?? 4,
          reason: 'score_below_min'
        });
      }
      continue;
    }
    const tier = candidate.predicted_tier ?? 4;
    if (tier > liveMaxTier) {
      rejectedLiveQuality++;
      if (liveQualityRejectedSamples.length < 2) {
        liveQualityRejectedSamples.push({
          tweet_id: tweetId,
          overall_score: candidate.overall_score ?? 0,
          predicted_tier: tier,
          reason: 'tier_above_max'
        });
      }
      continue;
    }

    const ttlMinutes = calculateTTL(ageMinutes, candidate.velocity_score || 0);
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    
    // Insert into queue (use ON CONFLICT DO NOTHING to handle duplicates gracefully)
    const { error } = await supabase
      .from('reply_candidate_queue')
      .insert({
        evaluation_id: candidate.id,
        candidate_tweet_id: candidate.candidate_tweet_id,
        overall_score: candidate.overall_score || 0,
        predicted_tier: candidate.predicted_tier || 4,
        predicted_24h_views: candidate.predicted_24h_views || 0,
        source_type: candidate.source_type,
        source_feed_name: candidate.source_feed_name,
        expires_at: expiresAt.toISOString(),
        ttl_minutes: ttlMinutes,
        status: 'queued',
      });
    
    if (error) {
      // Check if it's a duplicate/unique constraint error (already queued)
      if (error.message.includes('duplicate') || error.message.includes('unique') || error.code === '23505') {
        rejectedAlreadyQueued++;
        if (diagnosticSamples.length < 3 && runStartedAt && candidate.created_at >= runStartedAt) {
          diagnosticSamples.push({
            tweet_id: candidate.candidate_tweet_id || 'unknown',
            evaluation_id: candidate.id || 'unknown',
            created_at: candidate.created_at || 'unknown',
            reason: 'duplicate_insert'
          });
        }
      } else {
        console.error(`[QUEUE_MANAGER] ⚠️ Failed to queue ${candidate.candidate_tweet_id}: ${error.message}`);
      }
      continue;
    }
    
    // Update evaluation status
    await supabase
      .from('candidate_evaluations')
      .update({ status: 'queued', queued_at: now.toISOString() })
      .eq('id', candidate.id);
    
    queuedCount++;
    if (queuedScores.length < 5) queuedScores.push(candidate.overall_score ?? 0);
    existingIds.add(candidate.candidate_tweet_id);
  }
  
  // Check for fresh evaluations that weren't queued (diagnostics)
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  if (queuedCount === 0 && (runStartedAt || topCandidates.length > 0)) {
    const { data: freshEvaluations } = await supabase
      .from('candidate_evaluations')
      .select('id, candidate_tweet_id, created_at, status, passed_hard_filters, predicted_tier')
      .eq('passed_hard_filters', true)
      .lte('predicted_tier', 3)
      .gte('created_at', runStartedAt || thirtyMinutesAgo)
      .in('status', ['evaluated', 'queued'])
      .limit(5);
    
    if (freshEvaluations && freshEvaluations.length > 0) {
      console.log(`[QUEUE_MANAGER] ⚠️  Queued: 0 but ${freshEvaluations.length} fresh evaluation(s) exist`);
      console.log(`   Diagnostic samples (why they weren't queued):`);
      for (const evaluation of freshEvaluations.slice(0, 3)) {
        const wasInExisting = existingIds.has(evaluation.candidate_tweet_id || '');
        const reason = wasInExisting ? 'already_queued' : 
                      (!evaluation.candidate_tweet_id) ? 'missing_tweet_id' :
                      evaluation.predicted_tier && evaluation.predicted_tier > 3 ? 'tier_too_high' :
                      !evaluation.passed_hard_filters ? 'failed_hard_filters' :
                      'unknown';
        console.log(`      ${evaluation.candidate_tweet_id || 'unknown'} (eval_id=${evaluation.id}, created=${evaluation.created_at}, reason=${reason})`);
      }
    }
  }
  
  // 🔍 DIAGNOSTICS: Log detailed breakdown
  const rootOnlyKept = rootOnlyMode ? queuedCount : topCandidates.length;
  const eligibleEvals = topCandidates.filter(c => c.passed_hard_filters && c.predicted_tier <= 3).length;
  
  console.log(`[QUEUE_MANAGER] 📊 Queue refresh stats:`);
  console.log(`   candidates_considered=${topCandidates.length}`);
  console.log(`   root_only_kept=${rootOnlyKept}`);
  console.log(`   eligible_evals (passed+tier<=3)=${eligibleEvals}`);
  console.log(`   queued_count=${queuedCount}`);
  console.log(`   evaluated=${topCandidates.length} expired=${expiredCount}`);
  console.log(`   Rejected synthetic: ${rejectedSynthetic}`);
  console.log(`   Rejected stale tweet (age>${MAX_TWEET_AGE_MINUTES}m): ${rejectedStaleTweet}`);
  console.log(`   Rejected missing metadata: ${rejectedMissingMetadata}`);
  console.log(`   Rejected already queued: ${rejectedAlreadyQueued}`);
  if (rejectedLiveQuality > 0) {
    console.log(`   Rejected live quality (min_score=${liveMinScore} max_tier=${liveMaxTier}): ${rejectedLiveQuality}`);
    for (const s of liveQualityRejectedSamples) {
      console.log(`   [LIVE_QUALITY_REJECT] sample tweet_id=${s.tweet_id} overall_score=${s.overall_score} predicted_tier=${s.predicted_tier} reason=${s.reason}`);
    }
  }
  if (Object.keys(missingMetadataFields).length > 0) {
    console.log(`   Missing fields: ${Object.entries(missingMetadataFields).map(([f, c]) => `${f}=${c}`).join(', ')}`);
  }

  const sampleRejects: string[] = [];
  if (rejectedStaleTweet > 0) sampleRejects.push(`stale:${rejectedStaleTweet}`);
  if (rejectedLiveQuality > 0) {
    liveQualityRejectedSamples.slice(0, 2).forEach(s => sampleRejects.push(`judge:${s.tweet_id}=${s.reason}`));
  }
  if (rejectedControlledLive > 0) sampleRejects.push(...controlledLiveRejectSamples);
  if (rejectedMissingMetadata > 0) sampleRejects.push(`missing_metadata:${rejectedMissingMetadata}`);
  if (rejectedNonRoot > 0) sampleRejects.push(`non_root:${rejectedNonRoot}`);

  const summary: RefreshQueueSummary = {
    root_confirmed: rootConfirmedForSummary,
    rejected_non_root: rejectedNonRoot,
    rejected_freshness: rejectedStaleTweet,
    rejected_judge: rejectedLiveQuality,
    rejected_controlled_live: rejectedControlledLive > 0 ? rejectedControlledLive : undefined,
    queued: queuedCount,
    top_scores: queuedScores.slice(0, 5),
    sample_rejects: sampleRejects.slice(0, 8),
  };
  
  return {
    evaluated: topCandidates.length,
    queued: queuedCount,
    expired: expiredCount,
    summary,
  };
  } catch (err: any) {
    console.error(`[QUEUE_MANAGER] ❌ refreshCandidateQueue error: ${err?.message ?? err}`, err?.stack?.substring?.(0, 500));
    return { ...REFRESH_QUEUE_FALLBACK, expired: expiredCount };
  }
}

/**
 * Calculate TTL based on age and velocity
 */
function calculateTTL(ageMinutes: number, velocityScore: number): number {
  // Fresh tweets get longer TTL, old tweets expire fast
  // At 0 followers, replying to old tweets is worthless — clean them out aggressively
  if (ageMinutes > 180) return 10;  // >3h old: 10 min TTL (expire fast)
  if (ageMinutes > 120) return 15;  // >2h old: 15 min TTL
  if (ageMinutes > 60) return 20;   // >1h old: 20 min TTL

  // Fresh tweets (<1h): longer TTL, velocity-adjusted
  const baseTTL = 45;
  const velocityAdjustment = velocityScore > 0.5 ? -10 : 0; // Hot tweets expire slightly faster
  const ageAdjustment = ageMinutes > 30 ? -10 : 0;

  return Math.max(15, baseTTL + velocityAdjustment + ageAdjustment);
}

/**
 * Check if lease columns exist (graceful fallback if not)
 */
async function hasLeaseColumns(): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();
    // Try to query a single row to check if columns exist
    const { error } = await supabase
      .from('reply_candidate_queue')
      .select('lease_id, leased_at, leased_until')
      .limit(1);
    
    // If error mentions missing column, lease columns don't exist
    if (error && error.message.includes('does not exist')) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Cleanup expired leases (revert to queued) - graceful fallback if columns don't exist
 */
export async function cleanupExpiredLeases(): Promise<number> {
  const supabase = getSupabaseClient();
  
  // Check if lease columns exist
  if (!(await hasLeaseColumns())) {
    // Fallback: cleanup old "selected" status candidates
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckSelected } = await supabase
      .from('reply_candidate_queue')
      .update({ status: 'queued', selected_at: null })
      .eq('status', 'selected')
      .lt('selected_at', tenMinutesAgo)
      .select();
    
    return stuckSelected?.length || 0;
  }
  
  const now = new Date().toISOString();
  
  // Release any candidates stuck in 'leased' status past their leased_until
  const { data: expiredLeases, error } = await supabase
    .from('reply_candidate_queue')
    .update({ 
      status: 'queued',
      lease_id: null,
      leased_at: null,
      leased_until: null,
      selected_at: null
    })
    .eq('status', 'leased')
    .lt('leased_until', now)
    .select();
  
  if (error) {
    console.warn(`[QUEUE_MANAGER] ⚠️ Failed to cleanup expired leases: ${error.message}`);
    return 0;
  }
  
  const cleaned = expiredLeases?.length || 0;
  if (cleaned > 0) {
    console.log(`[QUEUE_MANAGER] 🔧 Cleaned up ${cleaned} expired leases`);
  }
  
  return cleaned;
}

/**
 * Get next candidate from queue for posting with atomic lease mechanism (graceful fallback)
 */
export async function getNextCandidateFromQueue(tier?: number, deniedTweetIds?: Set<string>): Promise<{
  candidate_tweet_id: string;
  evaluation_id: string;
  predicted_tier: number;
  overall_score: number;
  id?: string; // Queue row ID for lease management
  lease_id?: string; // Lease ID for tracking
} | null> {
  const supabase = getSupabaseClient();
  
  // Cleanup expired leases first
  await cleanupExpiredLeases();
  
  // Check if lease columns exist - if not, use old behavior
  const hasLeases = await hasLeaseColumns();
  
  // Find candidate
  let query = supabase
    .from('reply_candidate_queue')
    .select('id, candidate_tweet_id, evaluation_id, predicted_tier, overall_score')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());
  
  // Only filter by lease_id if columns exist
  if (hasLeases) {
    query = query.is('lease_id', null); // Only select unleased candidates
  }
  
  const now = new Date();
  
  // 🎯 SCHEDULER_SINGLE_ID: Process exactly one candidate by tweet_id
  const singleId = process.env.SCHEDULER_SINGLE_ID;
  if (singleId) {
    query = query.eq('candidate_tweet_id', singleId);
    console.log(`[QUEUE_MANAGER] 🎯 SINGLE_ID mode: Selecting candidate ${singleId}`);
  }
  
  // 🎯 PART B: Exclude denied tweet IDs if provided
  if (deniedTweetIds && deniedTweetIds.size > 0) {
    const deniedArray = Array.from(deniedTweetIds);
    for (const deniedId of deniedArray) {
      query = query.neq('candidate_tweet_id', deniedId);
    }
  }
  
  // 🔒 STABILITY HEURISTICS: Prefer candidates from opportunities with stability_score=1.0 (5-45min window)
  // Check if opportunities have stability features
  if (tier !== undefined && !singleId) {
    // Only filter by tier if not in SINGLE_ID mode
    query = query.eq('predicted_tier', tier);
  }
  
  // 🎯 P1: Prefer public_search_* candidates when available
  const p1Mode = process.env.P1_MODE === 'true' || process.env.REPLY_V2_ROOT_ONLY === 'true';
  
  // 🎯 CANARY LANE: Prefer canary-eligible candidates (profile harvest or marked canary-eligible)
  // Get more candidates to filter by canary eligibility
  query = query
    .order('predicted_tier', { ascending: true }) // Tier 1 first
    .order('overall_score', { ascending: false }) // Then by score
    .limit(p1Mode ? 50 : 20); // Get more candidates to filter by discovery_source/canary eligibility
  
  const { data: candidates, error } = await query;
  
  // 🎯 CANARY LANE: Filter and prioritize canary-eligible candidates
  if (candidates && candidates.length > 0) {
    const candidateIds = candidates.map(c => c.candidate_tweet_id);
    
    // Check opportunities for canary eligibility markers
    const { data: opps } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, discovery_source, ancestry_status')
      .in('target_tweet_id', candidateIds);
    
    // Check drafts for canary_eligible flag
    const { data: drafts } = await supabase
      .from('content_metadata')
      .select('target_tweet_id, features')
      .in('target_tweet_id', candidateIds)
      .eq('decision_type', 'reply')
      .eq('status', 'draft');
    
    const canaryEligibleIds = new Set<string>();
    const profileHarvestIds = new Set<string>();
    
    // Mark profile harvest opportunities as canary-eligible
    (opps || []).forEach(opp => {
      if (opp.discovery_source === 'profile') {
        canaryEligibleIds.add(opp.target_tweet_id);
        profileHarvestIds.add(opp.target_tweet_id);
      }
    });
    
    // Mark drafts with canary_eligible=true as canary-eligible
    (drafts || []).forEach(draft => {
      const features = (draft.features || {}) as Record<string, any>;
      if (features.canary_eligible === true) {
        canaryEligibleIds.add(draft.target_tweet_id);
      }
    });
    
    if (canaryEligibleIds.size > 0) {
      // Separate canary-eligible from others
      const canaryCandidates = candidates.filter(c => canaryEligibleIds.has(c.candidate_tweet_id));
      const otherCandidates = candidates.filter(c => !canaryEligibleIds.has(c.candidate_tweet_id));
      
      // Prefer canary-eligible: put them first, sorted by tier/score
      const sortedCanary = canaryCandidates.sort((a, b) => {
        if (a.predicted_tier !== b.predicted_tier) return a.predicted_tier - b.predicted_tier;
        return b.overall_score - a.overall_score;
      });
      
      const sortedOthers = otherCandidates.sort((a, b) => {
        if (a.predicted_tier !== b.predicted_tier) return a.predicted_tier - b.predicted_tier;
        return b.overall_score - a.overall_score;
      });
      
      // Replace candidates array with canary-first ordering
      candidates.length = 0;
      candidates.push(...sortedCanary, ...sortedOthers);
      
      console.log(`[QUEUE_MANAGER] 🎯 CANARY_LANE: ${canaryEligibleIds.size} canary-eligible candidates prioritized (${profileHarvestIds.size} from profile harvest)`);
    }
  }
  
    // 🎯 P1 VERIFIED-ONLY FILTER: In P1 mode, ONLY select verified ok candidates
    // Exception: public_search_manual allows 'unknown' status (manually seeded, no executor verification needed)
    if (p1Mode && candidates && candidates.length > 0) {
      // Join with reply_opportunities to filter by discovery_source AND accessibility_status
      const candidateIds = candidates.map(c => c.candidate_tweet_id);
      const { data: opps } = await supabase
        .from('reply_opportunities')
        .select('target_tweet_id, discovery_source, accessibility_status')
        .in('target_tweet_id', candidateIds);
      
      // Filter: public_search_* AND (accessibility_status='ok' OR (public_search_manual AND accessibility_status='unknown'))
      const verifiedOkIds = new Set(
        (opps || [])
          .filter(opp => {
            if (!opp.discovery_source?.startsWith('public_search_')) return false;
            // Manual seeds don't need executor verification
            if (opp.discovery_source === 'public_search_manual') {
              return opp.accessibility_status === 'unknown' || opp.accessibility_status === 'ok';
            }
            // Regular public_search_* require 'ok' status
            return opp.accessibility_status === 'ok';
          })
          .map(opp => opp.target_tweet_id)
      );

    if (verifiedOkIds.size > 0) {
      const filtered = candidates.filter(c => verifiedOkIds.has(c.candidate_tweet_id));
      if (filtered.length > 0) {
        console.log(`[QUEUE_MANAGER] ✅ VERIFIED_ONLY: candidates ${candidates.length} → ${filtered.length} (ok only)`);
        candidates.length = 0;
        candidates.push(...filtered);
      } else {
        console.log(`[QUEUE_MANAGER] ✅ VERIFIED_ONLY: No verified ok candidates found (${candidates.length} candidates checked)`);
        return null;
      }
    } else {
      // 🔗 BRIDGE: Candidates in queue may be evaluation-only (no reply_opportunities row). Allow them so scheduler can try preflight.
      const idsWithOpp = new Set((opps || []).map((o: { target_tweet_id: string }) => o.target_tweet_id));
      const noOppIds = candidateIds.filter((id: string) => !idsWithOpp.has(id));
      if (noOppIds.length > 0) {
        const filtered = candidates.filter(c => noOppIds.includes(c.candidate_tweet_id));
        if (filtered.length > 0) {
          console.log(`[QUEUE_MANAGER] ✅ VERIFIED_ONLY: using ${filtered.length} evaluation-only candidates (no reply_opportunities row)`);
          candidates.length = 0;
          candidates.push(...filtered);
        } else {
          console.log(`[QUEUE_MANAGER] ✅ VERIFIED_ONLY: No verified ok candidates found (${candidates.length} candidates checked)`);
          return null;
        }
      } else {
        console.log(`[QUEUE_MANAGER] ✅ VERIFIED_ONLY: No verified ok candidates found (${candidates.length} candidates checked)`);
        return null;
      }
    }
  }
  
  if (error) {
    console.log(`[QUEUE_MANAGER] ⚠️ Query error for tier ${tier}: ${error.message} (code: ${error.code})`);
    return null;
  }
  
  if (!candidates || candidates.length === 0) {
    // Debug: Check if any candidates exist without filters
    const { count: totalCount } = await supabase
      .from('reply_candidate_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued')
      .gt('expires_at', now.toISOString());
    console.log(`[QUEUE_MANAGER] ⚠️ No candidate found for tier ${tier} (total available: ${totalCount || 0})`);
    return null;
  }
  
  // 🔒 ROOT_ONLY FILTER: Filter out reply tweets when REPLY_V2_ROOT_ONLY=true
  const rootOnlyMode = process.env.REPLY_V2_ROOT_ONLY !== 'false'; // Default true
  let filteredCandidates = candidates;
  let filteredOutCount = 0;
  
  if (rootOnlyMode && filteredCandidates.length > 0) {
    const candidateTweetIds = filteredCandidates.map(c => c.candidate_tweet_id);
    
    // 🔍 DEBUG: Log candidate IDs being checked
    console.log(`[ROOT_ONLY_DEBUG] Checking ${candidateTweetIds.length} candidates for root status`);
    if (candidateTweetIds.length > 0) {
      console.log(`[ROOT_ONLY_DEBUG] Sample candidate_id=${candidateTweetIds[0]}`);
    }
    
    // Join with reply_opportunities to check is_root_tweet
    const { data: opportunities } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, is_root_tweet, target_in_reply_to_tweet_id')
      .in('target_tweet_id', candidateTweetIds);
    
    // 🔍 DEBUG: Log join results
    const joinFound = opportunities ? opportunities.length : 0;
    console.log(`[ROOT_ONLY_DEBUG] join_found=${joinFound} candidates_checked=${candidateTweetIds.length}`);
    if (opportunities && opportunities.length > 0) {
      console.log(`[ROOT_ONLY_DEBUG] Sample joined: target_tweet_id=${opportunities[0].target_tweet_id} is_root_tweet=${opportunities[0].is_root_tweet}`);
    } else if (candidateTweetIds.length > 0) {
      console.log(`[ROOT_ONLY_DEBUG] ⚠️ NO OPPORTUNITIES FOUND for candidates - checking candidate_evaluations as fallback`);
      
      // 🔒 FALLBACK: If reply_opportunities doesn't have these candidates, check candidate_evaluations
      // This happens when candidates come from evaluations but opportunities weren't created
      // For ROOT_ONLY mode, we need to ensure candidates come from root opportunities
      // Since we can't determine root status from evaluations alone, we'll need to either:
      // 1. Skip filtering (not safe) OR
      // 2. Only allow candidates that exist in reply_opportunities (current behavior)
      // For now, log the mismatch and filter out candidates without opportunities
    }
    
    const rootTweetIds = new Set<string>();
    if (opportunities) {
      for (const opp of opportunities) {
        const isRoot = opp.is_root_tweet === true ||
                       (opp.is_root_tweet !== false && opp.target_in_reply_to_tweet_id === null);
        if (isRoot) {
          rootTweetIds.add(opp.target_tweet_id);
          console.log(`[ROOT_ONLY_DEBUG] candidate_id=${opp.target_tweet_id} is_root=true`);
        } else {
          console.log(`[ROOT_ONLY_DEBUG] candidate_id=${opp.target_tweet_id} is_root=false (is_root_tweet=${opp.is_root_tweet} in_reply_to=${opp.target_in_reply_to_tweet_id})`);
        }
      }
    }

    // 🔗 BRIDGE: Queue was already root-filtered at refresh (including evaluation-only roots). If join found no rows, keep all.
    if (joinFound === 0 && filteredCandidates.length > 0) {
      console.log(`[ROOT_ONLY_DEBUG] ✅ No reply_opportunities rows for ${filteredCandidates.length} candidates - using queue as-is (already root-filtered at refresh)`);
    } else {
      const beforeCount = filteredCandidates.length;
      filteredCandidates = filteredCandidates.filter(c => rootTweetIds.has(c.candidate_tweet_id));
      filteredOutCount = beforeCount - filteredCandidates.length;
      if (filteredOutCount > 0 || joinFound === 0) {
        console.log(`[ROOT_ONLY] filtered_out_replies=${filteredOutCount} kept_roots=${filteredCandidates.length} total_checked=${beforeCount} join_found=${joinFound}`);
      }
    }

    if (filteredCandidates.length === 0) {
      const rootOnlyMsg = ` (root_only filtered out ${filteredOutCount}, join_found=${joinFound})`;
      console.log(`[QUEUE_MANAGER] ⚠️ No root candidates found for tier ${tier}${rootOnlyMsg}`);
      if (joinFound === 0) {
        console.log(`[ROOT_ONLY_DEBUG] ⚠️ Candidates in queue don't exist in reply_opportunities - queue may need refresh from root opportunities`);
      }
      return null;
    }
  }
  
  // 🔒 TARGET STABILITY HEURISTICS + OPP INTELLIGENCE: Fetch full opp + evaluation scores for Phase 1
  const candidateTweetIds = filteredCandidates.map(c => c.candidate_tweet_id);
  const evaluationIds = filteredCandidates.map(c => c.evaluation_id).filter(Boolean);
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, features, tweet_posted_at, created_at, discovery_source, like_count, reply_count, retweet_count, target_followers, account_size_tier, is_root_tweet, target_in_reply_to_tweet_id')
    .in('target_tweet_id', candidateTweetIds);

  const { data: evals } = evaluationIds.length > 0
    ? await supabase
        .from('candidate_evaluations')
        .select('id, candidate_tweet_id, opportunity_upside_score, health_angle_fit_score')
        .in('id', evaluationIds)
    : { data: null };
  const evalMap = new Map<string, { opportunity_upside_score?: number | null; health_angle_fit_score?: number | null }>();
  if (evals) {
    for (const e of evals as { id: string; candidate_tweet_id: string; opportunity_upside_score?: number | null; health_angle_fit_score?: number | null }[]) {
      evalMap.set(e.candidate_tweet_id, {
        opportunity_upside_score: e.opportunity_upside_score ?? null,
        health_angle_fit_score: e.health_angle_fit_score ?? null,
      });
    }
  }

  const stabilityMap = new Map<string, number>();
  const ageMap = new Map<string, number>();
  const oppMap = new Map<string, { target_tweet_id: string; target_username?: string | null; tweet_posted_at?: string | null; created_at?: string; discovery_source?: string | null; like_count?: number | null; reply_count?: number | null; retweet_count?: number | null; target_followers?: number | null; account_size_tier?: string | null; is_root_tweet?: boolean | null; target_in_reply_to_tweet_id?: string | null; features?: unknown }>();
  
  if (opps) {
    const now = Date.now();
    for (const opp of opps) {
      oppMap.set(opp.target_tweet_id, opp);
      const features = (opp.features || {}) as any;
      const stabilityScore = features.stability_score || 0.5;
      stabilityMap.set(opp.target_tweet_id, stabilityScore);
      
      const postedAt = opp.tweet_posted_at || opp.created_at;
      if (postedAt) {
        const ageMs = now - new Date(postedAt).getTime();
        const ageMinutes = ageMs / (60 * 1000);
        ageMap.set(opp.target_tweet_id, ageMinutes);
        
        if (ageMinutes >= 5 && ageMinutes <= 45) {
          stabilityMap.set(opp.target_tweet_id, Math.max(stabilityScore, 1.0));
        } else if (ageMinutes < 2) {
          stabilityMap.set(opp.target_tweet_id, Math.min(stabilityScore, 0.3));
        } else if (ageMinutes > 120) {
          stabilityMap.set(opp.target_tweet_id, Math.min(stabilityScore, 0.4));
        }
      }
    }
  }

  const evalScoresByTweetId = new Map<string, { opportunity_upside_score?: number | null; health_angle_fit_score?: number | null }>();
  for (const c of filteredCandidates) {
    const e = evalMap.get(c.candidate_tweet_id);
    if (e) evalScoresByTweetId.set(c.candidate_tweet_id, e);
  }
  
  const candidatesWithOpp = filteredCandidates.map(c => ({
    ...c,
    stability_score: stabilityMap.get(c.candidate_tweet_id) || 0.5,
    age_minutes: ageMap.get(c.candidate_tweet_id) ?? null,
    opp: oppMap.get(c.candidate_tweet_id) ?? null,
    opportunity_upside_score: evalScoresByTweetId.get(c.candidate_tweet_id)?.opportunity_upside_score ?? null,
    health_angle_fit_score: evalScoresByTweetId.get(c.candidate_tweet_id)?.health_angle_fit_score ?? null,
  }));
  
  const oppIntelligenceEnabled = process.env.OPP_INTELLIGENCE_ENABLED !== 'false';
  let candidate: typeof filteredCandidates[0] & { id?: string };
  
  if (oppIntelligenceEnabled) {
    const { evaluatePool, logPoolEvaluation, OPP_INTELLIGENCE_MIN_TOP_SCORE } = await import('./opportunityIntelligence');
    const poolResult = await evaluatePool(candidatesWithOpp);
    logPoolEvaluation(poolResult);
    
    if (poolResult.decision !== 'SELECT') {
      console.log(`[QUEUE_MANAGER] 🚫 NO_TRADE: ${poolResult.decision} (top_score=${poolResult.topScore} < ${OPP_INTELLIGENCE_MIN_TOP_SCORE}) reasons=[${poolResult.reasonCodes.join(', ')}]`);
      try {
        await supabase.from('system_events').insert({
          event_type: 'OPP_INTELLIGENCE_NO_TRADE',
          severity: 'info',
          message: `Opportunity intelligence: ${poolResult.decision}`,
          event_data: {
            decision: poolResult.decision,
            top_score: poolResult.topScore,
            pool_size: poolResult.poolSize,
            reason_codes: poolResult.reasonCodes,
            pool_stats: poolResult.poolStats,
          },
          created_at: new Date().toISOString(),
        });
      } catch (_) { /* non-blocking */ }
      return null;
    }
    // Phase 5: Exploit (top) vs explore (second candidate when pool has 2+). No explore in controlled-live.
    const { shouldExploreThisTick } = await import('./learnedPriors');
    const exploring = process.env.REPLY_CONTROLLED_LIVE !== 'true' && shouldExploreThisTick();
    if (exploring && poolResult.topCandidates?.length >= 2) {
      const second = poolResult.topCandidates[1];
      const minExploreScore = OPP_INTELLIGENCE_MIN_TOP_SCORE * 0.7;
      if (second && second.opportunity_score >= minExploreScore) {
        candidate = second;
        console.log(`[QUEUE_MANAGER] 🎲 EXPLORE: selected second candidate ${candidate.candidate_tweet_id} (score=${second.opportunity_score})`);
      } else {
        candidate = poolResult.topCandidate!;
      }
    } else {
      candidate = poolResult.topCandidate!;
    }
  } else {
    candidatesWithOpp.sort((a, b) => {
      if (b.stability_score !== a.stability_score) return b.stability_score - a.stability_score;
      return b.overall_score - a.overall_score;
    });
    candidate = candidatesWithOpp[0];
  }
  
  // If lease columns exist, atomically lease the candidate
  if (hasLeases) {
    const { v4: uuidv4 } = await import('uuid');
    const leaseId = uuidv4();
    const now = new Date();
    const leasedUntil = new Date(now.getTime() + 2 * 60 * 1000); // 2 minute lease
    
    // Atomically lease the candidate (only if still queued and unleased)
    const { data: leasedCandidate, error: leaseError } = await supabase
      .from('reply_candidate_queue')
      .update({ 
        status: 'leased',
        lease_id: leaseId,
        leased_at: now.toISOString(),
        leased_until: leasedUntil.toISOString(),
        selected_at: now.toISOString() // Keep for backward compatibility
      })
      .eq('id', candidate.id)
      .eq('status', 'queued') // Only update if still queued (prevent race condition)
      .is('lease_id', null) // Only update if unleased
      .select('candidate_tweet_id, evaluation_id, predicted_tier, overall_score, id, lease_id')
      .single();
    
    if (leaseError || !leasedCandidate) {
      // Another process got it first - try next candidate
      console.log(`[QUEUE_MANAGER] ⚠️ Candidate ${candidate.candidate_tweet_id} already leased, retrying...`);
      // Recursive retry once (prevents infinite loop)
      return getNextCandidateFromQueue(tier, deniedTweetIds);
    }
    
    console.log(`[QUEUE_MANAGER] 🔒 Leased candidate ${candidate.candidate_tweet_id} with lease_id=${leaseId} until ${leasedUntil.toISOString()}`);
    
    return {
      ...leasedCandidate,
      id: leasedCandidate.id,
      lease_id: leaseId,
    };
  } else {
    // Fallback: use old "selected" status behavior
    await supabase
      .from('reply_candidate_queue')
      .update({ status: 'selected', selected_at: new Date().toISOString() })
      .eq('candidate_tweet_id', candidate.candidate_tweet_id);
    
    console.log(`[QUEUE_MANAGER] ✅ Selected candidate ${candidate.candidate_tweet_id} (lease columns not available, using selected status)`);
    
    return {
      ...candidate,
      id: candidate.id,
    };
  }
}

/**
 * Release lease (revert candidate to queued) - graceful fallback if columns don't exist
 */
export async function releaseLease(candidateTweetId: string, leaseId?: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Check if lease columns exist
  if (!(await hasLeaseColumns())) {
    // Fallback: revert to queued using old behavior
    const { error } = await supabase
      .from('reply_candidate_queue')
      .update({ 
        status: 'queued',
        selected_at: null
      })
      .eq('candidate_tweet_id', candidateTweetId);
    
    if (!error) {
      console.log(`[QUEUE_MANAGER] 🔓 Released candidate ${candidateTweetId} to queued (fallback mode)`);
    }
    return;
  }
  
  // Use lease-based release
  if (!leaseId) {
    // No lease_id provided, just revert to queued
    await supabase
      .from('reply_candidate_queue')
      .update({ 
        status: 'queued',
        lease_id: null,
        leased_at: null,
        leased_until: null,
        selected_at: null
      })
      .eq('candidate_tweet_id', candidateTweetId);
    return;
  }
  
  // Only release if lease_id matches (prevents releasing someone else's lease)
  const { error } = await supabase
    .from('reply_candidate_queue')
    .update({ 
      status: 'queued',
      lease_id: null,
      leased_at: null,
      leased_until: null,
      selected_at: null
    })
    .eq('candidate_tweet_id', candidateTweetId)
    .eq('lease_id', leaseId)
    .eq('status', 'leased');
  
  if (error) {
    console.warn(`[QUEUE_MANAGER] ⚠️ Failed to release lease for ${candidateTweetId}: ${error.message}`);
  } else {
    console.log(`[QUEUE_MANAGER] 🔓 Released lease for ${candidateTweetId} (lease_id=${leaseId})`);
  }
}

/**
 * Mark candidate as processed (post attempt completed) - graceful fallback if columns don't exist
 */
export async function markCandidateProcessed(candidateTweetId: string, leaseId?: string, status: 'posted' | 'queued' = 'queued', reason?: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  // Check if lease columns exist
  if (!(await hasLeaseColumns())) {
    // Fallback: use old behavior
    const updateData: any = {
      selected_at: null,
    };
    
    if (status === 'posted') {
      updateData.status = 'posted';
      updateData.posted_at = new Date().toISOString();
    } else {
      updateData.status = 'queued';
    }
    
    const { error } = await supabase
      .from('reply_candidate_queue')
      .update(updateData)
      .eq('candidate_tweet_id', candidateTweetId);
    
    if (!error) {
      console.log(`[QUEUE_MANAGER] ✅ Marked candidate ${candidateTweetId} as ${status} (fallback mode)`);
    }
    return;
  }
  
  // Use lease-based update
  const updateData: any = {
    lease_id: null,
    leased_at: null,
    leased_until: null,
    selected_at: null,
  };
  
  if (status === 'posted') {
    updateData.status = 'posted';
    updateData.posted_at = new Date().toISOString();
  } else {
    updateData.status = 'queued';
  }
  
  // Only update if lease_id matches (if provided)
  let updateQuery = supabase
    .from('reply_candidate_queue')
    .update(updateData)
    .eq('candidate_tweet_id', candidateTweetId);
  
  if (leaseId) {
    updateQuery = updateQuery.eq('lease_id', leaseId);
  }
  
  const { error } = await updateQuery;
  
  if (error) {
    console.warn(`[QUEUE_MANAGER] ⚠️ Failed to mark candidate processed for ${candidateTweetId}: ${error.message}`);
  }
}


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

/**
 * Refresh the candidate queue
 * @param runStartedAt Optional timestamp to prioritize fresh evaluations created after this time
 */
export async function refreshCandidateQueue(runStartedAt?: string): Promise<{
  evaluated: number;
  queued: number;
  expired: number;
}> {
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
  
  const expiredCount = expired?.length || 0;
  if (expiredCount > 0) {
    console.log(`[QUEUE_MANAGER] ⏰ Expired ${expiredCount} queue entries`);
  }
  
  // Step 2: Get top candidates from evaluations
  // If runStartedAt provided, prioritize fresh evaluations (created after run start)
  // Otherwise use evaluations from last 2h to ensure recent ones are included
  let query = supabase
    .from('candidate_evaluations')
    .select('*')
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3) // Only tier 1-3 (exclude tier 4)
    .in('status', ['evaluated', 'queued']) // Include both evaluated and already-queued (for re-queuing expired ones)
    .order('overall_score', { ascending: false });
  
  if (runStartedAt) {
    // ONE_SHOT_FRESH_ONLY=true: Filter strictly by runStartedAt
    query = query.gte('created_at', runStartedAt);
    console.log(`[QUEUE_MANAGER] 🔍 Filtering for fresh evaluations (created_at >= ${runStartedAt})`);
  } else {
    // 🔒 FIX: Widen freshness window from 2h to 24h to include valid candidates
    // Runtime preflight gating protects against stale tweets, so older candidates are safe for planning
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', twentyFourHoursAgo);
    console.log(`[QUEUE_MANAGER] 🔍 Filtering for recent evaluations (created_at >= ${twentyFourHoursAgo}, 24h window)`);
  }
  
  const { data: topCandidates } = await query.limit(shortlistSize * 2); // Get more than needed to account for duplicates
  
  if (!topCandidates || topCandidates.length === 0) {
    console.log('[QUEUE_MANAGER] ⚠️ No candidates available for queue');
    return { evaluated: 0, queued: 0, expired: expiredCount };
  }
  
  console.log(`[QUEUE_MANAGER] 📊 Found ${topCandidates.length} candidates to consider`);
  
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
  const missingMetadataFields: Record<string, number> = {};
  const now = new Date();
  const diagnosticSamples: Array<{ tweet_id: string; evaluation_id: string; created_at: string; reason: string }> = [];
  
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
    
    // FILTER: Reject synthetic tweet IDs
    const tweetId = candidate.candidate_tweet_id || '';
    if (/^2000000000000000\d{3}$/.test(tweetId)) {
      rejectedSynthetic++;
      console.log(`[QUEUE_MANAGER] 🚫 Rejected synthetic candidate: ${tweetId}`);
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
      console.log(`[QUEUE_MANAGER] 🚫 Rejected missing metadata: ${tweetId} (missing: ${Object.keys(missingMetadataFields).join(', ')})`);
      continue;
    }
    
    // Calculate TTL based on age/velocity
    const postedTime = new Date(candidate.candidate_posted_at || now).getTime();
    const ageMinutes = (now.getTime() - postedTime) / (1000 * 60);
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
  
  console.log(`[QUEUE_MANAGER] 📊 Queue refresh stats:`);
  console.log(`   Considered: ${topCandidates.length}`);
  console.log(`   Rejected synthetic: ${rejectedSynthetic}`);
  console.log(`   Rejected missing metadata: ${rejectedMissingMetadata}`);
  console.log(`   Rejected already queued: ${rejectedAlreadyQueued}`);
  if (Object.keys(missingMetadataFields).length > 0) {
    console.log(`   Missing fields: ${Object.entries(missingMetadataFields).map(([f, c]) => `${f}=${c}`).join(', ')}`);
  }
  console.log(`   Queued: ${queuedCount} new candidates`);
  
  return {
    evaluated: topCandidates.length,
    queued: queuedCount,
    expired: expiredCount,
  };
}

/**
 * Calculate TTL based on age and velocity
 */
function calculateTTL(ageMinutes: number, velocityScore: number): number {
  // High velocity tweets expire faster (they're time-sensitive)
  // Older tweets expire faster
  const baseTTL = 60; // 60 minutes base
  
  // Reduce TTL for high velocity (they're hot now, but won't be later)
  const velocityAdjustment = velocityScore > 0.5 ? -20 : 0;
  
  // BUG FIX: Reduce TTL for older tweets, but ensure minimum viable TTL
  // For tweets >60 min old, give at least 30 min TTL to allow scheduler time
  const ageAdjustment = ageMinutes > 60 ? -30 : (ageMinutes > 30 ? -20 : 0);
  
  // Minimum 30 minutes TTL to ensure scheduler has time to pick them up
  return Math.max(30, baseTTL + velocityAdjustment + ageAdjustment);
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
  
  query = query
    .order('predicted_tier', { ascending: true }) // Tier 1 first
    .order('overall_score', { ascending: false }) // Then by score
    .limit(10); // Get more candidates to filter by stability
  
  const { data: candidates, error } = await query;
  
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
    
    // Join with reply_opportunities to check is_root_tweet
    const { data: opportunities } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, is_root_tweet, target_in_reply_to_tweet_id')
      .in('target_tweet_id', candidateTweetIds);
    
    const rootTweetIds = new Set<string>();
    if (opportunities) {
      for (const opp of opportunities) {
        // Consider root if: is_root_tweet=true OR target_in_reply_to_tweet_id is null
        const isRoot = opp.is_root_tweet === true || 
                       (opp.is_root_tweet !== false && opp.target_in_reply_to_tweet_id === null);
        if (isRoot) {
          rootTweetIds.add(opp.target_tweet_id);
        }
      }
    }
    
    // Filter candidates to only root tweets
    const beforeCount = filteredCandidates.length;
    filteredCandidates = filteredCandidates.filter(c => rootTweetIds.has(c.candidate_tweet_id));
    filteredOutCount = beforeCount - filteredCandidates.length;
    
    if (filteredOutCount > 0) {
      console.log(`[ROOT_ONLY] filtered_out_replies=${filteredOutCount} kept_roots=${filteredCandidates.length} total_checked=${beforeCount}`);
    }
    
    if (filteredCandidates.length === 0) {
      const rootOnlyMsg = ` (root_only filtered out ${filteredOutCount})`;
      console.log(`[QUEUE_MANAGER] ⚠️ No root candidates found for tier ${tier}${rootOnlyMsg}`);
      return null;
    }
  }
  
  // 🔒 TARGET STABILITY HEURISTICS: Prefer candidates with tweet age 5-45 minutes
  // Join with reply_opportunities to get tweet age and stability features
  const candidateTweetIds = filteredCandidates.map(c => c.candidate_tweet_id);
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, features, tweet_posted_at, created_at')
    .in('target_tweet_id', candidateTweetIds);
  
  const stabilityMap = new Map<string, number>();
  const ageMap = new Map<string, number>(); // age in minutes
  
  if (opps) {
    const now = Date.now();
    for (const opp of opps) {
      const features = (opp.features || {}) as any;
      const stabilityScore = features.stability_score || 0.5;
      stabilityMap.set(opp.target_tweet_id, stabilityScore);
      
      // Calculate tweet age in minutes
      const postedAt = opp.tweet_posted_at || opp.created_at;
      if (postedAt) {
        const ageMs = now - new Date(postedAt).getTime();
        const ageMinutes = ageMs / (60 * 1000);
        ageMap.set(opp.target_tweet_id, ageMinutes);
        
        // Boost stability score for 5-45min window
        if (ageMinutes >= 5 && ageMinutes <= 45) {
          stabilityMap.set(opp.target_tweet_id, Math.max(stabilityScore, 1.0));
        } else if (ageMinutes < 2) {
          // Deprioritize very fresh tweets (<2 min, edit risk)
          stabilityMap.set(opp.target_tweet_id, Math.min(stabilityScore, 0.3));
        } else if (ageMinutes > 120) {
          // Deprioritize old tweets (>2 hours, deletion risk)
          stabilityMap.set(opp.target_tweet_id, Math.min(stabilityScore, 0.4));
        }
      }
    }
  }
  
  // Sort by stability_score (prefer 1.0 = 5-45min window), then by overall_score
  const candidatesWithStability = filteredCandidates.map(c => ({
    ...c,
    stability_score: stabilityMap.get(c.candidate_tweet_id) || 0.5,
    age_minutes: ageMap.get(c.candidate_tweet_id) || null
  }));
  
  candidatesWithStability.sort((a, b) => {
    // First by stability_score (desc), then by overall_score (desc)
    if (b.stability_score !== a.stability_score) {
      return b.stability_score - a.stability_score;
    }
    return b.overall_score - a.overall_score;
  });
  
  const candidate = candidatesWithStability[0];
  
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


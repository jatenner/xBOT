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
 */
export async function refreshCandidateQueue(): Promise<{
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
  // BUG FIX: Remove status='evaluated' requirement - candidates get status='queued' after being queued
  // BUG FIX: Change .gte('predicted_tier', 2) to .lte('predicted_tier', 3) to include tier 1 and exclude tier 4
  const { data: topCandidates } = await supabase
    .from('candidate_evaluations')
    .select('*')
    .eq('passed_hard_filters', true)
    .lte('predicted_tier', 3) // Only tier 1-3 (exclude tier 4)
    .in('status', ['evaluated', 'queued']) // Include both evaluated and already-queued (for re-queuing expired ones)
    .order('overall_score', { ascending: false })
    .limit(shortlistSize * 2); // Get more than needed to account for duplicates
  
  if (!topCandidates || topCandidates.length === 0) {
    console.log('[QUEUE_MANAGER] ⚠️ No candidates available for queue');
    return { evaluated: 0, queued: 0, expired: expiredCount };
  }
  
  console.log(`[QUEUE_MANAGER] 📊 Found ${topCandidates.length} candidates to consider`);
  
  // Step 3: Check which are already in queue (non-expired)
  const { data: existingQueue } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString()); // Only count non-expired entries
  
  const existingIds = new Set(existingQueue?.map(q => q.candidate_tweet_id) || []);
  
  // Step 4: Add new candidates to queue
  let queuedCount = 0;
  const now = new Date();
  
  for (const candidate of topCandidates) {
    // Skip if already in queue
    if (existingIds.has(candidate.candidate_tweet_id)) {
      continue;
    }
    
    // Skip if we have enough
    if (queuedCount >= shortlistSize) {
      break;
    }
    
    // Calculate TTL based on age/velocity
    const postedTime = new Date(candidate.candidate_posted_at || now).getTime();
    const ageMinutes = (now.getTime() - postedTime) / (1000 * 60);
    const ttlMinutes = calculateTTL(ageMinutes, candidate.velocity_score || 0);
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);
    
    // Insert into queue
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
      console.error(`[QUEUE_MANAGER] ⚠️ Failed to queue ${candidate.candidate_tweet_id}: ${error.message}`);
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
  
  console.log(`[QUEUE_MANAGER] ✅ Queued ${queuedCount} new candidates`);
  
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
  
  query = query
    .order('predicted_tier', { ascending: true }) // Tier 1 first
    .order('overall_score', { ascending: false }) // Then by score
    .limit(1);
  
  if (tier !== undefined && !singleId) {
    // Only filter by tier if not in SINGLE_ID mode
    query = query.eq('predicted_tier', tier);
  }
  
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
  
  const candidate = candidates[0];
  
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


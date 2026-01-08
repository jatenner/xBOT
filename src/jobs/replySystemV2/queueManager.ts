/**
 * 📋 QUEUE MANAGER
 * 
 * Maintains shortlist queue of top N candidates
 * Refreshes every 5 min
 */

import { getSupabaseClient } from '../../db/index';

const QUEUE_SIZE = 25; // Top N candidates
const DEFAULT_TTL_MINUTES = 60; // Default TTL

/**
 * Refresh the candidate queue
 */
export async function refreshCandidateQueue(): Promise<{
  evaluated: number;
  queued: number;
  expired: number;
}> {
  console.log('[QUEUE_MANAGER] 📋 Refreshing candidate queue...');
  
  const supabase = getSupabaseClient();
  
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
  const { data: topCandidates } = await supabase
    .from('candidate_evaluations')
    .select('*')
    .eq('status', 'evaluated')
    .eq('passed_hard_filters', true)
    .gte('predicted_tier', 2) // Only tier 1-3 (exclude tier 4)
    .order('overall_score', { ascending: false })
    .limit(QUEUE_SIZE * 2); // Get more than needed to account for duplicates
  
  if (!topCandidates || topCandidates.length === 0) {
    console.log('[QUEUE_MANAGER] ⚠️ No candidates available for queue');
    return { evaluated: 0, queued: 0, expired: expiredCount };
  }
  
  console.log(`[QUEUE_MANAGER] 📊 Found ${topCandidates.length} candidates to consider`);
  
  // Step 3: Check which are already in queue
  const { data: existingQueue } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id')
    .eq('status', 'queued');
  
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
    if (queuedCount >= QUEUE_SIZE) {
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
  
  // Reduce TTL for older tweets
  const ageAdjustment = ageMinutes > 30 ? -30 : 0;
  
  return Math.max(15, baseTTL + velocityAdjustment + ageAdjustment); // Minimum 15 minutes
}

/**
 * Get next candidate from queue for posting
 */
export async function getNextCandidateFromQueue(tier?: number): Promise<{
  candidate_tweet_id: string;
  evaluation_id: string;
  predicted_tier: number;
  overall_score: number;
} | null> {
  const supabase = getSupabaseClient();
  
  let query = supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id, evaluation_id, predicted_tier, overall_score')
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString())
    .order('predicted_tier', { ascending: true }) // Tier 1 first
    .order('overall_score', { ascending: false }) // Then by score
    .limit(1);
  
  if (tier !== undefined) {
    query = query.eq('predicted_tier', tier);
  }
  
  const { data, error } = await query.single();
  
  if (error || !data) {
    return null;
  }
  
  // Mark as selected
  await supabase
    .from('reply_candidate_queue')
    .update({ status: 'selected', selected_at: new Date().toISOString() })
    .eq('candidate_tweet_id', data.candidate_tweet_id);
  
  return data;
}


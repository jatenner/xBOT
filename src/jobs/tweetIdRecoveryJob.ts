/**
 * 🔒 TWEET ID RECOVERY JOB
 * 
 * Finds posts with missing tweet IDs and attempts to recover them.
 * This prevents the bot from looking unprofessional.
 * 
 * Runs every 30 minutes to catch any missed IDs.
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';

const RECOVERY_WINDOW_HOURS = 24; // Only try to recover IDs from last 24 hours

export async function runTweetIdRecovery(): Promise<void> {
  console.log('[TWEET_ID_RECOVERY] 🔍 Starting tweet ID recovery job...');
  log({ op: 'tweet_id_recovery_start' });
  
  try {
    const supabase = getSupabaseClient();
    const cutoffTime = new Date(Date.now() - RECOVERY_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
    
    // Find posts with status 'posted' but missing tweet_id
    const { data: missingIds, error: fetchError } = await supabase
      .from('content_metadata')
      .select('decision_id, content, posted_at, decision_type, target_tweet_id, target_username')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', cutoffTime)
      .order('posted_at', { ascending: false })
      .limit(50);
    
    if (fetchError) {
      console.error('[TWEET_ID_RECOVERY] ❌ Failed to fetch missing IDs:', fetchError.message);
      log({ op: 'tweet_id_recovery_error', error: fetchError.message });
      return;
    }
    
    if (!missingIds || missingIds.length === 0) {
      console.log('[TWEET_ID_RECOVERY] ✅ No missing tweet IDs found');
      log({ op: 'tweet_id_recovery_complete', recovered: 0 });
      return;
    }
    
    console.log(`[TWEET_ID_RECOVERY] 📋 Found ${missingIds.length} posts with missing tweet IDs`);
    
    let recovered = 0;
    let failed = 0;
    
    for (const post of missingIds) {
      try {
        const tweetId = await attemptRecovery(post, supabase);
        if (tweetId) {
          recovered++;
          console.log(`[TWEET_ID_RECOVERY] ✅ Recovered ID for ${post.decision_id}: ${tweetId}`);
        } else {
          failed++;
          console.log(`[TWEET_ID_RECOVERY] ⚠️ Could not recover ID for ${post.decision_id}`);
        }
      } catch (error: any) {
        failed++;
        console.error(`[TWEET_ID_RECOVERY] ❌ Recovery failed for ${post.decision_id}:`, error.message);
      }
    }
    
    console.log(`[TWEET_ID_RECOVERY] ✅ Recovery complete: ${recovered} recovered, ${failed} failed`);
    log({ 
      op: 'tweet_id_recovery_complete', 
      recovered, 
      failed, 
      total: missingIds.length 
    });
    
  } catch (error: any) {
    console.error('[TWEET_ID_RECOVERY] 💥 Fatal error:', error.message);
    log({ op: 'tweet_id_recovery_fatal', error: error.message });
  }
}

async function attemptRecovery(
  post: any,
  supabase: any
): Promise<string | null> {
  // Strategy 1: Check posted_decisions table (might have ID there)
  const { data: postedDecision } = await supabase
    .from('posted_decisions')
    .select('tweet_id')
    .eq('decision_id', post.decision_id)
    .single();
  
  if (postedDecision?.tweet_id) {
    // Found it! Update content_metadata
    await supabase
      .from('content_metadata')
      .update({ tweet_id: postedDecision.tweet_id })
      .eq('decision_id', post.decision_id);
    return postedDecision.tweet_id;
  }
  
  // Strategy 2: For replies, try to find by content + target_tweet_id
  if (post.decision_type === 'reply' && post.target_tweet_id) {
    // Check if we can find it by matching content and target
    // This is a best-effort recovery
    console.log(`[TWEET_ID_RECOVERY] 🔍 Reply recovery attempted for ${post.decision_id}`);
    // Note: Full recovery would require scraping Twitter, which is expensive
    // For now, we mark it as needing manual review
  }
  
  // Strategy 3: Check error_message for stored tweet_id
  const { data: postWithError } = await supabase
    .from('content_metadata')
    .select('error_message')
    .eq('decision_id', post.decision_id)
    .single();
  
  if (postWithError?.error_message) {
    const tweetIdMatch = postWithError.error_message.match(/tweet_id:\s*(\d+)/);
    if (tweetIdMatch) {
      const tweetId = tweetIdMatch[1];
      await supabase
        .from('content_metadata')
        .update({ 
          tweet_id: tweetId,
          error_message: null // Clear error after recovery
        })
        .eq('decision_id', post.decision_id);
      return tweetId;
    }
  }
  
  return null;
}


/**
 * 🔄 FOLLOWER DATA SYNC JOB
 * Syncs follower attribution data from tracking tables into outcomes table
 * Runs after velocity tracker completes to keep outcomes table updated
 */

import { getSupabaseClient } from '../db/index';

export async function syncFollowerData(): Promise<void> {
  console.log('[SYNC_FOLLOWER] 🔄 Starting follower data sync...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Get posts with complete tracking data (baseline + 24h)
    const { data: followerView, error: viewError } = await supabase
      .from('follower_attribution_simple')
      .select('post_id, baseline_followers, followers_24h, followers_gained_24h')
      .not('baseline_followers', 'is', null)
      .not('followers_24h', 'is', null);
    
    if (viewError) {
      // View might not exist yet, that's okay
      console.log('[SYNC_FOLLOWER] ℹ️ follower_attribution_simple view not available yet');
      return;
    }
    
    if (!followerView || followerView.length === 0) {
      console.log('[SYNC_FOLLOWER] ℹ️ No complete follower tracking data yet');
      return;
    }
    
    let synced = 0;
    
    for (const post of followerView) {
      try {
        // Check if outcome exists for this post
        const { data: existingOutcome } = await supabase
          .from('outcomes')
          .select('id, decision_id')
          .eq('decision_id', post.post_id)
          .maybeSingle();
        
        if (existingOutcome) {
          // Update existing outcome with follower data
          const { error: updateError } = await supabase
            .from('outcomes')
            .update({
              follows: post.followers_gained_24h // Use 'follows' column which already exists
            })
            .eq('decision_id', post.post_id);
          
          if (!updateError) {
            synced++;
          }
        }
      } catch (error: any) {
        console.warn(`[SYNC_FOLLOWER] ⚠️ Failed to sync ${post.post_id}:`, error.message);
        // Continue with other posts
      }
    }
    
    if (synced > 0) {
      console.log(`[SYNC_FOLLOWER] ✅ Synced ${synced} posts with follower data`);
    }
    
  } catch (error: any) {
    console.error('[SYNC_FOLLOWER] ❌ Sync failed:', error.message);
  }
}


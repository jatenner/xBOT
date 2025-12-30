/**
 * 📸 FOLLOWER SNAPSHOT JOB
 * 
 * Captures follower count snapshots at 2h, 24h, and 48h after posting
 * Enables accurate follower attribution to specific posts
 */

import { getSupabaseClient } from '../db';
import { MultiPointFollowerTracker } from '../tracking/multiPointFollowerTracker';

export async function followerSnapshotJob(): Promise<void> {
  console.log('[FOLLOWER_SNAPSHOT] 📸 Starting follower snapshot job...');
  
  const supabase = getSupabaseClient();
  const tracker = MultiPointFollowerTracker.getInstance();
  
  let processed = 0;
  let errors = 0;
  
  // Get posts needing 2h snapshot (posted 2 hours ago ± 10 minutes)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const twoHoursAgoPlus10 = new Date(twoHoursAgo.getTime() + 10 * 60 * 1000);
  
  const { data: posts2h } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twoHoursAgo.toISOString())
    .lt('posted_at', twoHoursAgoPlus10.toISOString())
    .is('followers_gained_2h', null);
  
  if (posts2h && posts2h.length > 0) {
    console.log(`[FOLLOWER_SNAPSHOT] 📸 Found ${posts2h.length} posts needing 2h snapshot`);
    for (const post of posts2h) {
      try {
        await tracker.capture2HourSnapshot(post.decision_id);
        processed++;
      } catch (error: any) {
        console.error(`[FOLLOWER_SNAPSHOT] ❌ Failed 2h snapshot for ${post.decision_id}:`, error.message);
        errors++;
      }
    }
  }
  
  // Get posts needing 24h snapshot (posted 24 hours ago ± 30 minutes)
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const twentyFourHoursAgoPlus30 = new Date(twentyFourHoursAgo.getTime() + 30 * 60 * 1000);
  
  const { data: posts24h } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', twentyFourHoursAgo.toISOString())
    .lt('posted_at', twentyFourHoursAgoPlus30.toISOString())
    .is('followers_gained_24h', null);
  
  if (posts24h && posts24h.length > 0) {
    console.log(`[FOLLOWER_SNAPSHOT] 📸 Found ${posts24h.length} posts needing 24h snapshot`);
    for (const post of posts24h) {
      try {
        await tracker.capture24HourSnapshot(post.decision_id);
        processed++;
      } catch (error: any) {
        console.error(`[FOLLOWER_SNAPSHOT] ❌ Failed 24h snapshot for ${post.decision_id}:`, error.message);
        errors++;
      }
    }
  }
  
  // Get posts needing 48h snapshot (posted 48 hours ago ± 1 hour)
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const fortyEightHoursAgoPlus60 = new Date(fortyEightHoursAgo.getTime() + 60 * 60 * 1000);
  
  const { data: posts48h } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', fortyEightHoursAgo.toISOString())
    .lt('posted_at', fortyEightHoursAgoPlus60.toISOString())
    .is('followers_gained_48h', null);
  
  if (posts48h && posts48h.length > 0) {
    console.log(`[FOLLOWER_SNAPSHOT] 📸 Found ${posts48h.length} posts needing 48h snapshot`);
    for (const post of posts48h) {
      try {
        await tracker.capture48HourSnapshot(post.decision_id);
        processed++;
      } catch (error: any) {
        console.error(`[FOLLOWER_SNAPSHOT] ❌ Failed 48h snapshot for ${post.decision_id}:`, error.message);
        errors++;
      }
    }
  }
  
  if (processed > 0 || errors > 0) {
    console.log(`[FOLLOWER_SNAPSHOT] ✅ Processed ${processed} snapshots, ${errors} errors`);
  } else {
    console.log(`[FOLLOWER_SNAPSHOT] ℹ️ No posts need snapshots at this time`);
  }
}




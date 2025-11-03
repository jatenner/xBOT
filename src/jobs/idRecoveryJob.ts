/**
 * 🔄 ID RECOVERY JOB
 * 
 * Finds tweets that were posted successfully but have NULL tweet_id
 * Searches Twitter profile to recover the missing IDs
 * 
 * Why this is needed:
 * - Tweet posting succeeds but ID extraction can fail
 * - We save post as 'posted' with NULL tweet_id
 * - This job recovers those IDs within 10 minutes
 * - Prevents data loss and learning system corruption
 */

import { getSupabaseClient } from '../db';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { BulletproofTweetExtractor } from '../utils/bulletproofTweetExtractor';

export async function idRecoveryJob(): Promise<void> {
  console.log('[ID_RECOVERY] 🔄 Starting ID recovery job...');
  
  try {
    const supabase = getSupabaseClient();
    
    // Find posts with NULL tweet_id from last 24 hours
    const { data: postsNeedingRecovery, error } = await supabase
      .from('content_metadata')
      .select('decision_id, content, posted_at, decision_type')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('[ID_RECOVERY] ❌ Failed to query posts:', error.message);
      return;
    }
    
    if (!postsNeedingRecovery || postsNeedingRecovery.length === 0) {
      console.log('[ID_RECOVERY] ✅ No posts need ID recovery');
      return;
    }
    
    console.log(`[ID_RECOVERY] 📊 Found ${postsNeedingRecovery.length} posts needing ID recovery`);
    
    // Get browser for extraction
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('id_recovery');
    
    try {
      let recovered = 0;
      let failed = 0;
      
      for (const post of postsNeedingRecovery) {
        try {
          const minutesAgo = Math.round((Date.now() - new Date(String(post.posted_at)).getTime()) / 60000);
          console.log(`[ID_RECOVERY] 🔍 Recovering ID for post from ${minutesAgo}min ago...`);
          console.log(`[ID_RECOVERY] 📝 Content: "${String(post.content).substring(0, 60)}..."`);
          
          // Use bulletproof extractor with wide time window
          const extraction = await BulletproofTweetExtractor.extractTweetId(page, {
            expectedContent: String(post.content),
            expectedUsername: process.env.TWITTER_USERNAME || 'SignalAndSynapse',
            maxAgeSeconds: 86400, // 24 hours
            navigateToVerify: true
          });
          
          if (extraction.success && extraction.tweetId) {
            // Update database with recovered ID
            const { error: updateError } = await supabase
              .from('content_metadata')
              .update({
                tweet_id: extraction.tweetId,
                tweet_url: extraction.url || `https://x.com/${process.env.TWITTER_USERNAME || 'SignalAndSynapse'}/status/${extraction.tweetId}`,
                needs_id_recovery: false
              })
              .eq('decision_id', post.decision_id);
            
            if (updateError) {
              console.error(`[ID_RECOVERY] ❌ Failed to save recovered ID: ${updateError.message}`);
              failed++;
            } else {
              console.log(`[ID_RECOVERY] ✅ Recovered ID: ${extraction.tweetId}`);
              recovered++;
              
              // Small delay between recoveries
              await page.waitForTimeout(2000);
            }
          } else {
            console.warn(`[ID_RECOVERY] ⚠️ Could not recover ID: ${extraction.error}`);
            failed++;
          }
          
        } catch (postError: any) {
          console.error(`[ID_RECOVERY] ❌ Recovery failed for post: ${postError.message}`);
          failed++;
        }
      }
      
      console.log(`[ID_RECOVERY] 📊 Recovery complete: ${recovered} recovered, ${failed} failed`);
      
    } finally {
      await pool.releasePage('id_recovery');
    }
    
  } catch (error: any) {
    console.error('[ID_RECOVERY] ❌ ID recovery job failed:', error.message);
  }
}


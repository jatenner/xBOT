/**
 * 🔍 ID VERIFICATION JOB
 * 
 * Checks for tweets that were posted but don't have tweet_id in database
 * Recovers IDs using content matching
 * Runs every 10 minutes to ensure rapid recovery
 * 
 * Flow:
 * 1. Find posts with NULL tweet_id from last 24 hours
 * 2. Use BulletproofTweetExtractor to recover IDs
 * 3. Update database with recovered IDs
 * 4. Alert if recovery fails after 1 hour
 */

import { getSupabaseClient } from '../db';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { BulletproofTweetExtractor } from '../utils/bulletproofTweetExtractor';
import { recordJobStart, recordJobSuccess, recordJobFailure } from './jobHeartbeat';
import { trackError } from '../utils/errorTracker';

export async function idVerificationJob(): Promise<void> {
  const startTime = Date.now();
  recordJobStart('id_verification');
  
  try {
    const supabase = getSupabaseClient();
    
    // Find posts with NULL tweet_id from last 24 hours
    const { data: postsNeedingVerification, error } = await supabase
      .from('content_metadata')
      .select('decision_id, content, posted_at, decision_type, status')
      .eq('status', 'posted')
      .is('tweet_id', null)
      .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('posted_at', { ascending: false })
      .limit(10); // Process up to 10 per run
    
    if (error) {
      console.error('[ID_VERIFICATION] ❌ Failed to query posts:', error.message);
      recordJobFailure('id_verification', error.message);
      return;
    }
    
    if (!postsNeedingVerification || postsNeedingVerification.length === 0) {
      console.log('[ID_VERIFICATION] ✅ No posts need verification');
      recordJobSuccess('id_verification', { verified: 0, recovered: 0, failed: 0 });
      return;
    }
    
    console.log(`[ID_VERIFICATION] 📊 Found ${postsNeedingVerification.length} posts needing verification`);
    
    // Get browser for extraction
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('id_verification');
    
    try {
      let recovered = 0;
      let failed = 0;
      let alerts = 0;
      
      for (const post of postsNeedingVerification) {
        try {
          const postedAt = new Date(String(post.posted_at));
          const ageMinutes = Math.round((Date.now() - postedAt.getTime()) / 60000);
          const ageHours = ageMinutes / 60;
          
          console.log(`[ID_VERIFICATION] 🔍 Verifying post from ${ageMinutes}min ago...`);
          console.log(`[ID_VERIFICATION] 📝 Content: "${String(post.content).substring(0, 60)}..."`);
          
          // Alert if post is older than 1 hour and still missing ID
          if (ageHours > 1) {
            console.warn(`[ID_VERIFICATION] 🚨 ALERT: Post missing ID for ${Math.round(ageHours)}h`);
            await trackError(
              'id_verification',
              'missing_id_alert',
              `Post missing tweet_id for ${Math.round(ageHours)}h`,
              'warning',
              {
                decision_id: post.decision_id,
                posted_at: post.posted_at,
                age_hours: ageHours
              }
            );
            alerts++;
          }
          
          // Use bulletproof extractor with wide time window
          const extraction = await BulletproofTweetExtractor.extractTweetId(page, {
            expectedContent: String(post.content),
            expectedUsername: process.env.TWITTER_USERNAME || 'SignalAndSynapse',
            maxAgeSeconds: 86400, // 24 hours
            navigateToVerify: true
          });
          
          if (extraction.success && extraction.tweetId) {
            // 🔥 RACE CONDITION PROTECTION: Only update if tweet_id is still NULL
            // Prevents overwriting if another recovery job already updated it
            const { error: updateError, data: updated } = await supabase
              .from('content_metadata')
              .update({
                tweet_id: extraction.tweetId,
                updated_at: new Date().toISOString()
              })
              .eq('decision_id', post.decision_id)
              .is('tweet_id', null) // 🔥 RACE CONDITION: Only update if still NULL
              .select('decision_id')
              .single();
            
            if (updateError) {
              console.error(`[ID_VERIFICATION] ❌ Failed to save recovered ID: ${updateError.message}`);
              failed++;
            } else if (!updated) {
              // Race condition: Another job already updated it
              console.log(`[ID_VERIFICATION] ⚠️ Decision ${post.decision_id} already updated by another process (race condition)`);
              recovered++; // Count as recovered (another job handled it)
              
              // Small delay between recoveries
              await page.waitForTimeout(2000);
            } else {
              console.log(`[ID_VERIFICATION] ✅ Recovered ID: ${extraction.tweetId} (age: ${ageMinutes}min)`);
              recovered++;
              
              // Small delay between recoveries
              await page.waitForTimeout(2000);
            }
          } else {
            console.warn(`[ID_VERIFICATION] ⚠️ Could not recover ID: ${extraction.error}`);
            
            // If older than 1 hour and still can't recover, mark as failed
            if (ageHours > 1) {
              failed++;
            }
          }
          
        } catch (postError: any) {
          console.error(`[ID_VERIFICATION] ❌ Verification failed for post: ${postError.message}`);
          failed++;
        }
      }
      
      const duration = Date.now() - startTime;
      console.log(`[ID_VERIFICATION] 📊 Verification complete: ${recovered} recovered, ${failed} failed, ${alerts} alerts (${Math.round(duration)}ms)`);
      
      recordJobSuccess('id_verification', {
        verified: postsNeedingVerification.length,
        recovered,
        failed,
        alerts,
        duration_ms: duration
      });
      
    } finally {
      await pool.releasePage(page);
    }
    
  } catch (error: any) {
    console.error('[ID_VERIFICATION] ❌ Verification job failed:', error.message);
    recordJobFailure('id_verification', error.message);
    throw error;
  }
}


/**
 * 🔄 TWEET RECONCILIATION JOB
 * 
 * Recovers false failures - tweets marked as "failed" but actually posted to Twitter
 * Runs every 6 hours to check failed tweets from last 7 days
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';

/**
 * Verify if a tweet exists on Twitter by searching profile
 */
async function verifyTweetOnTwitter(content: string): Promise<{ exists: boolean; tweetId?: string }> {
  try {
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const browserPool = UnifiedBrowserPool.getInstance();
    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    
    const result = await browserPool.withContext(
      'tweet_reconciliation',
      async (context) => {
        const page = await context.newPage();
        try {
          // Navigate to profile
          await page.goto(`https://x.com/${username}`, { 
            waitUntil: 'domcontentloaded', 
            timeout: 30000 
          });
          
          // Wait for timeline
          await page.waitForSelector('[data-testid="tweetText"]', { timeout: 10000 }).catch(() => null);
          
          // Search for tweet with matching content (first 50 chars)
          const searchText = content.substring(0, 50).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const tweetLocator = page.locator('[data-testid="tweetText"]').filter({ 
            hasText: new RegExp(searchText, 'i') 
          });
          
          const tweetExists = await tweetLocator.first().isVisible({ timeout: 5000 }).catch(() => false);
          
          if (tweetExists) {
            // Try to extract tweet ID
            try {
              const tweetElement = await tweetLocator.first();
              const tweetLink = await tweetElement.locator('..').locator('a[href*="/status/"]').first().getAttribute('href');
              if (tweetLink) {
                const match = tweetLink.match(/\/status\/(\d+)/);
                if (match && match[1]) {
                  return { exists: true, tweetId: match[1] };
                }
              }
            } catch (e) {
              // Tweet exists but ID extraction failed
              return { exists: true };
            }
            return { exists: true };
          }
          
          return { exists: false };
        } finally {
          await page.close();
        }
      },
      5 // Lower priority
    );
    
    return result || { exists: false };
  } catch (error: any) {
    log({ op: 'reconciliation_verification_error', error: error.message });
    return { exists: false };
  }
}

/**
 * Reconcile failed tweets - check if they're actually on Twitter
 */
export async function reconcileFailedTweets(): Promise<void> {
  log({ op: 'reconciliation_job_start' });
  
  try {
    const supabase = getSupabaseClient();
    
    // Get all failed tweets from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data: failedTweets, error: fetchError } = await supabase
      .from('content_metadata')
      .select('decision_id, decision_type, content, created_at, features')
      .eq('status', 'failed')
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50); // Process 50 at a time to avoid overload
    
    if (fetchError) {
      log({ op: 'reconciliation_job_error', error: fetchError.message });
      throw fetchError;
    }
    
    if (!failedTweets || failedTweets.length === 0) {
      log({ op: 'reconciliation_job_complete', recovered: 0, checked: 0 });
      return;
    }
    
    log({ op: 'reconciliation_job_checking', count: failedTweets.length });
    
    let recovered = 0;
    let checked = 0;
    
    for (const tweet of failedTweets) {
      checked++;
      
      // Skip if already has tweet_id (shouldn't happen but safety check)
      const existingTweetId = (tweet.features as any)?.recovered_tweet_id;
      if (existingTweetId) {
        continue;
      }
      
      // Verify if tweet exists on Twitter
      const verification = await verifyTweetOnTwitter(tweet.content);
      
      if (verification.exists) {
        // Tweet is actually live! Recover it
        const tweetId = verification.tweetId || `recovered_${Date.now()}`;
        const postedAt = new Date().toISOString();
        
        // Update database
        const { error: updateError } = await supabase
          .from('content_metadata')
          .update({
            status: 'posted',
            tweet_id: tweetId,
            posted_at: postedAt,
            updated_at: new Date().toISOString(),
            features: {
              ...(typeof tweet.features === 'object' && tweet.features !== null ? tweet.features : {}),
              recovered: true,
              recovered_at: new Date().toISOString(),
              recovered_tweet_id: tweetId
            }
          })
          .eq('decision_id', tweet.decision_id);
        
        if (updateError) {
          log({ op: 'reconciliation_recovery_error', decision_id: tweet.decision_id, error: updateError.message });
        } else {
          recovered++;
          log({ op: 'reconciliation_recovered', decision_id: tweet.decision_id, tweet_id: tweetId });
          
          // Also add to posted_decisions archive
          try {
            await supabase
              .from('posted_decisions')
              .insert({
                decision_id: tweet.decision_id,
                decision_type: tweet.decision_type,
                tweet_id: tweetId,
                content: tweet.content,
                posted_at: postedAt
              })
              .catch(() => {
                // Ignore duplicate errors
              });
          } catch (e) {
            // Ignore archive errors
          }
        }
      }
      
      // Small delay to avoid overwhelming Twitter
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    log({ op: 'reconciliation_job_complete', recovered, checked, total: failedTweets.length });
    console.log(`[RECONCILIATION] ✅ Recovered ${recovered}/${checked} false failures`);
    
  } catch (error: any) {
    log({ op: 'reconciliation_job_error', error: error.message });
    console.error('[RECONCILIATION] ❌ Job failed:', error.message);
    throw error;
  }
}


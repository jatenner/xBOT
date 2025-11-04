/**
 * 📊 OUTCOME INGESTION JOB
 * 
 * Fetches real engagement metrics from Twitter/X for posted content
 * and updates the outcomes table with actual performance data.
 * 
 * Runs after posts are published to collect engagement data.
 */

import { ENV } from '../config/env';
import { log } from '../lib/logger';
import { getSupabaseClient } from '../db';

interface TweetMetrics {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  quotes: number;
}

export async function collectRealOutcomes(): Promise<void> {
  log({ op: 'outcome_ingest_start' });
  
  const bearerToken = ENV.TWITTER_BEARER_TOKEN || null;
  
  if (!bearerToken) {
    log({ op: 'outcome_ingest', status: 'skipped', reason: 'no_bearer_token' });
    return;
  }
  
  try {
    const supabase = getSupabaseClient();
    
    // Get posted decisions from last 24 hours without outcomes
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data: postedDecisions, error } = await supabase
      .from('posted_decisions')
      .select('id, decision_id, tweet_id, posted_at')
      .gte('posted_at', twentyFourHoursAgo)
      .not('tweet_id', 'is', null);
    
    if (error) throw error;
    
    if (!postedDecisions || postedDecisions.length === 0) {
      console.log('[OUTCOME_INGEST] ℹ️ No recent posted decisions to collect outcomes for');
      return;
    }
    
    console.log(`[OUTCOME_INGEST] 🔍 Found ${postedDecisions.length} posted decisions to check`);
    
    let collected = 0;
    let skipped = 0;
    
    for (const decision of postedDecisions) {
      try {
        // Check if outcome already exists
        const { data: existing } = await supabase
          .from('outcomes')
          .select('id')
          .eq('decision_id', decision.decision_id)
          .eq('simulated', false)
          .single();
        
        if (existing) {
          skipped++;
          continue;
        }
        
        // Fetch metrics from Twitter API
        const metrics = await fetchTweetMetrics(decision.tweet_id, bearerToken);
        
        if (!metrics) {
          console.warn(`[OUTCOME_INGEST] ⚠️ Could not fetch metrics for tweet_id=${decision.tweet_id}`);
          continue;
        }
        
        // Calculate engagement rate
        const er_calculated = (metrics.likes + metrics.retweets + metrics.replies) / Math.max(1, metrics.impressions);
        
        // Insert outcome
        const { error: insertError } = await supabase
          .from('outcomes')
          .insert({
            decision_id: decision.decision_id,
            tweet_id: decision.tweet_id,
            impressions: metrics.impressions,
            likes: metrics.likes,
            retweets: metrics.retweets,
            replies: metrics.replies,
            bookmarks: metrics.bookmarks,
            quotes: metrics.quotes,
            er_calculated: er_calculated,
            simulated: false,
            collected_at: new Date().toISOString()
          });
        
        if (insertError) throw insertError;
        
        collected++;
        console.log(
          `[OUTCOME_INGEST] ✅ Collected outcome decision_id=${decision.decision_id} ` +
          `impressions=${metrics.impressions} likes=${metrics.likes} ER=${(er_calculated * 100).toFixed(2)}%`
        );
      } catch (innerError: any) {
        console.error(`[OUTCOME_INGEST] ❌ Failed to process decision_id=${decision.decision_id}: ${innerError.message}`);
      }
    }
    
    console.log(`[OUTCOME_INGEST] ✅ Collection complete: ${collected} collected, ${skipped} skipped`);
  } catch (error: any) {
    console.error('[OUTCOME_INGEST] ❌ Outcome collection failed:', error.message);
    throw error;
  }
}

/**
 * Fetch tweet metrics from Twitter API v2
 */
async function fetchTweetMetrics(tweetId: string, bearerToken: string): Promise<TweetMetrics | null> {
  try {
    const url = `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OUTCOME_INGEST] ⚠️ Twitter API error ${response.status}: ${errorText}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data.data || !data.data.public_metrics) {
      console.warn(`[OUTCOME_INGEST] ⚠️ No metrics found for tweet_id=${tweetId}`);
      return null;
    }
    
    const metrics = data.data.public_metrics;
    
    return {
      impressions: metrics.impression_count || 0,
      likes: metrics.like_count || 0,
      retweets: metrics.retweet_count || 0,
      replies: metrics.reply_count || 0,
      bookmarks: metrics.bookmark_count || 0,
      quotes: metrics.quote_count || 0
    };
  } catch (error: any) {
    console.error(`[OUTCOME_INGEST] ❌ Failed to fetch metrics for tweet ${tweetId}: ${error.message}`);
    return null;
  }
}

/**
 * Create outcome stub immediately after posting
 * This gives the learner rows to work with even before engagement data arrives
 */
export async function createOutcomeStub(
  decisionId: string,
  tweetId: string,
  platform: string = 'twitter'
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('outcomes')
      .insert({
        decision_id: decisionId,
        tweet_id: tweetId,
        impressions: 0,
        likes: 0,
        retweets: 0,
        replies: 0,
        bookmarks: 0,
        quotes: 0,
        er_calculated: 0,
        simulated: false,
        collected_at: new Date().toISOString()
      });
    
    if (error) {
      // Ignore duplicate errors (stub may already exist)
      if (!error.message.includes('duplicate') && !error.message.includes('unique')) {
        throw error;
      }
    }
    
    console.log(`[OUTCOME_INGEST] ✅ Created outcome stub for decision_id=${decisionId}`);
  } catch (error: any) {
    console.warn(`[OUTCOME_INGEST] ⚠️ Failed to create outcome stub: ${error.message}`);
  }
}

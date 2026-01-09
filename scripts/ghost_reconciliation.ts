/**
 * 🔍 GHOST RECONCILIATION
 * Detects tweets posted without permits and logs them
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function reconcileGhosts() {
  const supabase = getSupabaseClient();
  
  // Check for tweets posted in last 24 hours that have no permit
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Get all tweet IDs from content_generation_metadata_comprehensive posted in last 24h
  const { data: postedTweets } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('tweet_id, decision_id, posted_at, pipeline_source')
    .eq('status', 'posted')
    .gte('posted_at', oneDayAgo)
    .order('posted_at', { ascending: false });
  
  console.log(`Checking ${postedTweets?.length || 0} posted tweets for ghost detection...`);
  
  let ghostCount = 0;
  
  if (postedTweets) {
    for (const tweet of postedTweets) {
      // Check if permit exists
      const { data: permit } = await supabase
        .from('post_attempts')
        .select('permit_id, status')
        .eq('actual_tweet_id', tweet.tweet_id)
        .maybeSingle();
      
      if (!permit) {
        // Check if already in ghost_tweets
        const { data: existingGhost } = await supabase
          .from('ghost_tweets')
          .select('id')
          .eq('tweet_id', tweet.tweet_id)
          .maybeSingle();
        
        if (!existingGhost) {
          // Insert ghost record
          await supabase.from('ghost_tweets').insert({
            tweet_id: tweet.tweet_id,
            decision_id: tweet.decision_id,
            detected_at: new Date().toISOString(),
            status: 'detected',
            reason: 'no_permit_found',
            pipeline_source: tweet.pipeline_source || 'unknown',
          });
          
          // Log to system_events
          await supabase.from('system_events').insert({
            event_type: 'ghost_tweet_detected',
            severity: 'critical',
            message: `Ghost tweet detected: ${tweet.tweet_id} (no permit found)`,
            event_data: {
              tweet_id: tweet.tweet_id,
              decision_id: tweet.decision_id,
              pipeline_source: tweet.pipeline_source,
              posted_at: tweet.posted_at,
            },
            created_at: new Date().toISOString(),
          });
          
          ghostCount++;
          console.log(`⚠️  GHOST DETECTED: ${tweet.tweet_id} (decision: ${tweet.decision_id})`);
        }
      }
    }
  }
  
  console.log(`\n✅ Reconciliation complete: ${ghostCount} new ghosts detected`);
  process.exit(0);
}

reconcileGhosts().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});


/**
 * Get detailed metrics for specific tweet IDs
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const tweetIds = process.argv.slice(2);
  if (tweetIds.length === 0) {
    console.error('Usage: tsx scripts/get-tweet-metrics.ts <tweet_id1> <tweet_id2> ...');
    process.exit(1);
  }
  
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('content_metadata')
    .select('tweet_id, actual_likes, actual_retweets, actual_replies, actual_impressions, updated_at')
    .in('tweet_id', tweetIds)
    .order('tweet_id');
  
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  console.log('\n📊 Tweet Metrics:\n');
  console.log('tweet_id           | metrics_present | last_metrics_at        | likes | reposts | replies | views');
  console.log('───────────────────┼─────────────────┼───────────────────────┼───────┼─────────┼─────────┼──────');
  
  (data || []).forEach((row: any) => {
    const metricsPresent = row.actual_impressions !== null ? '✅' : '❌';
    const lastMetricsAt = row.updated_at ? new Date(row.updated_at).toISOString().substring(0, 19) : 'NULL';
    const likes = row.actual_likes ?? 'NULL';
    const reposts = row.actual_retweets ?? 'NULL';
    const replies = row.actual_replies ?? 'NULL';
    const views = row.actual_impressions ?? 'NULL';
    
    console.log(`${row.tweet_id.padEnd(19)} | ${metricsPresent.padEnd(15)} | ${lastMetricsAt.padEnd(21)} | ${String(likes).padEnd(5)} | ${String(reposts).padEnd(7)} | ${String(replies).padEnd(7)} | ${String(views).padEnd(5)}`);
  });
  
  console.log('');
  process.exit(0);
}

main().catch(console.error);


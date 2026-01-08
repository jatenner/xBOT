/**
 * One-off metrics scraper runner
 * Usage: tsx scripts/metrics-once.ts
 */

import 'dotenv/config';
import { metricsScraperJob } from '../src/jobs/metricsScraperJob';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  console.log('[METRICS_ONCE] 🚀 Running metrics scraper once...\n');
  
  // Get initial state
  const supabase = getSupabaseClient();
  const beforeQuery = await supabase
    .from('content_metadata')
    .select('tweet_id, actual_impressions, actual_likes, actual_retweets, actual_replies, updated_at')
    .in('tweet_id', ['2009059568677212524', '2009053275002425623', '2009032840701223276'])
    .order('tweet_id');
  
  console.log('[METRICS_ONCE] 📊 Before scraping:');
  (beforeQuery.data || []).forEach((row: any) => {
    console.log(`   ${row.tweet_id}: impressions=${row.actual_impressions || 'NULL'} likes=${row.actual_likes || 'NULL'} retweets=${row.actual_retweets || 'NULL'} replies=${row.actual_replies || 'NULL'}`);
  });
  console.log('');
  
  // Run metrics scraper
  try {
    await metricsScraperJob();
    console.log('[METRICS_ONCE] ✅ Metrics scraper completed\n');
  } catch (error: any) {
    console.error(`[METRICS_ONCE] ❌ Metrics scraper failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
  
  // Wait a moment for DB writes to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Get updated state
  const afterQuery = await supabase
    .from('content_metadata')
    .select('tweet_id, actual_impressions, actual_likes, actual_retweets, actual_replies, updated_at')
    .in('tweet_id', ['2009059568677212524', '2009053275002425623', '2009032840701223276'])
    .order('tweet_id');
  
  console.log('[METRICS_ONCE] 📊 After scraping:');
  const updated: string[] = [];
  (afterQuery.data || []).forEach((row: any) => {
    const before = beforeQuery.data?.find((b: any) => b.tweet_id === row.tweet_id);
    const changed = !before || 
      before.actual_impressions !== row.actual_impressions ||
      before.actual_likes !== row.actual_likes ||
      before.actual_retweets !== row.actual_retweets ||
      before.actual_replies !== row.actual_replies;
    
    if (changed) {
      updated.push(row.tweet_id);
    }
    
    console.log(`   ${row.tweet_id}: impressions=${row.actual_impressions || 'NULL'} likes=${row.actual_likes || 'NULL'} retweets=${row.actual_retweets || 'NULL'} replies=${row.actual_replies || 'NULL'} ${changed ? '✅ UPDATED' : ''}`);
  });
  
  console.log(`\n[METRICS_ONCE] 📊 Summary: ${updated.length} tweet(s) updated`);
  if (updated.length > 0) {
    console.log(`   Updated tweet IDs: ${updated.join(', ')}`);
  }
  
  process.exit(0);
}

main().catch(console.error);


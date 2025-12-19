import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Get last 15 posts in last 2 hours
  const { data } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, tweet_id, thread_tweet_ids, posted_at, created_at')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })
    .limit(15);

  console.log('📊 POSTING RATE ANALYSIS (Last 2 Hours)\n');
  console.log('Last 15 posts:\n');
  
  data?.forEach((row, i) => {
    const type = row.decision_type;
    const tweetIds = row.thread_tweet_ids ? JSON.parse(row.thread_tweet_ids) : [];
    const count = tweetIds.length || 1;
    const ago = Math.round((Date.now() - new Date(row.posted_at).getTime()) / 60000);
    console.log(`${i+1}. ${type.toUpperCase()} (${count} tweets) - ${ago}m ago`);
    console.log(`   ID: ${row.decision_id.substring(0, 8)}...`);
    console.log(`   Tweet: ${row.tweet_id || 'NULL'}`);
  });

  // Count by type
  const singles = data?.filter(r => r.decision_type === 'single').length || 0;
  const threads = data?.filter(r => r.decision_type === 'thread').length || 0;
  const total = singles + threads;
  
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Summary: ${singles} singles, ${threads} threads`);
  console.log(`Thread rate: ${total > 0 ? ((threads / total) * 100).toFixed(0) : 0}%`);
  console.log(`Posting rate: ${total} posts in 2 hours = ${(total / 2).toFixed(1)} posts/hour`);
  
  if (threads / total > 0.20) {
    console.log(`\n🚨 WARNING: Thread rate is ${((threads / total) * 100).toFixed(0)}% (expected: ~15%)`);
  }
  
  if (total / 2 > 7) {
    console.log(`\n🚨 WARNING: Posting ${(total / 2).toFixed(1)} posts/hour (expected: ~6-7/hour max)`);
  }
}

main();


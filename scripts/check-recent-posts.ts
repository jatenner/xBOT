import { createClient } from '@supabase/supabase-js';
require('dotenv/config');

async function checkRecentPosts() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, thread_tweet_ids, decision_type, posted_at')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(20);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('\nLast 20 posted tweets:\n');
  data.forEach((row, i) => {
    const threadIds = row.thread_tweet_ids ? JSON.parse(row.thread_tweet_ids) : [];
    const classification = threadIds.length > 1 ? 'THREAD' : row.decision_type === 'reply' ? 'REPLY' : 'SINGLE';
    console.log(`${i + 1}. ${classification} - Tweet ID: ${row.tweet_id}`);
    if (threadIds.length > 1) {
      console.log(`   Thread IDs (${threadIds.length}): ${threadIds.slice(0, 3).join(', ')}${threadIds.length > 3 ? '...' : ''}`);
    }
    console.log(`   Posted: ${row.posted_at}`);
  });
}

checkRecentPosts().catch(console.error);

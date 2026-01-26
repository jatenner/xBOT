import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  const { data: recentTweets } = await supabase
    .from('content_metadata')
    .select('tweet_id, content, posted_at')
    .eq('decision_type', 'single')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(10);
  
  console.log('Recent root tweets from our account:');
  recentTweets?.forEach((t, i) => {
    console.log(`${i+1}. Tweet ID: ${t.tweet_id}`);
    console.log(`   URL: https://x.com/Signal_Synapse/status/${t.tweet_id}`);
    console.log(`   Posted: ${t.posted_at}`);
    console.log(`   Preview: ${(t.content || '').substring(0, 60)}...`);
    console.log('');
  });
  
  const { data: repliedTo } = await supabase
    .from('content_metadata')
    .select('target_tweet_id')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('target_tweet_id', 'is', null);
  
  const repliedIds = new Set(repliedTo?.map(r => r.target_tweet_id) || []);
  
  console.log('Checking which tweets we\'ve already replied to...');
  recentTweets?.forEach(t => {
    const alreadyReplied = repliedIds.has(t.tweet_id);
    console.log(`Tweet ${t.tweet_id}: ${alreadyReplied ? '❌ ALREADY REPLIED' : '✅ AVAILABLE'}`);
  });
  
  const available = recentTweets?.find(t => !repliedIds.has(t.tweet_id));
  if (available) {
    console.log(`\n✅ Use this tweet ID: ${available.tweet_id}`);
  } else {
    console.log('\n❌ All recent tweets already replied to. Need to find a different tweet.');
  }
}

main().catch(console.error);

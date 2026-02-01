import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('tweet_id, created_at, tweet_posted_at, is_root_tweet, target_in_reply_to_tweet_id, engagement_score')
    .order('created_at', { ascending: false })
    .limit(20);
  
  console.log('📊 Fresh opportunities (last 20):\n');
  opps?.forEach((opp, i) => {
    const age = Math.round((Date.now() - new Date(opp.created_at).getTime()) / 1000 / 60);
    const postedAge = opp.tweet_posted_at 
      ? Math.round((Date.now() - new Date(opp.tweet_posted_at).getTime()) / 1000 / 60)
      : 'N/A';
    const isRoot = opp.is_root_tweet || !opp.target_in_reply_to_tweet_id;
    console.log(`${i+1}. tweet_id=${opp.tweet_id}`);
    console.log(`   created=${age}m ago, posted=${postedAge}m ago, is_root=${isRoot}, engagement=${opp.engagement_score || 'N/A'}`);
  });
  
  // Check for recent evaluations
  const { data: evaluations } = await supabase
    .from('candidate_evaluations')
    .select('candidate_tweet_id, created_at, score')
    .order('created_at', { ascending: false })
    .limit(10);
  
  console.log('\n📊 Recent candidate evaluations (last 10):\n');
  evaluations?.forEach((evaluation, i) => {
    const age = Math.round((Date.now() - new Date(evaluation.created_at).getTime()) / 1000 / 60);
    console.log(`${i+1}. tweet_id=${evaluation.candidate_tweet_id} score=${evaluation.score} age=${age}m`);
  });
  
  // Check queue
  const { data: queue } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id, queued_at, priority_score')
    .order('queued_at', { ascending: false })
    .limit(10);
  
  console.log('\n📊 Queue status:\n');
  console.log(`   Total in queue: ${queue?.length || 0}`);
  queue?.forEach((q, i) => {
    const age = Math.round((Date.now() - new Date(q.queued_at).getTime()) / 1000 / 60);
    console.log(`${i+1}. tweet_id=${q.candidate_tweet_id} priority=${q.priority_score} age=${age}m`);
  });
}

main().catch(console.error);

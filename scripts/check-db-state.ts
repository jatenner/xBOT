import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index.js';

async function check() {
  const supabase = getSupabaseClient();
  
  // Check content_metadata for ANY decisions
  const { data: allDecisions, count: totalCount } = await supabase
    .from('content_metadata')
    .select('decision_type, status', { count: 'exact' })
    .limit(0);
  
  console.log(`\nTotal decisions in content_metadata: ${totalCount}`);
  
  // Check by type
  for (const type of ['reply', 'single', 'thread']) {
    const { count } = await supabase
      .from('content_metadata')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', type);
    
    console.log(`  ${type}: ${count}`);
  }
  
  // Check recent posted
  const { data: recentPosted } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, posted_at, tweet_id')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(10);
  
  console.log(`\nLast 10 posted (any type):`);
  if (recentPosted) {
    recentPosted.forEach(d => {
      console.log(`  ${d.decision_type} | ${d.tweet_id || 'NO_ID'} | ${d.posted_at}`);
    });
  }
  
  // Check reply_opportunities structure
  const { data: oppSample } = await supabase
    .from('reply_opportunities')
    .select('*')
    .limit(1)
    .single();
  
  console.log(`\nreply_opportunities columns:`);
  if (oppSample) {
    console.log(Object.keys(oppSample).join(', '));
  }
}

check();

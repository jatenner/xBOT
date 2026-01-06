/**
 * Check NEW replies (last 24h) for root violations
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function check() {
  getConfig();
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, root_tweet_id, target_tweet_id, target_in_reply_to_tweet_id, target_conversation_id, posted_at')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .not('tweet_id', 'is', null);

  const violations = data?.filter(v => 
    v.root_tweet_id !== v.target_tweet_id ||
    v.target_in_reply_to_tweet_id !== null ||
    (v.target_conversation_id !== null && v.target_conversation_id !== v.target_tweet_id)
  ) || [];

  console.log(`NEW replies (last 24h): ${data?.length || 0}`);
  console.log(`Root violations: ${violations.length}`);
  
  if (violations.length > 0) {
    console.log('\n⚠️ Found violations:');
    violations.slice(0, 10).forEach(v => {
      console.log(`  - ${v.decision_id.substring(0, 12)}... root=${v.root_tweet_id || 'NULL'} target=${v.target_tweet_id}`);
    });
  } else {
    console.log('✅ No root violations in NEW replies');
  }
  
  if (data && data.length > 0) {
    console.log('\nSample NEW replies:');
    data.slice(0, 5).forEach((r, i) => {
      console.log(`  ${i+1}. ${r.decision_id.substring(0, 12)}... root=${r.root_tweet_id || 'NULL'} target=${r.target_tweet_id} posted=${r.posted_at}`);
    });
  }
}

check().catch(console.error);


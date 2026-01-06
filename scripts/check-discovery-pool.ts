/**
 * Check discovery pool tier counts
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function check() {
  getConfig();
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('reply_opportunities')
    .select('like_count, view_count, tweet_posted_at, replied_to, target_tweet_id')
    .eq('replied_to', false)
    .gte('tweet_posted_at', new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString());

  const tierAplus = data?.filter(o => 
    (o.view_count && o.view_count >= 1000000) || 
    (o.like_count && o.like_count >= 100000)
  ).length || 0;

  const tier25k = data?.filter(o => 
    o.like_count && o.like_count >= 25000 && o.like_count < 100000
  ).length || 0;

  const tier10k = data?.filter(o => 
    o.like_count && o.like_count >= 10000 && o.like_count < 25000
  ).length || 0;

  console.log('Discovery pool (last 12h):');
  console.log(`  Total: ${data?.length || 0}`);
  console.log(`  Tier A+ (1M+ views OR 100K+ likes): ${tierAplus}`);
  console.log(`  Tier 25K+ (25K-100K likes): ${tier25k}`);
  console.log(`  Tier 10K+ (10K-25K likes): ${tier10k}`);
  
  if (data && data.length > 0) {
    console.log('\nSample opportunities:');
    data.slice(0, 5).forEach((o, i) => {
      console.log(`  ${i+1}. tweet_id=${o.target_tweet_id?.substring(0, 10)}... likes=${o.like_count || 0} views=${o.view_count || 0}`);
    });
  }
}

check().catch(console.error);



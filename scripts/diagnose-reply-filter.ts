import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function diagnoseReplyFilter() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🎯 DIAGNOSIS: WHY ONLY 1 REPLY/HOUR?');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const { data: opportunities, error } = await supabase
    .from('reply_opportunities')
    .select('target_username, like_count, health_relevance_score, health_category, status')
    .eq('status', 'pending')
    .order('like_count', { ascending: false });

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  const MIN_TWEET_LIKES = 5000; // Current setting
  const passing = opportunities.filter(o => (o.like_count || 0) >= MIN_TWEET_LIKES);
  const failing = opportunities.filter(o => (o.like_count || 0) < MIN_TWEET_LIKES);
  
  console.log(`📊 CURRENT FILTER: REPLY_MIN_TWEET_LIKES = ${MIN_TWEET_LIKES}\n`);
  console.log(`✅ Passing filter: ${passing.length}/${opportunities.length}`);
  console.log(`❌ Failing filter: ${failing.length}/${opportunities.length}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (failing.length > 0) {
    console.log('❌ FILTERED OUT (like_count < 5000):\n');
    failing.slice(0, 15).forEach(o => {
      console.log(`   @${o.target_username}: ${o.like_count || 0} likes (category: ${o.health_category})`);
    });
    console.log('');
  }
  
  if (passing.length > 0) {
    console.log('✅ WOULD PASS FILTER (like_count >= 5000):\n');
    passing.forEach(o => {
      console.log(`   @${o.target_username}: ${o.like_count || 0} likes (category: ${o.health_category})`);
    });
    console.log('');
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('💡 SOLUTION: Lower REPLY_MIN_TWEET_LIKES\n');
  
  const thresholds = [2000, 1000, 500, 100];
  for (const threshold of thresholds) {
    const wouldPass = opportunities.filter(o => (o.like_count || 0) >= threshold).length;
    console.log(`   If REPLY_MIN_TWEET_LIKES = ${threshold.toString().padStart(4)} → ${wouldPass}/${opportunities.length} would pass`);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🎯 RECOMMENDED FIX');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Set: railway variables --service xBOT --set "REPLY_MIN_TWEET_LIKES=1000"\n');
  console.log('This will allow tweets with 1000+ likes to pass, giving you');
  console.log('enough opportunities to post 4 replies/hour.\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

diagnoseReplyFilter().catch(console.error);


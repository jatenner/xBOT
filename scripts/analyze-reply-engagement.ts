import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n📊 REPLY ENGAGEMENT ANALYSIS\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // Get replies with metrics
  const { data: replies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, target_username, content, posted_at, actual_likes, actual_retweets, actual_replies, actual_impressions')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false })
    .limit(20);

  if (!replies || replies.length === 0) {
    console.log('❌ No replies found');
    return;
  }

  // Calculate metrics
  const withMetrics = replies.filter(r => r.actual_likes !== null || r.actual_impressions !== null);
  const avgLikes = withMetrics.length > 0 
    ? withMetrics.reduce((sum, r) => sum + (r.actual_likes || 0), 0) / withMetrics.length 
    : 0;
  const avgViews = withMetrics.length > 0 
    ? withMetrics.reduce((sum, r) => sum + (r.actual_impressions || 0), 0) / withMetrics.length 
    : 0;
  const avgRetweets = withMetrics.length > 0 
    ? withMetrics.reduce((sum, r) => sum + (r.actual_retweets || 0), 0) / withMetrics.length 
    : 0;

  console.log(`Total replies analyzed: ${replies.length}`);
  console.log(`Replies with metrics: ${withMetrics.length}\n`);
  
  console.log(`📈 AVERAGE ENGAGEMENT:`);
  console.log(`   Views: ${avgViews.toFixed(0)}`);
  console.log(`   Likes: ${avgLikes.toFixed(1)}`);
  console.log(`   Retweets: ${avgRetweets.toFixed(1)}`);
  console.log(`   Replies: ${(withMetrics.reduce((sum, r) => sum + (r.actual_replies || 0), 0) / withMetrics.length).toFixed(1)}\n`);

  // Check for low engagement (red flag)
  if (avgLikes < 1) {
    console.log(`🚨 CRITICAL: Avg likes < 1 - replies are getting NO engagement`);
  } else if (avgLikes < 5) {
    console.log(`⚠️  WARNING: Avg likes < 5 - low engagement`);
  } else {
    console.log(`✅ Good engagement (${avgLikes.toFixed(1)} avg likes)`);
  }

  // Show best and worst performers
  const sorted = [...withMetrics].sort((a, b) => (b.actual_likes || 0) - (a.actual_likes || 0));
  
  console.log(`\n🏆 TOP 5 PERFORMING REPLIES:\n`);
  sorted.slice(0, 5).forEach((r, i) => {
    const ago = Math.round((Date.now() - new Date(r.posted_at).getTime()) / 60000);
    console.log(`${i+1}. @${r.target_username} - ${r.actual_likes || 0} likes, ${r.actual_impressions || 0} views (${ago}m ago)`);
    console.log(`   "${r.content.substring(0, 80)}..."`);
    console.log(`   https://x.com/SignalAndSynapse/status/${r.tweet_id}\n`);
  });

  console.log(`\n💀 WORST 5 PERFORMING REPLIES:\n`);
  sorted.slice(-5).reverse().forEach((r, i) => {
    const ago = Math.round((Date.now() - new Date(r.posted_at).getTime()) / 60000);
    console.log(`${i+1}. @${r.target_username} - ${r.actual_likes || 0} likes, ${r.actual_impressions || 0} views (${ago}m ago)`);
    console.log(`   "${r.content.substring(0, 80)}..."`);
    console.log(`   https://x.com/SignalAndSynapse/status/${r.tweet_id}\n`);
  });

  console.log('═══════════════════════════════════════════════════════\n');
}

main();


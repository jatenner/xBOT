/**
 * 📊 FOLLOWER GROWTH ANALYSIS
 * 
 * Analyzes actual follower growth data to create realistic projections
 */

import { getSupabaseClient } from '../src/db';

async function analyzeFollowerGrowth() {
  const supabase = getSupabaseClient();

  console.log('📊 ANALYZING FOLLOWER GROWTH DATA...\n');

  // 1. Check follower snapshots (if available)
  console.log('1️⃣ Follower Snapshots (last 30 days):');
  const { data: snapshots, error: snapError } = await supabase
    .from('follower_snapshots')
    .select('timestamp, follower_count')
    .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('timestamp', { ascending: false })
    .limit(30);

  if (snapError) {
    console.log(`   ⚠️ No follower_snapshots table or error: ${snapError.message}`);
  } else if (snapshots && snapshots.length > 0) {
    const first = snapshots[snapshots.length - 1];
    const last = snapshots[0];
    const totalGrowth = last.follower_count - first.follower_count;
    const days = Math.max(1, Math.floor((new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60 * 60 * 24)));
    const dailyAvg = totalGrowth / days;

    console.log(`   • First snapshot: ${first.follower_count} followers (${new Date(first.timestamp).toLocaleDateString()})`);
    console.log(`   • Last snapshot: ${last.follower_count} followers (${new Date(last.timestamp).toLocaleDateString()})`);
    console.log(`   • Total growth: ${totalGrowth > 0 ? '+' : ''}${totalGrowth} followers`);
    console.log(`   • Daily average: ${dailyAvg > 0 ? '+' : ''}${dailyAvg.toFixed(2)} followers/day`);
    console.log(`   • Days tracked: ${days}`);
  } else {
    console.log('   ⚠️ No follower snapshots found');
  }

  // 2. Check posts with follower attribution
  console.log('\n2️⃣ Posts with Follower Attribution (last 30 days):');
  const { data: posts, error: postsError } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at, followers_gained, decision_type, actual_impressions, actual_likes, profile_clicks')
    .eq('status', 'posted')
    .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });

  if (postsError) {
    console.log(`   ⚠️ Error: ${postsError.message}`);
  } else if (posts && posts.length > 0) {
    const postsWithFollowers = posts.filter(p => p.followers_gained && p.followers_gained > 0);
    const totalFollowers = posts.reduce((sum, p) => sum + (p.followers_gained || 0), 0);
    const avgPerPost = totalFollowers / posts.length;
    const avgPerPostWithFollowers = postsWithFollowers.length > 0 
      ? totalFollowers / postsWithFollowers.length 
      : 0;
    const conversionRate = (postsWithFollowers.length / posts.length) * 100;

    console.log(`   • Total posts: ${posts.length}`);
    console.log(`   • Posts with followers: ${postsWithFollowers.length} (${conversionRate.toFixed(1)}%)`);
    console.log(`   • Total followers gained: ${totalFollowers > 0 ? '+' : ''}${totalFollowers}`);
    console.log(`   • Avg followers/post: ${avgPerPost.toFixed(2)}`);
    console.log(`   • Avg followers/post (when >0): ${avgPerPostWithFollowers.toFixed(2)}`);

    // Daily breakdown
    const dailyStats = new Map<string, { posts: number; followers: number }>();
    posts.forEach(post => {
      const date = new Date(post.posted_at).toISOString().split('T')[0];
      const existing = dailyStats.get(date) || { posts: 0, followers: 0 };
      dailyStats.set(date, {
        posts: existing.posts + 1,
        followers: existing.followers + (post.followers_gained || 0)
      });
    });

    const dailyAverages = Array.from(dailyStats.values());
    const avgPostsPerDay = dailyAverages.reduce((sum, d) => sum + d.posts, 0) / dailyAverages.length;
    const avgFollowersPerDay = dailyAverages.reduce((sum, d) => sum + d.followers, 0) / dailyAverages.length;

    console.log(`   • Avg posts/day: ${avgPostsPerDay.toFixed(1)}`);
    console.log(`   • Avg followers/day: ${avgFollowersPerDay.toFixed(2)}`);
  } else {
    console.log('   ⚠️ No posts found in last 30 days');
  }

  // 3. Profile visit → follow conversion
  console.log('\n3️⃣ Profile Visit → Follow Conversion:');
  const { data: profileData, error: profileError } = await supabase
    .from('content_metadata')
    .select('profile_clicks, followers_gained')
    .eq('status', 'posted')
    .not('profile_clicks', 'is', null)
    .gt('profile_clicks', 0)
    .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (profileError) {
    console.log(`   ⚠️ Error: ${profileError.message}`);
  } else if (profileData && profileData.length > 0) {
    const totalClicks = profileData.reduce((sum, p) => sum + (p.profile_clicks || 0), 0);
    const totalFollowers = profileData.reduce((sum, p) => sum + (p.followers_gained || 0), 0);
    const conversionRate = totalClicks > 0 ? (totalFollowers / totalClicks) * 100 : 0;
    const avgClicks = totalClicks / profileData.length;
    const avgFollowers = totalFollowers / profileData.length;

    console.log(`   • Posts with profile clicks: ${profileData.length}`);
    console.log(`   • Total profile clicks: ${totalClicks}`);
    console.log(`   • Total followers from clicks: ${totalFollowers}`);
    console.log(`   • Conversion rate: ${conversionRate.toFixed(2)}%`);
    console.log(`   • Avg clicks/post: ${avgClicks.toFixed(1)}`);
    console.log(`   • Avg followers/post: ${avgFollowers.toFixed(2)}`);
  } else {
    console.log('   ⚠️ No profile click data available');
  }

  // 4. Reply → follow conversion
  console.log('\n4️⃣ Reply → Follow Conversion:');
  const { data: replies, error: repliesError } = await supabase
    .from('content_metadata')
    .select('followers_gained, posted_at')
    .eq('status', 'posted')
    .eq('decision_type', 'reply')
    .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (repliesError) {
    console.log(`   ⚠️ Error: ${repliesError.message}`);
  } else if (replies && replies.length > 0) {
    const repliesWithFollowers = replies.filter(r => r.followers_gained && r.followers_gained > 0);
    const totalFollowers = replies.reduce((sum, r) => sum + (r.followers_gained || 0), 0);
    const conversionRate = (repliesWithFollowers.length / replies.length) * 100;
    const avgPerReply = totalFollowers / replies.length;
    const avgPerReplyWithFollowers = repliesWithFollowers.length > 0 
      ? totalFollowers / repliesWithFollowers.length 
      : 0;

    console.log(`   • Total replies: ${replies.length}`);
    console.log(`   • Replies with followers: ${repliesWithFollowers.length} (${conversionRate.toFixed(1)}%)`);
    console.log(`   • Total followers from replies: ${totalFollowers > 0 ? '+' : ''}${totalFollowers}`);
    console.log(`   • Avg followers/reply: ${avgPerReply.toFixed(2)}`);
    console.log(`   • Avg followers/reply (when >0): ${avgPerReplyWithFollowers.toFixed(2)}`);
  } else {
    console.log('   ⚠️ No replies found in last 30 days');
  }

  // 5. Projections based on actual data
  console.log('\n5️⃣ REALISTIC PROJECTIONS:');
  console.log('   (Based on actual data above)');
  console.log('\n   To get accurate projections, we need:');
  console.log('   • Current followers/day baseline');
  console.log('   • Current profile conversion rate');
  console.log('   • Current reply conversion rate');
  console.log('   • Current posting frequency');
  console.log('\n   Then we can calculate:');
  console.log('   • Expected improvement from Phase 1');
  console.log('   • Expected improvement from full implementation');

  console.log('\n✅ Analysis complete!');
}

// Run if called directly
if (require.main === module) {
  analyzeFollowerGrowth()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Error:', error);
      process.exit(1);
    });
}

export { analyzeFollowerGrowth };


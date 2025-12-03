import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkRateLimitDiscrepancy() {
  const { getSupabaseClient } = await import('../src/db/index');
  const { getConfig } = await import('../src/config/config');
  const supabase = getSupabaseClient();
  const config = getConfig();
  
  console.log('🔍 CHECKING RATE LIMIT DISCREPANCY\n');
  console.log('='.repeat(70));
  
  // Check config value
  const maxPostsPerHourRaw = Number(config.MAX_POSTS_PER_HOUR ?? 1);
  const maxPostsPerHour = Number.isFinite(maxPostsPerHourRaw) ? maxPostsPerHourRaw : 1;
  
  console.log(`\n1️⃣ CONFIG VALUES:`);
  console.log(`   MAX_POSTS_PER_HOUR from config: ${config.MAX_POSTS_PER_HOUR ?? 'undefined'}`);
  console.log(`   maxPostsPerHourRaw: ${maxPostsPerHourRaw}`);
  console.log(`   maxPostsPerHour (final): ${maxPostsPerHour}`);
  console.log(`   process.env.MAX_POSTS_PER_HOUR: ${process.env.MAX_POSTS_PER_HOUR || 'not set'}`);
  
  // Check what the initial rate limit check would return
  console.log(`\n2️⃣ INITIAL RATE LIMIT CHECK (checkPostingRateLimits):`);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // This is what checkPostingRateLimits does (line 558-564)
  const { count: initialCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .in('decision_type', ['single', 'thread'])
    .in('status', ['posted', 'failed'])
    .not('tweet_id', 'is', null)
    .gte('posted_at', oneHourAgo);
  
  console.log(`   Posts counted: ${initialCount || 0}`);
  console.log(`   Limit: ${maxPostsPerHour}`);
  console.log(`   Would allow: ${(initialCount || 0) < maxPostsPerHour ? 'YES ✅' : 'NO ❌'}`);
  
  // Check what the loop rate limit check would return
  console.log(`\n3️⃣ LOOP RATE LIMIT CHECK (inside processPostingQueue loop):`);
  
  // This is what the loop does (line 272-277)
  const { data: recentContent } = await supabase
    .from('content_metadata')
    .select('decision_type')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo);
  
  const postsThisHour = (recentContent || []).length;
  const contentPostedThisCycle = 0; // At start of loop
  const totalPostsThisHour = postsThisHour + contentPostedThisCycle;
  const thisPostCount = 1; // Thread or single = 1 post
  const wouldExceed = totalPostsThisHour + thisPostCount > maxPostsPerHour;
  
  console.log(`   Posts from DB: ${postsThisHour}`);
  console.log(`   Posts this cycle: ${contentPostedThisCycle}`);
  console.log(`   Total posts this hour: ${totalPostsThisHour}`);
  console.log(`   This post would add: ${thisPostCount}`);
  console.log(`   Would exceed limit: ${wouldExceed ? 'YES ❌' : 'NO ✅'}`);
  console.log(`   Calculation: ${totalPostsThisHour} + ${thisPostCount} > ${maxPostsPerHour} = ${wouldExceed}`);
  
  // Key difference: Loop check doesn't exclude NULL tweet_ids!
  console.log(`\n4️⃣ KEY DIFFERENCE:`);
  console.log(`   Initial check: Excludes NULL tweet_ids (line 563)`);
  console.log(`   Loop check: Includes ALL posts with status='posted' (line 276)`);
  console.log(`   ⚠️ If there are posts with NULL tweet_id, counts will differ!`);
  
  // Check for NULL tweet_id posts
  const { data: nullTweetIdPosts } = await supabase
    .from('content_metadata')
    .select('decision_id, posted_at')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .is('tweet_id', null)
    .gte('posted_at', oneHourAgo);
  
  if (nullTweetIdPosts && nullTweetIdPosts.length > 0) {
    console.log(`\n   🚨 FOUND ${nullTweetIdPosts.length} POSTS WITH NULL TWEET_ID:`);
    nullTweetIdPosts.forEach((p: any) => {
      const minsAgo = Math.round((Date.now() - new Date(p.posted_at).getTime()) / 60000);
      console.log(`   - ${p.decision_id.substring(0, 8)}... (posted ${minsAgo}min ago)`);
    });
    console.log(`\n   💡 ROOT CAUSE: Loop check counts NULL tweet_id posts, causing rate limit!`);
    console.log(`   💡 Initial check excludes them, so it passes`);
    console.log(`   💡 But loop check includes them, so it blocks!`);
  } else {
    console.log(`\n   ✅ No NULL tweet_id posts found`);
  }
  
  console.log('\n' + '='.repeat(70));
}

checkRateLimitDiscrepancy().catch(console.error);


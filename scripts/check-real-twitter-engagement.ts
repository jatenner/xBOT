import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function checkRealEngagement() {
  const supabase = getSupabaseClient();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 REAL TWITTER ENGAGEMENT CHECK');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // First check what decision types exist
  const { data: typeCheck } = await supabase
    .from('posted_decisions')
    .select('decision_type')
    .limit(100);
  
  const types = [...new Set(typeCheck?.map(d => d.decision_type))];
  console.log(`Decision types in database: ${types.join(', ')}\n`);
  
  // Get recent posted decisions with their engagement (ALL types)
  const { data: posts } = await supabase
    .from('posted_decisions')
    .select('*')
    .order('posted_at', { ascending: false })
    .limit(20);
  
  if (!posts || posts.length === 0) {
    console.log('❌ No posted content found');
    return;
  }
  
  console.log(`Found ${posts.length} recent posts\n`);
  
  // For each post, get engagement from outcomes table
  let totalLikes = 0;
  let totalRetweets = 0;
  let totalReplies = 0;
  let totalViews = 0;
  let postsWithData = 0;
  
  for (const post of posts) {
    const { data: engagement } = await supabase
      .from('outcomes')
      .select('*')
      .eq('tweet_id', post.tweet_id)
      .order('collected_at', { ascending: false })
      .limit(1)
      .single();
    
    const postedTime = new Date(post.posted_at);
    const hoursAgo = Math.round((Date.now() - postedTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
    
    console.log(`Tweet: ${post.tweet_id}`);
    console.log(`  Posted: ${hoursAgo}h ago`);
    console.log(`  Content: ${post.content?.substring(0, 60)}...`);
    
    if (engagement) {
      postsWithData++;
      const likes = engagement.likes || 0;
      const retweets = engagement.retweets || 0;
      const replies = engagement.replies || 0;
      const views = engagement.views || 0;
      
      totalLikes += likes;
      totalRetweets += retweets;
      totalReplies += replies;
      totalViews += views;
      
      console.log(`  📊 Likes: ${likes} | RTs: ${retweets} | Replies: ${replies} | Views: ${views}`);
      console.log(`  🔄 Last collected: ${new Date(engagement.collected_at).toLocaleString()}`);
    } else {
      console.log(`  ⚠️  No engagement data collected yet`);
    }
    console.log('');
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📈 AGGREGATE STATS (Last 20 posts):');
  console.log(`   Posts with engagement data: ${postsWithData}/${posts.length}`);
  console.log(`   Total Likes: ${totalLikes}`);
  console.log(`   Total Retweets: ${totalRetweets}`);
  console.log(`   Total Replies: ${totalReplies}`);
  console.log(`   Total Views: ${totalViews}`);
  
  if (postsWithData > 0) {
    console.log(`\n   📊 Averages:`);
    console.log(`   Avg Likes/Post: ${Math.round(totalLikes / postsWithData * 10) / 10}`);
    console.log(`   Avg RTs/Post: ${Math.round(totalRetweets / postsWithData * 10) / 10}`);
    console.log(`   Avg Replies/Post: ${Math.round(totalReplies / postsWithData * 10) / 10}`);
    console.log(`   Avg Views/Post: ${Math.round(totalViews / postsWithData)}`);
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Check data collection status
  if (postsWithData < posts.length * 0.5) {
    console.log('🚨 WARNING: Less than 50% of posts have engagement data!');
    console.log('   → Metrics scraper may be failing');
    console.log('   → Check metricsScraperJob logs\n');
  } else if (postsWithData === posts.length) {
    console.log('✅ All posts have engagement data - scraper working!\n');
  }
}

checkRealEngagement().catch(console.error);


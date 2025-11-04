/**
 * 🔍 COMPREHENSIVE ENGAGEMENT DATA DIAGNOSTIC
 * Verifies what data is being collected and stored
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function diagnoseEngagementData() {
  const supabase = getSupabaseClient();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔍 ENGAGEMENT DATA DIAGNOSTIC');
  console.log('═══════════════════════════════════════════════════════════\n');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. CHECK RECENT POSTS (Last 10)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('📝 SECTION 1: RECENT POSTS FROM DATABASE\n');
  
  const { data: recentPosts, error: postsError } = await supabase
    .from('posted_decisions')
    .select('*')
    .eq('decision_type', 'content') // Only main posts, not replies
    .order('posted_at', { ascending: false })
    .limit(10);

  if (postsError) {
    console.error('❌ Error fetching posts:', postsError.message);
  } else if (!recentPosts || recentPosts.length === 0) {
    console.log('⚠️  NO POSTS FOUND in posted_decisions table!');
  } else {
    console.log(`✅ Found ${recentPosts.length} recent posts:\n`);
    recentPosts.forEach((post, idx) => {
      const postedTime = new Date(post.posted_at);
      const hoursAgo = Math.round((Date.now() - postedTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
      
      console.log(`${idx + 1}. Tweet ID: ${post.tweet_id || 'NULL'}`);
      console.log(`   Posted: ${postedTime.toLocaleString()} (${hoursAgo}h ago)`);
      console.log(`   Type: ${post.decision_type}`);
      console.log(`   Content Preview: ${post.content?.substring(0, 60)}...`);
      console.log('');
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. CHECK ENGAGEMENT DATA (outcomes table)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SECTION 2: ENGAGEMENT METRICS FROM DATABASE\n');
  
  const { data: outcomes, error: outcomesError } = await supabase
    .from('outcomes')
    .select('*')
    .order('collected_at', { ascending: false })
    .limit(10);

  if (outcomesError) {
    console.error('❌ Error fetching outcomes:', outcomesError.message);
  } else if (!outcomes || outcomes.length === 0) {
    console.log('⚠️  NO ENGAGEMENT DATA in outcomes table!');
    console.log('   → Metrics scraper may not be running');
    console.log('   → Or data collection pipeline is broken\n');
  } else {
    console.log(`✅ Found ${outcomes.length} engagement records:\n`);
    
    let totalLikes = 0;
    let totalRetweets = 0;
    let totalReplies = 0;
    let totalViews = 0;
    
    outcomes.forEach((outcome, idx) => {
      const likes = outcome.likes || 0;
      const retweets = outcome.retweets || 0;
      const replies = outcome.replies || 0;
      const views = outcome.views || 0;
      
      totalLikes += likes;
      totalRetweets += retweets;
      totalReplies += replies;
      totalViews += views;
      
      console.log(`${idx + 1}. Tweet: ${outcome.tweet_id}`);
      console.log(`   📊 Likes: ${likes} | RTs: ${retweets} | Replies: ${replies} | Views: ${views}`);
      console.log(`   📅 Collected: ${new Date(outcome.collected_at).toLocaleString()}`);
      console.log(`   🔄 Source: ${outcome.data_source || 'unknown'}`);
      console.log(`   🎯 Simulated: ${outcome.simulated ? 'YES' : 'NO'}`);
      console.log('');
    });
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📈 AGGREGATE STATS (Last 10 posts):');
    console.log(`   Total Likes: ${totalLikes}`);
    console.log(`   Total Retweets: ${totalRetweets}`);
    console.log(`   Total Replies: ${totalReplies}`);
    console.log(`   Total Views: ${totalViews}`);
    console.log(`   Avg Likes/Post: ${Math.round(totalLikes / outcomes.length)}`);
    console.log(`   Avg RTs/Post: ${Math.round(totalRetweets / outcomes.length * 10) / 10}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. CHECK REPLIES vs POSTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💬 SECTION 3: POSTS vs REPLIES BREAKDOWN\n');
  
  const { data: allDecisions } = await supabase
    .from('posted_decisions')
    .select('decision_type, posted_at')
    .order('posted_at', { ascending: false })
    .limit(50);

  if (allDecisions && allDecisions.length > 0) {
    const posts = allDecisions.filter(d => d.decision_type === 'content' || d.decision_type === 'single' || d.decision_type === 'thread');
    const replies = allDecisions.filter(d => d.decision_type === 'reply');
    
    console.log(`📊 Last 50 decisions:`);
    console.log(`   Main Posts: ${posts.length}`);
    console.log(`   Replies: ${replies.length}`);
    console.log(`   Total: ${allDecisions.length}\n`);
    
    // Calculate posting rate
    if (allDecisions.length > 1) {
      const oldest = new Date(allDecisions[allDecisions.length - 1].posted_at);
      const newest = new Date(allDecisions[0].posted_at);
      const hoursDiff = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60);
      
      const postsPerHour = posts.length / hoursDiff;
      const repliesPerHour = replies.length / hoursDiff;
      
      console.log(`⏱️  Posting Rate (last ${Math.round(hoursDiff)}h):`);
      console.log(`   Main Posts: ${postsPerHour.toFixed(1)}/hour`);
      console.log(`   Replies: ${repliesPerHour.toFixed(1)}/hour`);
      console.log(`   Total: ${(postsPerHour + repliesPerHour).toFixed(1)}/hour\n`);
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. DATA COLLECTION HEALTH CHECK
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏥 SECTION 4: DATA COLLECTION HEALTH\n');
  
  // Check if we have posts without engagement data
  if (recentPosts && recentPosts.length > 0 && outcomes) {
    const postsWithData = recentPosts.filter(post => 
      outcomes.some(o => o.tweet_id === post.tweet_id)
    );
    
    const coverage = (postsWithData.length / recentPosts.length) * 100;
    
    console.log(`📊 Data Coverage:`);
    console.log(`   Posts with engagement data: ${postsWithData.length}/${recentPosts.length}`);
    console.log(`   Coverage: ${Math.round(coverage)}%`);
    
    if (coverage < 50) {
      console.log(`   ⚠️  WARNING: Less than 50% coverage!`);
      console.log(`   → Metrics scraper may be failing`);
      console.log(`   → Check metricsScraperJob logs\n`);
    } else if (coverage < 100) {
      console.log(`   ⚠️  NOTICE: Some posts missing engagement data`);
      console.log(`   → This is normal for very recent posts\n`);
    } else {
      console.log(`   ✅ Excellent coverage!\n`);
    }
    
    // Show posts without data
    const postsWithoutData = recentPosts.filter(post => 
      !outcomes.some(o => o.tweet_id === post.tweet_id)
    );
    
    if (postsWithoutData.length > 0) {
      console.log(`📝 Posts without engagement data:`);
      postsWithoutData.forEach(post => {
        const postedTime = new Date(post.posted_at);
        const hoursAgo = Math.round((Date.now() - postedTime.getTime()) / (1000 * 60 * 60) * 10) / 10;
        console.log(`   • ${post.tweet_id || 'NULL ID'} (posted ${hoursAgo}h ago)`);
      });
      console.log('');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. DIAGNOSTIC SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 DIAGNOSTIC SUMMARY\n');
  
  const issues: string[] = [];
  const status: string[] = [];
  
  if (!recentPosts || recentPosts.length === 0) {
    issues.push('❌ No posts found in database');
  } else {
    status.push(`✅ ${recentPosts.length} recent posts found`);
  }
  
  if (!outcomes || outcomes.length === 0) {
    issues.push('❌ No engagement data being collected');
  } else {
    status.push(`✅ ${outcomes.length} engagement records found`);
  }
  
  if (recentPosts && outcomes) {
    const coverage = (recentPosts.filter(p => 
      outcomes.some(o => o.tweet_id === p.tweet_id)
    ).length / recentPosts.length) * 100;
    
    if (coverage < 50) {
      issues.push(`⚠️  Low data coverage: ${Math.round(coverage)}%`);
    } else {
      status.push(`✅ Data coverage: ${Math.round(coverage)}%`);
    }
  }
  
  if (status.length > 0) {
    console.log('Status:');
    status.forEach(s => console.log(`  ${s}`));
    console.log('');
  }
  
  if (issues.length > 0) {
    console.log('Issues Found:');
    issues.forEach(i => console.log(`  ${i}`));
    console.log('');
  }
  
  if (issues.length === 0) {
    console.log('✅ All systems appear to be functioning correctly!\n');
  } else {
    console.log('⚠️  Data collection issues detected - needs investigation\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
}

diagnoseEngagementData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Diagnostic failed:', error);
    process.exit(1);
  });


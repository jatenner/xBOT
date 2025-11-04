/**
 * DIAGNOSTIC SCRIPT: Analyze posting issues
 * 
 * Checks:
 * 1. How many posts/hour
 * 2. Thread vs single breakdown  
 * 3. Thread content flow
 * 4. Self-mentions in threads
 */

import { getSupabaseClient } from '../src/db/index';

async function diagnosePostingIssues() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 DIAGNOSTIC: Analyzing last hour of posting...\n');
  
  // Get last hour of posts
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const { data: recentPosts, error } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('status', 'posted')
    .gte('posted_at', oneHourAgo.toISOString())
    .order('posted_at', { ascending: false });
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 TOTAL POSTS LAST HOUR: ${recentPosts?.length || 0}\n`);
  
  // Break down by type
  const threads = recentPosts?.filter(p => p.decision_type === 'thread') || [];
  const singles = recentPosts?.filter(p => p.decision_type === 'single') || [];
  const replies = recentPosts?.filter(p => p.decision_type === 'reply') || [];
  
  console.log(`📝 BREAKDOWN:`);
  console.log(`   Threads: ${threads.length}`);
  console.log(`   Singles: ${singles.length}`);
  console.log(`   Replies: ${replies.length}\n`);
  
  // Count actual tweets (threads have multiple parts)
  let actualTweetCount = singles.length + replies.length;
  
  console.log(`🧵 THREAD ANALYSIS:`);
  for (const thread of threads) {
    const parts = thread.thread_parts?.length || 5;
    actualTweetCount += parts;
    console.log(`   Thread ${thread.decision_id.substring(0, 8)}: ${parts} tweets`);
    console.log(`      Topic: ${thread.topic_cluster || 'unknown'}`);
    console.log(`      Content preview: ${(thread.content || '').substring(0, 60)}...`);
    
    // Check for self-mentions
    if (thread.content?.includes('@SignalAndSynapse') || thread.content?.includes('@Signal_Synapse')) {
      console.log(`      ⚠️ SELF-MENTION DETECTED!`);
    }
    console.log('');
  }
  
  console.log(`\n📊 ACTUAL TWEET COUNT: ${actualTweetCount} tweets`);
  console.log(`   Expected limit: 6 tweets/hour (2 content + 4 replies)`);
  console.log(`   ${actualTweetCount > 6 ? '❌ OVER LIMIT' : '✅ Within limit'}\n`);
  
  // Check thread content flow
  if (threads.length > 1) {
    console.log(`🔍 THREAD FLOW CHECK:`);
    const topics = threads.map(t => t.topic_cluster);
    const uniqueTopics = new Set(topics);
    console.log(`   Topics in threads: ${Array.from(uniqueTopics).join(', ')}`);
    console.log(`   ${uniqueTopics.size > 1 ? '⚠️ Multiple topics - may lack flow' : '✅ Consistent topic'}\n`);
  }
  
  // Show recent posts with timestamps
  console.log(`📅 RECENT POSTS (last 10):`);
  const recent = recentPosts?.slice(0, 10) || [];
  for (const post of recent) {
    const posted = new Date(post.posted_at);
    const minsAgo = Math.round((Date.now() - posted.getTime()) / 60000);
    console.log(`   ${minsAgo}m ago: ${post.decision_type} - "${(post.content || '').substring(0, 50)}..."`);
  }
  
  process.exit(0);
}

diagnosePostingIssues().catch(console.error);


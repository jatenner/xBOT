import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigate() {
  console.log('🔍 INVESTIGATING POSTING ISSUES\n');
  
  // ISSUE 1: Check posts in last hour
  console.log('━'.repeat(60));
  console.log('1️⃣  POSTING RATE VIOLATION CHECK');
  console.log('━'.repeat(60));
  
  const { data: recentPosts, error: postsError } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, structure_type, status, posted_at, tweet_id, content')
    .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });
  
  if (postsError) {
    console.error('❌ Error fetching recent posts:', postsError);
  } else {
    console.log(`\n✅ Found ${recentPosts?.length || 0} posts in last hour:`);
    recentPosts?.forEach((post, i) => {
      const postedTime = new Date(post.posted_at);
      const minutesAgo = Math.floor((Date.now() - postedTime.getTime()) / 60000);
      console.log(`\n${i + 1}. ${post.decision_type} (${post.structure_type})`);
      console.log(`   Tweet ID: ${post.tweet_id || 'NULL'}`);
      console.log(`   Posted: ${minutesAgo}min ago`);
      console.log(`   Status: ${post.status}`);
      console.log(`   Content: ${post.content?.substring(0, 80)}...`);
    });
    
    const postsOnly = recentPosts?.filter(p => p.decision_type === 'post') || [];
    const repliesOnly = recentPosts?.filter(p => p.decision_type === 'reply') || [];
    console.log(`\n📊 RATE SUMMARY: ${postsOnly.length} posts, ${repliesOnly.length} replies in last hour`);
    console.log(`   ⚠️  LIMIT: Should be max 2 posts/hour, 4 replies/hour`);
    if (postsOnly.length > 2) {
      console.log(`   🚨 VIOLATION: ${postsOnly.length} posts > 2 limit!`);
    }
  }
  
  // ISSUE 2: Check specific tweet with thread emoji
  console.log('\n\n' + '━'.repeat(60));
  console.log('2️⃣  THREAD EMOJI ON SINGLE TWEET');
  console.log('━'.repeat(60));
  
  const { data: threadEmojiPost, error: threadError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', '2005828901415551455')
    .single();
  
  if (threadError) {
    console.error('❌ Error fetching thread emoji post:', threadError);
  } else if (threadEmojiPost) {
    console.log(`\n✅ Found tweet 2005828901415551455:`);
    console.log(`   Structure: ${threadEmojiPost.structure_type}`);
    console.log(`   Content: ${threadEmojiPost.content}`);
    console.log(`   Thread parts: ${threadEmojiPost.thread_parts ? JSON.stringify(threadEmojiPost.thread_parts).substring(0, 100) : 'NULL'}`);
    console.log(`   Generator: ${threadEmojiPost.generator_name || 'NULL'}`);
    
    if (threadEmojiPost.content?.includes('🧵') && threadEmojiPost.structure_type !== 'thread') {
      console.log(`   🚨 ISSUE: Contains thread emoji but structure_type = ${threadEmojiPost.structure_type}`);
    }
  }
  
  // ISSUE 3: Check recent replies
  console.log('\n\n' + '━'.repeat(60));
  console.log('3️⃣  REPLY TARGETING & STRUCTURE ISSUES');
  console.log('━'.repeat(60));
  
  const { data: recentReplies, error: repliesError } = await supabase
    .from('content_metadata')
    .select(`
      decision_id,
      structure_type,
      content,
      tweet_id,
      reply_opportunity_id,
      posted_at
    `)
    .eq('decision_type', 'reply')
    .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });
  
  if (repliesError) {
    console.error('❌ Error fetching replies:', repliesError);
  } else if (recentReplies && recentReplies.length > 0) {
    console.log(`\n✅ Found ${recentReplies.length} replies in last hour:`);
    
    for (const reply of recentReplies) {
      console.log(`\n📝 Reply ${reply.tweet_id}:`);
      console.log(`   Structure: ${reply.structure_type}`);
      console.log(`   Content: ${reply.content?.substring(0, 150)}...`);
      
      // Check if it's a thread
      if (reply.structure_type === 'thread' || reply.content?.match(/^\d+\/\d+/)) {
        console.log(`   🚨 ISSUE: Reply is structured as thread (should be single)`);
      }
      
      // Check the opportunity it's replying to
      if (reply.reply_opportunity_id) {
        const { data: opp, error: oppError } = await supabase
          .from('reply_opportunities')
          .select('target_tweet_id, target_author_handle, target_tweet_content')
          .eq('opportunity_id', reply.reply_opportunity_id)
          .single();
        
        if (opp) {
          console.log(`   Target: @${opp.target_author_handle} - ${opp.target_tweet_id}`);
          console.log(`   Target content: ${opp.target_tweet_content?.substring(0, 80)}...`);
          
          // Check if target tweet starts with @ (is a reply)
          if (opp.target_tweet_content?.startsWith('@')) {
            console.log(`   🚨 ISSUE: Target tweet is itself a reply (starts with @)`);
          }
        }
      }
    }
  } else {
    console.log('\n⚠️  No replies found in last hour');
  }
  
  // ISSUE 4: Check rate limit enforcement logic
  console.log('\n\n' + '━'.repeat(60));
  console.log('4️⃣  RATE LIMIT ENFORCEMENT CHECK');
  console.log('━'.repeat(60));
  
  console.log(`\n📋 Environment Variables:`);
  console.log(`   MAX_POSTS_PER_HOUR: ${process.env.MAX_POSTS_PER_HOUR || 'NOT SET (default: 2)'}`);
  console.log(`   MAX_REPLIES_PER_HOUR: ${process.env.MAX_REPLIES_PER_HOUR || 'NOT SET (default: 4)'}`);
  
  console.log('\n🔍 Checking last 10 postingQueue log entries...');
}

investigate().catch(console.error);


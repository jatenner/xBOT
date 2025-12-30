import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigate() {
  // Remove this line since supabase is already defined above
  // const supabase = getSupabaseClient();
  
  console.log('🔍 INVESTIGATING POSTING ISSUES\n');
  console.log('=' .repeat(80));
  
  // ISSUE 1: Rate limit violation (4 posts in 30 min when limit is 2/hour)
  console.log('\n📊 ISSUE 1: RATE LIMIT VIOLATION\n');
  
  const { data: recentPosts, error: postsError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, posted_at, tweet_id, content, generator_name')
    .gte('posted_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('posted_at', { ascending: false });

  let postsOnly: any[] = [];
  let repliesOnly: any[] = [];

  if (postsError) {
    console.error('❌ Error:', postsError.message);
  } else {
    postsOnly = recentPosts?.filter(p => p.decision_type === 'post') || [];
    repliesOnly = recentPosts?.filter(p => p.decision_type === 'reply') || [];
    
    console.log(`Total in last 3 hours: ${recentPosts?.length || 0}`);
    console.log(`Posts: ${postsOnly.length} (limit: 2/hour)`);
    console.log(`Replies: ${repliesOnly.length} (limit: 4/hour)`);
    console.log(`\n✅ VIOLATION: ${postsOnly.length > 6 ? 'YES - POSTED TOO MANY (>6 in 3hrs)' : 'NO'}\n`);
    
    if (postsOnly.length > 0) {
      console.log('Recent posts:');
      postsOnly.forEach((p, i) => {
        const minAgo = Math.floor((Date.now() - new Date(p.posted_at).getTime()) / 60000);
        console.log(`  ${i+1}. ${p.tweet_id} - ${minAgo}min ago - ${p.content?.substring(0, 60)}...`);
      });
    }
    
    // Check ENV
    console.log(`\n⚙️  MAX_POSTS_PER_HOUR env: ${process.env.MAX_POSTS_PER_HOUR || 'NOT SET (defaults to 2)'}`);
  }
  
  // ISSUE 2: Tweet 2005828901415551455 has thread emoji but is single
  console.log('\n\n' + '='.repeat(80));
  console.log('\n🧵 ISSUE 2: CHECK SPECIFIC TWEETS FROM SCREENSHOTS\n');
  
  const targetTweets = [
    '2005834963267060095',  // "The rise of mental wellness awareness..."
    '2005829703546839245',  // "Most people don't know that simply swapping..."
    '2005828901415551455',  // "Ever considered that a simple morning habit..." (has thread emoji)
    '2005828156398215459'   // "1/6 Why is everyone talking about breathwork?" (thread counter)
  ];
  
  let threadPost: any = null;
  
  console.log('Checking content_generation_metadata_comprehensive:\n');
  
  for (const tweetId of targetTweets) {
    const { data: tweet } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('tweet_id', tweetId)
      .maybeSingle();
    
    if (tweet) {
      const minAgo = Math.floor((Date.now() - new Date(tweet.posted_at).getTime()) / 60000);
      console.log(`\n📝 Tweet ${tweetId} (${minAgo}min ago):`);
      console.log(`   Type: ${tweet.decision_type}`);
      console.log(`   Generator: ${tweet.generator_name}`);
      console.log(`   Content: ${tweet.content?.substring(0, 150)}`);
      
      const hasThreadEmoji = tweet.content?.includes('🧵');
      const hasThreadCounter = tweet.content?.match(/^\d+\/\d+/);
      const isThread = tweet.decision_type === 'thread' || !!tweet.thread_parts;
      
      if (hasThreadEmoji) {
        console.log(`   🚨 HAS THREAD EMOJI: ${tweet.content.match(/🧵/g)?.length || 0}x`);
      }
      if (hasThreadCounter) {
        console.log(`   🚨 HAS THREAD COUNTER: "${hasThreadCounter[0]}"`);
      }
      console.log(`   Is marked as thread: ${isThread}`);
      
      if ((hasThreadEmoji || hasThreadCounter) && !isThread) {
        console.log(`   ❌ BUG: Has thread markers but is NOT a thread!`);
      }
      
      if (tweetId === '2005828901415551455') {
        threadPost = tweet;
      }
    } else {
      console.log(`\n❌ Tweet ${tweetId} not found in content_generation_metadata_comprehensive`);
    }
  }
  
  // Also check post_receipts
  console.log('\n\nChecking post_receipts table:\n');
  
  for (const tweetId of targetTweets) {
    const { data: receipt } = await supabase
      .from('post_receipts')
      .select('*')
      .eq('tweet_id', tweetId)
      .maybeSingle();
    
    if (receipt) {
      const minAgo = Math.floor((Date.now() - new Date(receipt.posted_at).getTime()) / 60000);
      console.log(`\n✅ Found ${tweetId} in post_receipts (${minAgo}min ago)`);
      console.log(`   Content: ${receipt.content?.substring(0, 150)}`);
      
      const hasThreadEmoji = receipt.content?.includes('🧵');
      const hasThreadCounter = receipt.content?.match(/^\d+\/\d+/);
      
      if (hasThreadEmoji) {
        console.log(`   🚨 HAS THREAD EMOJI`);
      }
      if (hasThreadCounter) {
        console.log(`   🚨 HAS THREAD COUNTER: "${hasThreadCounter[0]}"`);
      }
      
      // Check if it's in content_metadata
      const { data: inMetadata } = await supabase
        .from('content_metadata')
        .select('decision_id')
        .eq('tweet_id', tweetId)
        .maybeSingle();
      
      if (!inMetadata) {
        console.log(`   ⚠️  NOT SYNCED to content_metadata - truth reconciliation needed!`);
      }
    }
  }
  
  // ISSUE 3: Replies targeting replies instead of original posts
  console.log('\n\n' + '='.repeat(80));
  console.log('\n💬 ISSUE 3: REPLIES TARGETING WRONG TWEETS\n');
  
  const { data: recentReplies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, content, tweet_id, reply_opportunity_id, posted_at')
    .eq('decision_type', 'reply')
    .gte('posted_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString())  // 3 hours
    .order('posted_at', { ascending: false});

  if (recentReplies && recentReplies.length > 0) {
    console.log(`Found ${recentReplies.length} replies in last hour:\n`);
    
    for (const reply of recentReplies) {
      console.log(`\n📝 Reply ${reply.tweet_id}:`);
      console.log(`   Content: ${reply.content?.substring(0, 100)}...`);
      
      // Check if content has thread markers
      const hasThreadMarker = reply.content?.match(/^\d+\/\d+/);
      if (hasThreadMarker) {
        console.log(`   🚨 ISSUE: Reply has thread marker "${hasThreadMarker[0]}"`);
      }
      
      // Check target
      if (reply.reply_opportunity_id) {
        const { data: opp } = await supabase
          .from('reply_opportunities')
          .select('target_tweet_id, target_author_handle, target_tweet_content')
          .eq('opportunity_id', reply.reply_opportunity_id)
          .maybeSingle();
        
        if (opp) {
          console.log(`   Target: @${opp.target_author_handle} (${opp.target_tweet_id})`);
          console.log(`   Target content: ${opp.target_tweet_content?.substring(0, 80)}...`);
          
          if (opp.target_tweet_content?.startsWith('@')) {
            console.log(`   🚨 ISSUE: Target is a reply (starts with @) - replying to reply instead of original`);
          }
        }
      }
    }
  } else {
    console.log('No replies in last hour');
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('\n📋 SUMMARY OF BUGS FOUND:\n');
  
  const bugs: string[] = [];
  
  if (postsOnly && postsOnly.length > 2) {
    bugs.push(`1. RATE LIMIT VIOLATION: Posted ${postsOnly.length} times in 1 hour (limit: 2)`);
  }
  
  if (threadPost && threadPost.content?.includes('🧵') && threadPost.decision_type !== 'thread') {
    bugs.push(`2. THREAD EMOJI ON SINGLE: Tweet ${threadPost.tweet_id} has 🧵 but is not a thread`);
  }
  
  if (recentReplies) {
    const threadReplies = recentReplies.filter(r => r.content?.match(/^\d+\/\d+/));
    if (threadReplies.length > 0) {
      bugs.push(`3. THREAD-FORMATTED REPLIES: ${threadReplies.length} replies have thread markers (1/X, 2/X)`);
    }
  }
  
  if (bugs.length === 0) {
    console.log('✅ No bugs detected in current data');
  } else {
    bugs.forEach(bug => console.log(`❌ ${bug}`));
  }
  
  console.log('\n' + '='.repeat(80));
}

investigate().catch(console.error);


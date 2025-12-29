import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index.js';

async function diagnose() {
  const supabase = getSupabaseClient();
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 REPLY ISSUES DIAGNOSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Get last 20 replies (properly query the view)
  const { data: replies } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(20);
  
  if (!replies || replies.length === 0) {
    console.log('❌ No recent replies found\n');
    return;
  }
  
  console.log(`📊 Analyzing ${replies.length} recent replies...\n`);
  
  let issue1_threadMarkers = 0;
  let issue1_threadParts = 0;
  let issue2_replyToReply = 0;
  let foundExamples: any[] = [];
  
  for (const reply of replies) {
    const content = reply.content || '';
    const metadata = reply.metadata || {};
    const threadParts = reply.thread_parts;
    
    let hasIssue = false;
    let issueTypes: string[] = [];
    
    // ISSUE #1: Thread markers in content
    if (content.match(/^\d+\/\d+/) || content.includes('🧵')) {
      issue1_threadMarkers++;
      issueTypes.push('THREAD_MARKERS');
      hasIssue = true;
    }
    
    // ISSUE #1: Has thread_parts array
    if (threadParts && Array.isArray(threadParts) && threadParts.length > 0) {
      issue1_threadParts++;
      issueTypes.push('THREAD_PARTS');
      hasIssue = true;
    }
    
    // ISSUE #2: Check if target is a reply
    const targetTweetId = metadata.target_tweet_id;
    if (targetTweetId) {
      const { data: opp } = await supabase
        .from('reply_opportunities')
        .select('target_tweet_content')
        .eq('target_tweet_id', targetTweetId)
        .single();
      
      if (opp && opp.target_tweet_content) {
        // Check if target content looks like a reply
        // Replies often start with @ mentions
        if (opp.target_tweet_content.startsWith('@')) {
          issue2_replyToReply++;
          issueTypes.push('REPLY_TO_REPLY');
          hasIssue = true;
        }
      }
    }
    
    if (hasIssue && foundExamples.length < 5) {
      foundExamples.push({
        tweet_id: reply.tweet_id,
        posted_at: reply.posted_at,
        issues: issueTypes,
        content_preview: content.substring(0, 80),
        thread_parts_count: threadParts?.length || 0,
        target_username: metadata.target_username
      });
    }
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`           📊 SUMMARY (Last ${replies.length} Replies)`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  
  console.log(`⚠️  ISSUE #1: Thread Content in Replies`);
  console.log(`   - With thread markers (1/5, 2/5, 🧵): ${issue1_threadMarkers}/${replies.length}`);
  console.log(`   - With thread_parts array: ${issue1_threadParts}/${replies.length}`);
  console.log(`   - TOTAL ISSUE #1: ${Math.max(issue1_threadMarkers, issue1_threadParts)}/${replies.length}\n`);
  
  console.log(`⚠️  ISSUE #2: Replying to Replies (Not Original Posts)`);
  console.log(`   - Replies to replies: ${issue2_replyToReply}/${replies.length}\n`);
  
  if (foundExamples.length > 0) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`           🔍 EXAMPLE ISSUES FOUND`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    
    foundExamples.forEach((ex, i) => {
      console.log(`${i + 1}. Tweet ID: ${ex.tweet_id}`);
      console.log(`   Posted: ${ex.posted_at}`);
      console.log(`   Issues: ${ex.issues.join(', ')}`);
      console.log(`   Content: "${ex.content_preview}..."`);
      if (ex.thread_parts_count > 0) {
        console.log(`   Thread parts: ${ex.thread_parts_count}`);
      }
      if (ex.target_username) {
        console.log(`   Replying to: @${ex.target_username}`);
      }
      console.log('');
    });
  }
  
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  
  if (issue1_threadMarkers > 0 || issue1_threadParts > 0 || issue2_replyToReply > 0) {
    console.log(`\n❌ ISSUES CONFIRMED - Fixes required:`);
    if (issue1_threadMarkers > 0 || issue1_threadParts > 0) {
      console.log(`   1. Prevent thread content from being used as replies`);
    }
    if (issue2_replyToReply > 0) {
      console.log(`   2. Filter out reply tweets from reply opportunities`);
    }
    console.log('');
  } else {
    console.log(`\n✅ No issues found in recent replies\n`);
  }
}

diagnose();

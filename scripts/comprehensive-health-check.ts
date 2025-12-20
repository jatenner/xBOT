import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('\n🔍 COMPREHENSIVE SYSTEM HEALTH CHECK\n');
  console.log('═══════════════════════════════════════════════════════\n');

  // ISSUE 1: Posting rate (should be ~6-7/hour max, seeing way more)
  console.log('📊 ISSUE 1: POSTING RATE\n');
  
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  
  // Check content_metadata
  const { data: cmPosts } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, posted_at, tweet_id')
    .eq('status', 'posted')
    .gte('posted_at', twoHoursAgo)
    .order('posted_at', { ascending: false });
  
  // Check receipts
  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, decision_id, post_type, posted_at, root_tweet_id')
    .gte('posted_at', twoHoursAgo)
    .order('posted_at', { ascending: false });
  
  const cmCount = cmPosts?.length || 0;
  const receiptCount = receipts?.length || 0;
  
  console.log(`Posts in content_metadata: ${cmCount} (${(cmCount / 2).toFixed(1)}/hour)`);
  console.log(`Receipts in post_receipts: ${receiptCount} (${(receiptCount / 2).toFixed(1)}/hour)`);
  
  if (receiptCount > cmCount) {
    console.log(`\n🚨 TRUTH GAP: ${receiptCount - cmCount} receipts WITHOUT content_metadata entries`);
    console.log(`   This means tweets posted to X but NOT saved in DB!`);
  } else if (receiptCount === cmCount) {
    console.log(`\n✅ No truth gap (receipts match DB entries)`);
  }
  
  const orphanReceipts = receipts?.filter(r => 
    !cmPosts?.some(p => p.decision_id === r.decision_id)
  ) || [];
  
  if (orphanReceipts.length > 0) {
    console.log(`\n🔴 ORPHAN RECEIPTS (posted but not in DB):`);
    orphanReceipts.slice(0, 5).forEach((r, i) => {
      const ago = Math.round((Date.now() - new Date(r.posted_at).getTime()) / 60000);
      console.log(`${i+1}. ${r.post_type.toUpperCase()} - ${ago}m ago`);
      console.log(`   Tweet: ${r.root_tweet_id}`);
      console.log(`   Decision: ${r.decision_id?.substring(0, 8) || 'NULL'}...`);
      console.log(`   URL: https://x.com/SignalAndSynapse/status/${r.root_tweet_id}\n`);
    });
  }
  
  // ISSUE 2: Thread rate (should be ~15%, seeing way more)
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 ISSUE 2: THREAD RATE\n');
  
  const singles = cmPosts?.filter(p => p.decision_type === 'single').length || 0;
  const threads = cmPosts?.filter(p => p.decision_type === 'thread').length || 0;
  const replies = cmPosts?.filter(p => p.decision_type === 'reply').length || 0;
  const total = singles + threads + replies;
  
  console.log(`Singles: ${singles} (${total > 0 ? ((singles / total) * 100).toFixed(0) : 0}%)`);
  console.log(`Threads: ${threads} (${total > 0 ? ((threads / total) * 100).toFixed(0) : 0}%)`);
  console.log(`Replies: ${replies} (${total > 0 ? ((replies / total) * 100).toFixed(0) : 0}%)`);
  
  if (threads / total > 0.20) {
    console.log(`\n🚨 TOO MANY THREADS: ${((threads / total) * 100).toFixed(0)}% (expected: ~15%)`);
  } else {
    console.log(`\n✅ Thread rate is healthy`);
  }
  
  // Check if threads are marked correctly
  const { data: threadCheck } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, thread_tweet_ids')
    .eq('decision_type', 'thread')
    .eq('status', 'posted')
    .gte('posted_at', twoHoursAgo);
  
  const threadsWithIds = threadCheck?.filter(t => {
    if (!t.thread_tweet_ids) return false;
    try {
      const ids = JSON.parse(t.thread_tweet_ids);
      return Array.isArray(ids) && ids.length >= 2;
    } catch {
      return false;
    }
  }).length || 0;
  
  console.log(`\nThreads with tweet IDs: ${threadsWithIds}/${threads}`);
  if (threadsWithIds < threads) {
    console.log(`🚨 ${threads - threadsWithIds} threads missing tweet IDs!`);
  }
  
  // ISSUE 3: Reply quality
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('📊 ISSUE 3: REPLY CONTEXT CHECK\n');
  
  const recentReplies = cmPosts?.filter(p => p.decision_type === 'reply').slice(0, 5) || [];
  
  if (recentReplies.length === 0) {
    console.log('No replies in last 2 hours to check');
  } else {
    console.log(`Checking last ${recentReplies.length} replies for context issues:\n`);
    
    // Get full reply data
    const { data: replyData } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, content, target_username, target_tweet_id, tweet_id, posted_at')
      .in('decision_id', recentReplies.map(r => r.decision_id));
    
    replyData?.forEach((r, i) => {
      const hasJsonArtifact = r.content.includes('[') || r.content.includes('{');
      const hasGenericPhrase = /want to add value|try this: after i|struggling to/i.test(r.content);
      const tooLong = r.content.length > 250;
      
      const issues: string[] = [];
      if (hasJsonArtifact) issues.push('JSON artifacts');
      if (hasGenericPhrase) issues.push('Generic template');
      if (tooLong) issues.push(`Too long (${r.content.length} chars)`);
      
      console.log(`${i+1}. Reply to @${r.target_username}`);
      if (issues.length > 0) {
        console.log(`   ❌ Issues: ${issues.join(', ')}`);
      } else {
        console.log(`   ✅ No issues detected`);
      }
      console.log(`   "${r.content.substring(0, 80)}..."`);
      console.log(`   URL: https://x.com/SignalAndSynapse/status/${r.tweet_id}\n`);
    });
  }
  
  // ISSUE 4: Failure marking
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 ISSUE 4: FAILURE HANDLING\n');
  
  const { data: failed } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, tweet_id, error_message, updated_at')
    .in('status', ['failed', 'retry', 'retry_pending'])
    .gte('updated_at', twoHoursAgo)
    .order('updated_at', { ascending: false })
    .limit(10);
  
  console.log(`Failed/retrying decisions: ${failed?.length || 0}`);
  
  if (failed && failed.length > 0) {
    console.log(`\nRecent failures:\n`);
    failed.forEach((f, i) => {
      const ago = Math.round((Date.now() - new Date(f.updated_at).getTime()) / 60000);
      console.log(`${i+1}. ${f.decision_type.toUpperCase()} - ${f.status} (${ago}m ago)`);
      console.log(`   ID: ${f.decision_id.substring(0, 8)}...`);
      console.log(`   Tweet ID: ${f.tweet_id || 'NULL'}`);
      console.log(`   Error: ${f.error_message || 'No error message'}\n`);
    });
  } else {
    console.log(`✅ No recent failures`);
  }
  
  // SUMMARY
  console.log('═══════════════════════════════════════════════════════');
  console.log('📋 SUMMARY OF ISSUES:\n');
  
  const issues: string[] = [];
  
  if (receiptCount / 2 > 7) {
    issues.push(`❌ Over-posting: ${(receiptCount / 2).toFixed(1)} posts/hour (target: 6-7)`);
  }
  
  if (orphanReceipts.length > 0) {
    issues.push(`❌ Truth gap: ${orphanReceipts.length} receipts not saved in DB`);
  }
  
  if (threads / total > 0.20) {
    issues.push(`❌ Too many threads: ${((threads / total) * 100).toFixed(0)}% (target: 15%)`);
  }
  
  if (threadsWithIds < threads) {
    issues.push(`⚠️  ${threads - threadsWithIds} threads missing tweet IDs`);
  }
  
  if (issues.length === 0) {
    console.log('✅ All systems healthy!');
  } else {
    issues.forEach(issue => console.log(issue));
  }
  
  console.log('\n═══════════════════════════════════════════════════════\n');
}

main();


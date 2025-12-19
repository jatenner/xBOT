/**
 * Debug Replies Last 60 Minutes
 * 
 * DB-only report (no Railway CLI needed)
 * Shows reply truth: posted, receipts, skipped, mismatches
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function debugRepliesLast60m() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const sixtyMinutesAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  console.log('\n📊 REPLY TRUTH AUDIT (Last 60 Minutes)\n');
  console.log(`Time window: ${new Date(sixtyMinutesAgo).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET to now\n`);
  
  // 1. Get successful replies from content_metadata
  const { data: replies, error: repliesError } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, target_tweet_id, target_username, posted_at, content, status')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .gte('posted_at', sixtyMinutesAgo)
    .order('posted_at', { ascending: false });
  
  if (repliesError) {
    console.error('❌ Error fetching replies:', repliesError.message);
    return;
  }
  
  console.log(`✅ Successful replies: ${replies?.length || 0}\n`);
  
  if (replies && replies.length > 0) {
    console.log('📝 Most recent 4 replies:\n');
    
    for (const reply of replies.slice(0, 4)) {
      const postedDate = new Date(reply.posted_at);
      const etTime = postedDate.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });
      
      console.log(`${replies.indexOf(reply) + 1}. Tweet ID: ${reply.tweet_id}`);
      console.log(`   URL: https://x.com/SignalAndSynapse/status/${reply.tweet_id}`);
      console.log(`   Parent: @${reply.target_username} (${reply.target_tweet_id})`);
      console.log(`   Posted: ${etTime} ET`);
      console.log(`   Reply: "${reply.content.substring(0, 80)}..."`);
      console.log('');
    }
  }
  
  // 2. Check post_receipts for replies
  const { data: receipts, error: receiptsError } = await supabase
    .from('post_receipts')
    .select('receipt_id, decision_id, root_tweet_id, posted_at, metadata')
    .eq('post_type', 'reply')
    .gte('posted_at', sixtyMinutesAgo)
    .order('posted_at', { ascending: false });
  
  if (!receiptsError) {
    console.log(`📝 Reply receipts: ${receipts?.length || 0}\n`);
    
    // 3. Find unreconciled receipts (receipt exists but no content_metadata)
    if (receipts && receipts.length > 0) {
      const replyTweetIds = new Set(replies?.map(r => r.tweet_id) || []);
      const unreconciledReceipts = receipts.filter(r => !replyTweetIds.has(r.root_tweet_id));
      
      if (unreconciledReceipts.length > 0) {
        console.log(`⚠️  UNRECONCILED RECEIPTS: ${unreconciledReceipts.length}\n`);
        unreconciledReceipts.forEach((r, i) => {
          console.log(`${i + 1}. Receipt ID: ${r.receipt_id}`);
          console.log(`   Tweet ID: ${r.root_tweet_id}`);
          console.log(`   Decision ID: ${r.decision_id || 'null'}`);
          console.log(`   Posted: ${new Date(r.posted_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
          console.log('');
        });
      } else {
        console.log(`✅ All receipts reconciled (${receipts.length}/${receipts.length})\n`);
      }
    }
  }
  
  // 4. Check for skipped replies in system_events
  const { data: events, error: eventsError } = await supabase
    .from('system_events')
    .select('event_type, metadata, timestamp')
    .eq('component', 'reply_system')
    .in('event_type', ['reply_skipped', 'reply_failed', 'reply_gate_rejected'])
    .gte('timestamp', sixtyMinutesAgo)
    .order('timestamp', { ascending: false })
    .limit(10);
  
  if (!eventsError && events && events.length > 0) {
    console.log(`⏭️  Skipped/Failed replies: ${events.length}\n`);
    
    events.forEach((e, i) => {
      const reason = e.metadata?.reason || 'unknown';
      const targetId = e.metadata?.target_tweet_id || 'unknown';
      console.log(`${i + 1}. Event: ${e.event_type}`);
      console.log(`   Reason: ${reason}`);
      console.log(`   Target: ${targetId}`);
      console.log(`   Time: ${new Date(e.timestamp).toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })} ET`);
      console.log('');
    });
  } else {
    console.log(`✅ No skipped/failed replies\n`);
  }
  
  // 5. Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✓ Successful replies: ${replies?.length || 0}`);
  console.log(`✓ Reply receipts: ${receipts?.length || 0}`);
  console.log(`✓ Unreconciled receipts: ${receipts && replies ? receipts.length - replies.length : 0}`);
  console.log(`✓ Skipped/Failed: ${events?.length || 0}`);
  console.log('');
  
  if (replies && receipts && replies.length === receipts.length && receipts.length > 0) {
    console.log('🎉 TRUTH CONTRACT: PASSING');
    console.log('   All replies have receipts and DB entries');
  } else if (replies && replies.length > 0 && (!receipts || receipts.length === 0)) {
    console.log('⚠️  TRUTH CONTRACT: PARTIAL');
    console.log('   Replies in DB but no receipts (old code)');
  } else if (replies && replies.length === 0) {
    console.log('ℹ️  No replies in last 60 minutes');
  }
}

debugRepliesLast60m().catch(console.error);


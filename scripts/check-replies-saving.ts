#!/usr/bin/env tsx
/**
 * Check if replies are saving to database
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  console.log('🔍 REPLY SAVING STATUS CHECK\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tenHoursAgo = new Date(Date.now() - 10 * 60 * 60 * 1000);

  // Check singles saved
  const { count: singlesCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'single')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', tenHoursAgo.toISOString());

  // Check threads saved
  const { count: threadsCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'thread')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', tenHoursAgo.toISOString());

  // Check replies saved
  const { count: repliesCount } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .gte('posted_at', tenHoursAgo.toISOString());

  // Check replies posted but missing tweet_id
  const { count: repliesMissingId } = await supabase
    .from('content_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .or('tweet_id.is.null,tweet_id.eq.')
    .gte('posted_at', tenHoursAgo.toISOString());

  console.log('📊 LAST 10 HOURS (Since Fix Deployed):\n');
  console.log(`   Singles:  ${singlesCount || 0} saved with tweet_id ✅`);
  console.log(`   Threads:  ${threadsCount || 0} saved with tweet_id ${(threadsCount || 0) > 0 ? '✅' : '⚠️'}`);
  console.log(`   Replies:  ${repliesCount || 0} saved with tweet_id ${(repliesCount || 0) > 0 ? '✅' : '🚨'}`);
  console.log('');
  console.log(`   🚨 Replies missing tweet_id: ${repliesMissingId || 0}`);
  console.log('');

  // Get recent replies (all statuses)
  const { data: recentReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, status, tweet_id, posted_at, last_post_error, content')
    .eq('decision_type', 'reply')
    .gte('created_at', tenHoursAgo.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentReplies && recentReplies.length > 0) {
    console.log('📋 RECENT REPLY ATTEMPTS:\n');
    recentReplies.forEach((r, i) => {
      const minutesAgo = r.posted_at ? Math.round((Date.now() - new Date(r.posted_at).getTime()) / 1000 / 60) : null;
      const timeDisplay = minutesAgo ? `${minutesAgo}m ago` : 'N/A';
      const hasTweetId = r.tweet_id ? '✅' : '❌';
      console.log(`   ${i + 1}. status: ${r.status.padEnd(10)} | tweet_id: ${hasTweetId} | ${timeDisplay}`);
      if (r.last_post_error) {
        console.log(`      error: ${r.last_post_error.substring(0, 80)}`);
      }
    });
    console.log('');
  } else {
    console.log('⚠️  NO reply attempts in last 10 hours\n');
  }

  // Check post_receipts for replies
  const { count: replyReceiptsCount } = await supabase
    .from('post_receipts')
    .select('*', { count: 'exact', head: true })
    .eq('kind', 'reply')
    .gte('posted_at', tenHoursAgo.toISOString());

  console.log(`📝 Reply Receipts (backup): ${replyReceiptsCount || 0}\n`);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Diagnosis
  if ((repliesCount || 0) === 0 && (recentReplies?.length || 0) > 0) {
    console.log('🚨 PROBLEM CONFIRMED: Replies posting but NOT saving tweet_id\n');
    console.log('   → Replies follow different code path than singles/threads');
    console.log('   → markDecisionPosted() might not be called for replies');
    console.log('   → OR called with wrong parameters for replies');
    console.log('');
  } else if ((repliesCount || 0) > 0) {
    console.log('✅ Replies ARE saving correctly\n');
  } else {
    console.log('⚠️  No replies attempted in last 10 hours\n');
  }
}

check();


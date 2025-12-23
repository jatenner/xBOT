#!/usr/bin/env tsx
/**
 * Find the Eric Daugherty reply from 6 hours ago
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function find() {
  console.log('🔍 SEARCHING FOR ERIC DAUGHERTY REPLY\n');
  console.log('Target: Reply to @EricLDaugh about JD Vance\n');
  console.log('Posted: ~6 hours ago (around 3:42 PM EST)\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const eightHoursAgo = new Date(Date.now() - 8 * 60 * 60 * 1000);

  // Search by content (Eric or Darryl or JD Vance related)
  const { data: contentMatches } = await supabase
    .from('content_metadata')
    .select('*')
    .eq('decision_type', 'reply')
    .or('content.ilike.%Eric%,content.ilike.%Darryl%,content.ilike.%JD Vance%,content.ilike.%couch%')
    .gte('created_at', eightHoursAgo.toISOString())
    .order('created_at', { ascending: false });

  if (contentMatches && contentMatches.length > 0) {
    console.log(`✅ FOUND ${contentMatches.length} POSSIBLE MATCH(ES) IN DATABASE:\n`);
    contentMatches.forEach((match, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(match.created_at).getTime()) / 1000 / 60);
      const hoursAgo = (minutesAgo / 60).toFixed(1);
      console.log(`   ${i + 1}. decision_id: ${match.decision_id}`);
      console.log(`      status: ${match.status}`);
      console.log(`      tweet_id: ${match.tweet_id || 'NULL ❌'}`);
      console.log(`      created: ${hoursAgo}h ago`);
      console.log(`      content: ${match.content?.substring(0, 100)}...`);
      console.log('');
    });
  } else {
    console.log('❌ NO MATCHES found in database by content search\n');
  }

  // Search ALL replies in that time window
  const { data: allReplies } = await supabase
    .from('content_metadata')
    .select('decision_id, status, tweet_id, posted_at, created_at, content')
    .eq('decision_type', 'reply')
    .gte('created_at', eightHoursAgo.toISOString())
    .order('created_at', { ascending: false });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📋 ALL REPLIES IN LAST 8 HOURS: ${allReplies?.length || 0}\n`);

  if (allReplies && allReplies.length > 0) {
    allReplies.forEach((reply, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(reply.created_at).getTime()) / 1000 / 60);
      const hoursAgo = (minutesAgo / 60).toFixed(1);
      const hasTweetId = reply.tweet_id ? '✅' : '❌';
      console.log(`   ${i + 1}. status: ${reply.status.padEnd(10)} | tweet_id: ${hasTweetId} | ${hoursAgo}h ago`);
      console.log(`      ${reply.content?.substring(0, 80)}...`);
    });
    console.log('');
  }

  // Check post_receipts
  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('*')
    .eq('kind', 'reply')
    .gte('posted_at', eightHoursAgo.toISOString())
    .order('posted_at', { ascending: false });

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`📝 REPLY RECEIPTS: ${receipts?.length || 0}\n`);

  if (receipts && receipts.length > 0) {
    receipts.forEach((receipt, i) => {
      const minutesAgo = Math.round((Date.now() - new Date(receipt.posted_at).getTime()) / 1000 / 60);
      const hoursAgo = (minutesAgo / 60).toFixed(1);
      console.log(`   ${i + 1}. root_tweet_id: ${receipt.root_tweet_id}`);
      console.log(`      parent_tweet_id: ${receipt.parent_tweet_id || 'N/A'}`);
      console.log(`      decision_id: ${receipt.decision_id || 'N/A'}`);
      console.log(`      posted: ${hoursAgo}h ago`);
    });
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // VERDICT
  if ((allReplies?.length || 0) === 0 && (receipts?.length || 0) === 0) {
    console.log('🚨 VERDICT: REPLY NOT IN DATABASE AT ALL\n');
    console.log('   The reply exists on X but was NEVER saved to database');
    console.log('   This confirms replies are NOT being processed through postingQueue');
    console.log('   OR replies are being posted but not calling markDecisionPosted()');
    console.log('');
  } else if ((allReplies?.length || 0) > 0) {
    const repliesWithoutId = allReplies?.filter(r => !r.tweet_id).length || 0;
    if (repliesWithoutId > 0) {
      console.log(`🚨 VERDICT: ${repliesWithoutId} REPLIES SAVED WITHOUT TWEET_ID\n`);
      console.log('   Replies are being saved but tweet_id is NULL');
      console.log('   markDecisionPosted() either not called or failing for replies');
      console.log('');
    }
  }
}

find();


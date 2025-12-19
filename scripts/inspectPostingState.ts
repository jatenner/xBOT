#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('[INSPECT] Analyzing last 5 top-level posts...\n');

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[INSPECT] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  // ========================================
  // PART A: Last 5 from content_metadata
  // ========================================
  console.log('📊 CONTENT_METADATA (canonical truth table)\n');
  console.log('Query: Top-level posts only (decision_type IN (\'single\', \'thread\'), status=\'posted\')\n');

  const { data: metadataRows, error: metadataError } = await supabase
    .from('content_metadata')
    .select('posted_at, decision_id, status, tweet_id, thread_tweet_ids, decision_type')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(5);

  if (metadataError) {
    console.error('[INSPECT] Error querying content_metadata:', metadataError.message);
  } else if (!metadataRows || metadataRows.length === 0) {
    console.log('⚠️  No posted top-level posts found in content_metadata\n');
  } else {
    console.log(`Found ${metadataRows.length} rows:\n`);
    metadataRows.forEach((row, idx) => {
      const threadIds = row.thread_tweet_ids ? (Array.isArray(row.thread_tweet_ids) ? row.thread_tweet_ids : JSON.parse(row.thread_tweet_ids)) : [];
      const threadIdsLength = threadIds.length;
      const classifiedType = threadIdsLength > 1 ? 'thread' : 'single';
      
      console.log(`${idx + 1}. posted_at: ${row.posted_at}`);
      console.log(`   decision_id: ${row.decision_id}`);
      console.log(`   status: ${row.status}`);
      console.log(`   tweet_id: ${row.tweet_id || 'NULL'}`);
      console.log(`   thread_tweet_ids_length: ${threadIdsLength}`);
      console.log(`   decision_type: ${row.decision_type}`);
      console.log(`   classified_post_type: ${classifiedType}`);
      console.log('');
    });
  }

  // ========================================
  // PART B: Last 5 from post_receipts
  // ========================================
  console.log('📝 POST_RECEIPTS (durable "posted to X" receipts)\n');
  console.log('Query: All receipts (filter post_type != \'reply\' if present)\n');

  const { data: receiptRows, error: receiptError } = await supabase
    .from('post_receipts')
    .select('posted_at, receipt_id, decision_id, root_tweet_id, tweet_ids, post_type')
    .order('posted_at', { ascending: false })
    .limit(10); // Get 10 to filter out replies

  if (receiptError) {
    console.error('[INSPECT] Error querying post_receipts:', receiptError.message);
  } else if (!receiptRows || receiptRows.length === 0) {
    console.log('⚠️  No receipts found in post_receipts\n');
  } else {
    // Filter out replies
    const topLevelReceipts = receiptRows.filter(r => r.post_type !== 'reply').slice(0, 5);
    
    if (topLevelReceipts.length === 0) {
      console.log('⚠️  No top-level receipts found (all are replies)\n');
    } else {
      console.log(`Found ${topLevelReceipts.length} top-level receipts:\n`);
      topLevelReceipts.forEach((row, idx) => {
        const tweetIdsLength = row.tweet_ids ? row.tweet_ids.length : 0;
        const inferredType = tweetIdsLength > 1 ? 'thread' : 'single';
        
        console.log(`${idx + 1}. posted_at: ${row.posted_at}`);
        console.log(`   receipt_id: ${row.receipt_id}`);
        console.log(`   decision_id: ${row.decision_id || 'NULL'}`);
        console.log(`   root_tweet_id: ${row.root_tweet_id}`);
        console.log(`   tweet_ids_length: ${tweetIdsLength}`);
        console.log(`   post_type: ${row.post_type || 'NULL'}`);
        console.log(`   inferred_type: ${inferredType}`);
        console.log('');
      });
    }
  }

  // ========================================
  // PART C: DIFF - Unreconciled Receipts
  // ========================================
  console.log('🔍 DIFF: Unreconciled receipts (last 2 hours)\n');
  
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  let unreconciled: any[] = [];
  
  const { data: recentReceipts, error: recentReceiptsError } = await supabase
    .from('post_receipts')
    .select('receipt_id, decision_id, root_tweet_id, tweet_ids, posted_at, post_type')
    .gte('posted_at', twoHoursAgo)
    .neq('post_type', 'reply')
    .order('posted_at', { ascending: false });

  if (recentReceiptsError) {
    console.error('[INSPECT] Error querying recent receipts:', recentReceiptsError.message);
  } else if (!recentReceipts || recentReceipts.length === 0) {
    console.log('✅ No receipts in last 2 hours\n');
  } else {
    console.log(`Found ${recentReceipts.length} top-level receipts in last 2 hours\n`);
    
    for (const receipt of recentReceipts) {
      const rootTweetId = receipt.root_tweet_id;
      
      // Check if this tweet_id exists in content_metadata
      const { data: matchingMetadata, error: matchError } = await supabase
        .from('content_metadata')
        .select('decision_id, tweet_id, thread_tweet_ids')
        .or(`tweet_id.eq.${rootTweetId},thread_tweet_ids.cs.["${rootTweetId}"]`)
        .limit(1);

      if (matchError) {
        console.warn(`[INSPECT] Error checking tweet_id ${rootTweetId}:`, matchError.message);
      } else if (!matchingMetadata || matchingMetadata.length === 0) {
        unreconciled.push(receipt);
      }
    }

    if (unreconciled.length === 0) {
      console.log('✅ All receipts in last 2 hours are reconciled (found in content_metadata)\n');
    } else {
      console.log(`🚨 UNRECONCILED: ${unreconciled.length} receipts NOT found in content_metadata:\n`);
      unreconciled.forEach((receipt, idx) => {
        console.log(`${idx + 1}. receipt_id: ${receipt.receipt_id}`);
        console.log(`   decision_id: ${receipt.decision_id || 'NULL'}`);
        console.log(`   root_tweet_id: ${receipt.root_tweet_id}`);
        console.log(`   posted_at: ${receipt.posted_at}`);
        console.log(`   post_type: ${receipt.post_type}`);
        console.log(`   ⚠️  This post hit X but is NOT in content_metadata`);
        console.log('');
      });
    }

    console.log(`📊 Summary: ${unreconciled.length}/${recentReceipts.length} receipts unreconciled\n`);
  }

  // ========================================
  // PART D: CADENCE STATE
  // ========================================
  console.log('⏱️  CADENCE STATE: What does scheduler think?\n');

  // Check last post from content_metadata
  const { data: lastMetadataPost } = await supabase
    .from('content_metadata')
    .select('posted_at, decision_id, decision_type')
    .in('decision_type', ['single', 'thread'])
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();

  // Check last post from post_receipts
  const { data: lastReceiptPost } = await supabase
    .from('post_receipts')
    .select('posted_at, receipt_id, root_tweet_id, post_type')
    .neq('post_type', 'reply')
    .order('posted_at', { ascending: false })
    .limit(1)
    .single();

  if (lastMetadataPost) {
    const minutesAgo = Math.round((Date.now() - new Date(lastMetadataPost.posted_at).getTime()) / 60000);
    console.log(`[CADENCE_STATE] last_post_source=content_metadata`);
    console.log(`[CADENCE_STATE] last_posted_at=${lastMetadataPost.posted_at}`);
    console.log(`[CADENCE_STATE] minutes_ago=${minutesAgo}`);
    console.log(`[CADENCE_STATE] decision_type=${lastMetadataPost.decision_type}`);
  } else {
    console.log(`[CADENCE_STATE] last_post_source=content_metadata NONE`);
  }
  console.log('');

  if (lastReceiptPost) {
    const minutesAgo = Math.round((Date.now() - new Date(lastReceiptPost.posted_at).getTime()) / 60000);
    console.log(`[CADENCE_STATE] last_post_source=post_receipts`);
    console.log(`[CADENCE_STATE] last_posted_at=${lastReceiptPost.posted_at}`);
    console.log(`[CADENCE_STATE] minutes_ago=${minutesAgo}`);
    console.log(`[CADENCE_STATE] post_type=${lastReceiptPost.post_type}`);
  } else {
    console.log(`[CADENCE_STATE] last_post_source=post_receipts NONE`);
  }
  console.log('');

  // ========================================
  // VERDICT
  // ========================================
  if (unreconciled && unreconciled.length > 0) {
    console.log('🚨 HYPOTHESIS CONFIRMED: Posts are hitting X but NOT being saved to content_metadata');
    console.log('🚨 This causes the scheduler to think posts failed, leading to over-posting');
    console.log('\n💡 RECOMMENDED FIX:');
    console.log('   1. Use post_receipts for cadence checks (not content_metadata)');
    console.log('   2. Keep content_metadata for learning/metrics only');
    console.log('   3. Log cadence decision source explicitly');
  } else {
    console.log('✅ No unreconciled receipts found - hypothesis NOT confirmed');
    console.log('💡 Over-posting may have a different root cause');
  }

  process.exit(0);
}

main();


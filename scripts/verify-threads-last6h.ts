#!/usr/bin/env tsx
/**
 * Verify Threads: Last 6 Hours
 * 
 * Diagnostic script to prove thread truth:
 * - Queries DB for posted decisions in last 6h
 * - Detects threads based on thread_tweet_ids length >= 2
 * - Shows exactly what's in the DB vs what we expect
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

interface ThreadVerifyRow {
  decision_id: string;
  decision_type: string;
  status: string;
  tweet_id: string | null;
  thread_tweet_ids: string | null;
  thread_tweet_ids_len: number;
  created_at: string;
  posted_at: string | null;
  url: string | null;
}

async function queryLast6Hours(): Promise<ThreadVerifyRow[]> {
  const supabase = getSupabaseClient();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  console.log(`[THREAD_VERIFY] Querying decisions posted in last 6 hours (since ${sixHoursAgo})...`);

  const { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, tweet_id, thread_tweet_ids, created_at, posted_at')
    .eq('status', 'posted')
    .gte('posted_at', sixHoursAgo)
    .order('posted_at', { ascending: false });

  if (error) {
    throw new Error(`Query failed: ${error.message}`);
  }

  console.log(`[THREAD_VERIFY] Found ${data?.length || 0} posted decisions`);

  const rows: ThreadVerifyRow[] = (data || []).map((row: any) => {
    let threadTweetIdsLen = 0;
    
    if (row.thread_tweet_ids) {
      try {
        const parsed = typeof row.thread_tweet_ids === 'string' 
          ? JSON.parse(row.thread_tweet_ids) 
          : row.thread_tweet_ids;
        threadTweetIdsLen = Array.isArray(parsed) ? parsed.length : 0;
      } catch (e) {
        threadTweetIdsLen = 0;
      }
    }

    const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
    const url = row.tweet_id 
      ? `https://x.com/${username}/status/${row.tweet_id}`
      : null;

    return {
      decision_id: row.decision_id,
      decision_type: row.decision_type || 'single',
      status: row.status,
      tweet_id: row.tweet_id,
      thread_tweet_ids: row.thread_tweet_ids,
      thread_tweet_ids_len: threadTweetIdsLen,
      created_at: row.created_at,
      posted_at: row.posted_at,
      url: url,
    };
  });

  return rows;
}

async function main() {
  try {
    console.log(`[THREAD_VERIFY] Starting thread verification for last 6 hours...\n`);

    const rows = await queryLast6Hours();

    // Classify
    const singles = rows.filter(r => r.decision_type === 'single' || (r.decision_type !== 'reply' && r.thread_tweet_ids_len < 2));
    const threads = rows.filter(r => r.thread_tweet_ids_len >= 2);
    const replies = rows.filter(r => r.decision_type === 'reply');
    const threadIntendedButNotRecorded = rows.filter(r => r.decision_type === 'thread' && r.thread_tweet_ids_len < 2);

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total posted: ${rows.length}`);
    console.log(`Singles: ${singles.length}`);
    console.log(`Threads (thread_tweet_ids_len >= 2): ${threads.length}`);
    console.log(`Replies: ${replies.length}`);
    console.log(`Thread-intended but not recorded (decision_type='thread' but thread_tweet_ids_len < 2): ${threadIntendedButNotRecorded.length}`);

    console.log(`\n=== ALL POSTED DECISIONS (LAST 6H) ===`);
    console.log(`decision_id | decision_type | tweet_id | thread_tweet_ids_len | posted_at | url`);
    console.log(`-`.repeat(150));
    for (const row of rows) {
      const shortId = row.decision_id.substring(0, 8);
      const shortTweetId = row.tweet_id ? row.tweet_id.substring(0, 10) : 'N/A';
      const postedAt = row.posted_at ? new Date(row.posted_at).toISOString().substring(11, 19) : 'N/A';
      console.log(`${shortId}... | ${row.decision_type.padEnd(10)} | ${shortTweetId}... | ${row.thread_tweet_ids_len} | ${postedAt} | ${row.url || 'N/A'}`);
    }

    if (threadIntendedButNotRecorded.length > 0) {
      console.log(`\n=== 🚨 THREAD TRUTH MISMATCH ===`);
      console.log(`Found ${threadIntendedButNotRecorded.length} decisions with decision_type='thread' but thread_tweet_ids_len < 2:`);
      for (const row of threadIntendedButNotRecorded) {
        console.log(`  - ${row.decision_id.substring(0, 8)}... | tweet_id=${row.tweet_id || 'N/A'} | thread_tweet_ids=${row.thread_tweet_ids || 'NULL'}`);
      }
      console.log(`\nThis means:`);
      console.log(`  1) Thread was intended but failed to post multiple tweets, OR`);
      console.log(`  2) Thread posted successfully but tweetIds were not captured/persisted`);
    }

    if (threads.length > 0) {
      console.log(`\n=== ✅ SUCCESSFULLY RECORDED THREADS ===`);
      for (const thread of threads) {
        console.log(`  - ${thread.decision_id.substring(0, 8)}... | ${thread.thread_tweet_ids_len} tweets | ${thread.url}`);
      }
    } else {
      console.log(`\n=== ⚠️ NO THREADS RECORDED ===`);
      console.log(`No decisions with thread_tweet_ids_len >= 2 found in last 6 hours.`);
    }

  } catch (error: any) {
    console.error(`[THREAD_VERIFY] ❌ Error:`, error.message);
    process.exit(1);
  }
}

main();


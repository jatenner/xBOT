#!/usr/bin/env tsx
/**
 * 📊 POLL REPLY METRICS - Update Metrics for Posted Replies
 * 
 * Polls last N posted replies once/day and updates metrics.
 * 
 * Usage:
 *   pnpm tsx scripts/ops/poll-reply-metrics.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import { Page } from 'playwright';

const MAX_REPLIES_TO_POLL = parseInt(process.env.MAX_REPLIES_TO_POLL || '10', 10);
const POLL_INTERVAL_HOURS = 24; // Poll once per day

interface PollResult {
  replies_polled: number;
  metrics_updated: number;
  errors: number;
  summary: Array<{
    decision_id: string;
    tweet_id: string;
    likes: number | null;
    replies: number | null;
    retweets: number | null;
    bookmarks: number | null;
  }>;
}

async function scrapeTweetMetrics(page: Page, tweetId: string): Promise<{
  likes: number | null;
  replies: number | null;
  retweets: number | null;
  bookmarks: number | null;
}> {
  const tweetUrl = `https://x.com/i/status/${tweetId}`;
  
  try {
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    
    const metrics = await page.evaluate(() => {
      // Try to find metrics from aria-labels
      const replyButton = document.querySelector('[data-testid="reply"]');
      const retweetButton = document.querySelector('[data-testid="retweet"]');
      const likeButton = document.querySelector('[data-testid="like"]');
      
      let likes: number | null = null;
      let replies: number | null = null;
      let retweets: number | null = null;
      let bookmarks: number | null = null;
      
      if (replyButton) {
        const ariaLabel = replyButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,]+)/);
        if (match) replies = parseInt(match[1].replace(/,/g, '')) || null;
      }
      
      if (retweetButton) {
        const ariaLabel = retweetButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,]+)/);
        if (match) retweets = parseInt(match[1].replace(/,/g, '')) || null;
      }
      
      if (likeButton) {
        const ariaLabel = likeButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,]+)/);
        if (match) likes = parseInt(match[1].replace(/,/g, '')) || null;
      }
      
      // Try to find bookmarks (may not be available)
      const bookmarkButton = document.querySelector('[data-testid="bookmark"]');
      if (bookmarkButton) {
        const ariaLabel = bookmarkButton.getAttribute('aria-label') || '';
        const match = ariaLabel.match(/([\d,]+)/);
        if (match) bookmarks = parseInt(match[1].replace(/,/g, '')) || null;
      }
      
      return { likes, replies, retweets, bookmarks };
    });
    
    return metrics;
  } catch (error: any) {
    console.warn(`[POLL_METRICS] Failed to scrape ${tweetId}: ${error.message}`);
    return { likes: null, replies: null, retweets: null, bookmarks: null };
  }
}

async function main(): Promise<void> {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        📊 POLL REPLY METRICS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const supabase = getSupabaseClient();
  const result: PollResult = {
    replies_polled: 0,
    metrics_updated: 0,
    errors: 0,
    summary: [],
  };
  
  // Get last N posted replies that haven't been polled recently
  const lastPolledThreshold = new Date(Date.now() - POLL_INTERVAL_HOURS * 60 * 60 * 1000).toISOString();
  
  const { data: replies, error: repliesError } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, target_tweet_id, posted_at, actual_likes, actual_replies, actual_retweets')
    .eq('decision_type', 'reply')
    .eq('status', 'posted')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(MAX_REPLIES_TO_POLL);
  
  if (repliesError) {
    console.error(`[POLL_METRICS] ❌ Failed to fetch replies: ${repliesError.message}`);
    process.exit(1);
  }
  
  if (!replies || replies.length === 0) {
    console.log(`[POLL_METRICS] ⚠️  No posted replies found`);
    console.log(JSON.stringify(result));
    process.exit(0);
  }
  
  console.log(`[POLL_METRICS] 📊 Found ${replies.length} replies to poll\n`);
  
  const pool = UnifiedBrowserPool.getInstance();
  const page = await pool.acquirePage('poll_reply_metrics');
  
  try {
    for (const reply of replies) {
      if (!reply.tweet_id) continue;
      
      result.replies_polled++;
      console.log(`[POLL_METRICS] 🔍 Polling reply ${result.replies_polled}/${replies.length}: ${reply.tweet_id}`);
      
      try {
        const metrics = await scrapeTweetMetrics(page, reply.tweet_id);
        
        // Update content_metadata with metrics
        const { error: updateError } = await supabase
          .from('content_metadata')
          .update({
            actual_likes: metrics.likes,
            actual_replies: metrics.replies,
            actual_retweets: metrics.retweets,
            // Note: bookmarks may not be available in content_metadata schema
            // Store in outcomes table if needed
            updated_at: new Date().toISOString(),
          })
          .eq('decision_id', reply.decision_id);
        
        if (updateError) {
          console.error(`[POLL_METRICS]   ❌ Failed to update: ${updateError.message}`);
          result.errors++;
        } else {
          result.metrics_updated++;
          result.summary.push({
            decision_id: reply.decision_id,
            tweet_id: reply.tweet_id,
            likes: metrics.likes,
            replies: metrics.replies,
            retweets: metrics.retweets,
            bookmarks: metrics.bookmarks,
          });
          console.log(`[POLL_METRICS]   ✅ Updated: likes=${metrics.likes}, replies=${metrics.replies}, retweets=${metrics.retweets}`);
        }
        
        // Small delay between polls
        await page.waitForTimeout(2000);
        
      } catch (error: any) {
        console.error(`[POLL_METRICS]   ❌ Error polling ${reply.tweet_id}: ${error.message}`);
        result.errors++;
      }
    }
  } finally {
    await pool.releasePage(page);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('                    RESULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const summaryLine = {
    replies_polled: result.replies_polled,
    metrics_updated: result.metrics_updated,
    errors: result.errors,
  };
  console.log(JSON.stringify(summaryLine));
  
  if (result.metrics_updated > 0) {
    console.log(`\n✅ SUCCESS: Updated metrics for ${result.metrics_updated} reply(ies)`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  No metrics updated`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

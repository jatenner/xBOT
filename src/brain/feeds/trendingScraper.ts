/**
 * Brain Feed: Trending Scraper
 *
 * Scrapes the Explore/Trending page with NO content filters.
 * Captures everything Twitter's algorithm is surfacing.
 * Also extracts trending topic names for keyword pool expansion.
 */

import { getBrainAuthPage, brainGoto, waitForTweets, scrollForMore } from './brainNavigator';
import {
  extractTweetsFromPage,
  extractTrendingTopics,
  ingestFeedResults,
  type FeedResult,
} from '../discoveryEngine';
import { upsertBrainKeywords } from '../db';

const LOG_PREFIX = '[brain/feed/trending]';
const SCROLL_COUNT = 5;
const SCROLL_DELAY_MS = 1500;
const MAX_TWEETS = 100;

export async function runTrendingScraper(): Promise<{ tweets_ingested: number; topics_found: number }> {
  const feedRunId = `brain_trending_${Date.now()}`;

  try {
    const page = await getBrainAuthPage(); // Explore requires auth
    const result = await (async () => {

      try {
        // Navigate to Explore (public page — no auth needed)
        const nav = await brainGoto(page, 'https://x.com/explore');
        if (!nav.success) {
          console.warn(`${LOG_PREFIX} Navigation failed`);
          return { tweets: [], topics: [] };
        }

        // Wait for content
        const count = await waitForTweets(page, 15000);
        if (count === 0) {
          console.warn(`${LOG_PREFIX} No tweets found on trending page`);
          return { tweets: [], topics: [] };
        }

        // Extract trending topic names (before scrolling)
        const topics = await extractTrendingTopics(page);

        // Scroll to load more tweets
        await scrollForMore(page, SCROLL_COUNT, SCROLL_DELAY_MS);

        // Extract ALL tweets — no health filter, no engagement filter
        const tweets = await extractTweetsFromPage(page, {
          maxTweets: MAX_TWEETS,
          skipReplies: true,
        });

        console.log(`${LOG_PREFIX} Extracted ${tweets.length} tweets, ${topics.length} trending topics`);
        return { tweets, topics };
      } finally {
        await page.close();
      }
    })();

    // Ingest tweets
    const feedResult: FeedResult = {
      source: 'trending',
      feed_run_id: feedRunId,
      tweets: result.tweets,
    };

    const ingested = await ingestFeedResults([feedResult]);

    // Add trending topics to keyword pool
    let topicsAdded = 0;
    if (result.topics.length > 0) {
      const keywordsToAdd = result.topics.map(topic => ({
        keyword: topic.toLowerCase().trim(),
        source: 'trending' as const,
        source_detail: `trending_${new Date().toISOString().slice(0, 10)}`,
        priority: 0.7, // Trending topics get high priority
        is_active: true,
      }));

      topicsAdded = await upsertBrainKeywords(keywordsToAdd);
      if (topicsAdded > 0) {
        console.log(`${LOG_PREFIX} Added ${topicsAdded} trending topics to keyword pool`);
      }
    }

    return {
      tweets_ingested: ingested.total_ingested,
      topics_found: topicsAdded,
    };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Error:`, err.message);
    return { tweets_ingested: 0, topics_found: 0 };
  }
}

/**
 * Brain Feed: For You Scraper
 *
 * Scrapes the authenticated For You timeline.
 * This captures what Twitter's algorithm is choosing to show US —
 * a direct window into algorithmic preferences.
 */

import { getBrainAuthPage, brainGoto, waitForTweets, scrollForMore } from './brainNavigator';
import {
  extractTweetsFromPage,
  ingestFeedResults,
  type FeedResult,
} from '../discoveryEngine';

const LOG_PREFIX = '[brain/feed/foryou]';
const SCROLL_COUNT = 5;
const SCROLL_DELAY_MS = 1500;
const MAX_TWEETS = 120;

export async function runForYouScraper(): Promise<{ tweets_ingested: number }> {
  const feedRunId = `brain_foryou_${Date.now()}`;

  try {
    const tweets = await (async () => {
      const page = await getBrainAuthPage(); // For You requires auth

      try {
        // Navigate to home — requires auth, will get login wall if not authenticated
        const nav = await brainGoto(page, 'https://x.com/home');
        if (!nav.success || nav.loginWall) {
          console.warn(`${LOG_PREFIX} For You requires auth — skipping`);
          return [];
        }

        // Wait for tweets to load
        const count = await waitForTweets(page, 15000);
        if (count === 0) {
          console.warn(`${LOG_PREFIX} No tweets found on For You page`);
          return [];
        }

        // Scroll to load more content
        await scrollForMore(page, SCROLL_COUNT, SCROLL_DELAY_MS);

        // Extract all visible tweets (no filters — we want everything the algo shows)
        const extracted = await extractTweetsFromPage(page, {
          maxTweets: MAX_TWEETS,
          skipReplies: false, // Include replies the algo surfaces — that's signal too
        });

        console.log(`${LOG_PREFIX} Extracted ${extracted.length} tweets from For You feed`);
        return extracted;
      } finally {
        await page.close();
      }
    })();

    if (tweets.length === 0) {
      return { tweets_ingested: 0 };
    }

    // Ingest results
    const feedResult: FeedResult = {
      source: 'foryou',
      feed_run_id: feedRunId,
      tweets,
    };

    const ingested = await ingestFeedResults([feedResult]);

    return { tweets_ingested: ingested.total_ingested };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Error:`, err.message);
    return { tweets_ingested: 0 };
  }
}

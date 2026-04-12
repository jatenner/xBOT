/**
 * Brain Feed: Broad Keyword Searcher
 *
 * Searches Twitter using keywords from brain_keywords table.
 * Self-expanding: keyword pool grows from trending topics and entity extraction.
 * NOT health-locked — searches for keywords across all domains.
 */

import { getBrainAuthPage, brainGoto, waitForTweets } from './brainNavigator';
import {
  extractTweetsFromPage,
  ingestFeedResults,
  type FeedResult,
  type RawScrapedTweet,
} from '../discoveryEngine';
import { getKeywordsForSearch, updateKeywordAfterSearch } from '../db';

const LOG_PREFIX = '[brain/feed/keyword]';
const KEYWORDS_PER_RUN = 8;
const TWEETS_PER_KEYWORD = 30;
const DELAY_BETWEEN_KEYWORDS_MS = 1500;

export async function runBroadKeywordSearcher(): Promise<{ tweets_ingested: number; keywords_searched: number }> {
  // Get next keywords to search (ordered by staleness)
  const keywords = await getKeywordsForSearch(KEYWORDS_PER_RUN);
  if (keywords.length === 0) {
    console.log(`${LOG_PREFIX} No active keywords found`);
    return { tweets_ingested: 0, keywords_searched: 0 };
  }

  const feedRunId = `brain_keyword_${Date.now()}`;
  const allResults: FeedResult[] = [];
  let keywordsSearched = 0;

  try {
    const page = await getBrainAuthPage(); // Search requires auth
    await (async () => {

      try {
        for (const kw of keywords) {
          const keyword = kw.keyword;

          // Build search URL with "Latest" tab for fresh results
          const searchUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=typed_query&f=live`;

          const nav = await brainGoto(page, searchUrl);
          if (!nav.success) {
            if (nav.loginWall) {
              console.warn(`${LOG_PREFIX} Login wall for "${keyword}" — skipping`);
              continue;
            }
            continue;
          }

          // Wait for tweets
          const tweetCount = await waitForTweets(page, 10000);
          if (tweetCount === 0) {
            console.warn(`${LOG_PREFIX} No tweets found for "${keyword}"`);
            await updateKeywordAfterSearch(keyword, 0, null, 0, 0);
            continue;
          }

          // Scroll once to get more results
          await page.evaluate(() => window.scrollBy(0, 800));
          await page.waitForTimeout(1500);

          // Extract tweets
          const tweets = await extractTweetsFromPage(page, {
            maxTweets: TWEETS_PER_KEYWORD,
            skipReplies: false, // Capture replies — reply strategy is critical learning data
          });

          // Compute keyword performance stats
          const avgEngagement = tweets.length > 0
            ? tweets.reduce((sum, t) => sum + (t.likes ?? 0), 0) / tweets.length
            : 0;
          const viralCount = tweets.filter(t => (t.likes ?? 0) >= 100).length;
          const uniqueAuthors = new Set(tweets.map(t => t.author_username)).size;

          // Update keyword stats
          await updateKeywordAfterSearch(keyword, tweets.length, avgEngagement, viralCount, uniqueAuthors);

          if (tweets.length > 0) {
            allResults.push({
              source: 'keyword',
              keyword,
              feed_run_id: feedRunId,
              tweets,
            });
          }

          keywordsSearched++;
          console.log(`${LOG_PREFIX} "${keyword}": ${tweets.length} tweets, ${viralCount} viral, avg ${Math.round(avgEngagement)} likes`);

          // Delay between keywords
          if (keywords.indexOf(kw) < keywords.length - 1) {
            await page.waitForTimeout(DELAY_BETWEEN_KEYWORDS_MS);
          }
        }
      } finally {
        await page.close();
      }
    })();

    // Ingest all results
    const ingested = await ingestFeedResults(allResults);

    return {
      tweets_ingested: ingested.total_ingested,
      keywords_searched: keywordsSearched,
    };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Error:`, err.message);
    return { tweets_ingested: 0, keywords_searched: keywordsSearched };
  }
}

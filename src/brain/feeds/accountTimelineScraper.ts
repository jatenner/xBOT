/**
 * Brain Feed: Account Timeline Scraper
 *
 * Scrapes timelines of accounts from brain_accounts table.
 * Prioritizes by staleness (least recently scraped first).
 * Domain-agnostic — scrapes any tracked account regardless of niche.
 */

import { getBrainPage, brainGoto, waitForTweets } from './brainNavigator';
import {
  extractTweetsFromPage,
  extractFollowerCount,
  ingestFeedResults,
  type FeedResult,
} from '../discoveryEngine';
import { getAccountsForScraping, updateAccountAfterScrape } from '../db';

const LOG_PREFIX = '[brain/feed/timeline]';
const ACCOUNTS_PER_RUN = 50;
const TWEETS_PER_ACCOUNT_DEFAULT = 15;
const TWEETS_PER_ACCOUNT_HIGH_TIER = 30;
const TWEETS_PER_ACCOUNT_LOW_TIER = 5;
// Growing accounts get deep scraping — we need their FULL recent activity
const TWEETS_PER_ACCOUNT_GROWING = 100;
const DELAY_BETWEEN_ACCOUNTS_MS = 1500;

export async function runAccountTimelineScraper(): Promise<{ tweets_ingested: number; accounts_scraped: number }> {
  // Get accounts ordered by staleness
  const accounts = await getAccountsForScraping(ACCOUNTS_PER_RUN);
  if (accounts.length === 0) {
    console.log(`${LOG_PREFIX} No accounts to scrape`);
    return { tweets_ingested: 0, accounts_scraped: 0 };
  }

  const feedRunId = `brain_timeline_${Date.now()}`;
  const allResults: FeedResult[] = [];
  let accountsScraped = 0;

  try {
    const page = await getBrainPage();
    await (async () => {

      try {
        for (const account of accounts) {
          const username = account.username;
          const profileUrl = `https://x.com/${username}`;

          const nav = await brainGoto(page, profileUrl);
          if (!nav.success) {
            if (nav.loginWall) {
              console.warn(`${LOG_PREFIX} Login wall for @${username}`);
            }
            await updateAccountAfterScrape(username, false, 0);
            continue;
          }

          // Wait for tweets to load
          const tweetCount = await waitForTweets(page, 10000);
          if (tweetCount === 0) {
            console.warn(`${LOG_PREFIX} No tweets found for @${username}`);
            await updateAccountAfterScrape(username, false, 0);
            continue;
          }

          // Extract follower count from profile
          const followerCount = await extractFollowerCount(page);

          // Growth-aware tweet depth: growing accounts get DEEP scraping
          const isGrowing = (account as any).growth_status === 'hot' || (account as any).growth_status === 'explosive';
          const isHighTier = account.tier === 'S' || account.tier === 'A';
          const isLowTier = account.tier === 'C' || account.tier === 'dormant';
          const tweetsToFetch = isGrowing
            ? TWEETS_PER_ACCOUNT_GROWING
            : isHighTier
              ? TWEETS_PER_ACCOUNT_HIGH_TIER
              : isLowTier
                ? TWEETS_PER_ACCOUNT_LOW_TIER
                : TWEETS_PER_ACCOUNT_DEFAULT;

          // Scroll to load tweets — growing accounts need many scrolls for 100+ tweets
          const scrollCount = isGrowing ? 12 : isHighTier ? 3 : 0;
          for (let s = 0; s < scrollCount; s++) {
            await page.evaluate(() => window.scrollBy(0, 1200));
            await page.waitForTimeout(1500);
          }

          // Extract tweets from timeline
          // ALWAYS capture replies for growing accounts — reply strategy is critical behavioral data
          // Skip replies only for non-growing C/dormant accounts
          const tweets = await extractTweetsFromPage(page, {
            maxTweets: tweetsToFetch,
            skipReplies: isLowTier && !isGrowing,
          });

          if (isGrowing) {
            console.log(`${LOG_PREFIX} 🔥 GROWING @${username} (${(account as any).growth_status}): deep scrape ${tweets.length} tweets`);
          }

          // Enrich tweets with profile data
          for (const tweet of tweets) {
            tweet.author_username = username;
            if (followerCount && !tweet.author_followers) {
              tweet.author_followers = followerCount;
            }
          }

          // Record scrape result
          await updateAccountAfterScrape(username, true, tweets.length);

          if (tweets.length > 0) {
            allResults.push({
              source: 'timeline',
              feed_run_id: feedRunId,
              tweets,
            });
          }

          accountsScraped++;
          console.log(`${LOG_PREFIX} @${username}: ${tweets.length} tweets, ${followerCount ?? '?'} followers`);

          // Delay between accounts
          if (accounts.indexOf(account) < accounts.length - 1) {
            await page.waitForTimeout(DELAY_BETWEEN_ACCOUNTS_MS);
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
      accounts_scraped: accountsScraped,
    };
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Error:`, err.message);
    return { tweets_ingested: 0, accounts_scraped: accountsScraped };
  }
}

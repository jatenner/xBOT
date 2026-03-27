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
const ACCOUNTS_PER_RUN = 12;
const TWEETS_PER_ACCOUNT_DEFAULT = 8;
// S/A tier accounts get more tweets scraped — we need their failures too
const TWEETS_PER_ACCOUNT_HIGH_TIER = 20;
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

          // S/A tier accounts: scrape more tweets to capture wins AND failures
          const isHighTier = account.tier === 'S' || account.tier === 'A';
          const tweetsToFetch = isHighTier ? TWEETS_PER_ACCOUNT_HIGH_TIER : TWEETS_PER_ACCOUNT_DEFAULT;

          // Scroll more for high-tier accounts to load more tweets
          if (isHighTier) {
            for (let s = 0; s < 3; s++) {
              await page.evaluate(() => window.scrollBy(0, 1200));
              await page.waitForTimeout(1500);
            }
          }

          // Extract tweets from timeline
          const tweets = await extractTweetsFromPage(page, {
            maxTweets: tweetsToFetch,
            skipReplies: true,
          });

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

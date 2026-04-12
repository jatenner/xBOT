/**
 * Brain Feed: Account Timeline Scraper
 *
 * Scrapes timelines of accounts from brain_accounts table.
 * Prioritizes by staleness (least recently scraped first).
 * Domain-agnostic — scrapes any tracked account regardless of niche.
 *
 * PARALLELIZED: Uses brainBrowserPool.submitBatch to scrape across
 * N parallel browsers (default 3). This 3x throughput vs sequential.
 */

import { submitBatch } from './brainBrowserPool';
import { brainGoto, waitForTweets } from './brainNavigator';
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
const TWEETS_PER_ACCOUNT_GROWING = 100;

export async function runAccountTimelineScraper(): Promise<{ tweets_ingested: number; accounts_scraped: number }> {
  const accounts = await getAccountsForScraping(ACCOUNTS_PER_RUN);
  if (accounts.length === 0) {
    console.log(`${LOG_PREFIX} No accounts to scrape`);
    return { tweets_ingested: 0, accounts_scraped: 0 };
  }

  const feedRunId = `brain_timeline_${Date.now()}`;
  const allResults: FeedResult[] = [];
  let accountsScraped = 0;

  // Build parallel tasks — each account gets its own page from the pool
  const tasks = accounts.map((account) => {
    return async (page: any) => {
      const username = account.username;
      const profileUrl = `https://x.com/${username}`;

      const nav = await brainGoto(page, profileUrl);
      if (!nav.success) {
        if (nav.loginWall) {
          console.warn(`${LOG_PREFIX} Login wall for @${username}`);
        }
        await updateAccountAfterScrape(username, false, 0);
        return;
      }

      const tweetCount = await waitForTweets(page, 10000);
      if (tweetCount === 0) {
        await updateAccountAfterScrape(username, false, 0);
        return;
      }

      const followerCount = await extractFollowerCount(page);

      // Growth-aware tweet depth
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

      // Scroll for more tweets
      const scrollCount = isGrowing ? 12 : isHighTier ? 3 : 0;
      for (let s = 0; s < scrollCount; s++) {
        await page.evaluate('window.scrollBy(0, 1200)');
        await page.waitForTimeout(1500);
      }

      const tweets = await extractTweetsFromPage(page, {
        maxTweets: tweetsToFetch,
        skipReplies: isLowTier && !isGrowing,
      });

      if (isGrowing) {
        console.log(`${LOG_PREFIX} GROWING @${username} (${(account as any).growth_status}): deep scrape ${tweets.length} tweets`);
      }

      // Also scrape /with_replies tab for interesting+ accounts
      // This is where reply strategy data lives — who they reply to, how often, etc.
      let replyTweets: any[] = [];
      const isInterestingPlus = isGrowing || (account as any).growth_status === 'interesting';
      if (isInterestingPlus) {
        try {
          const replyNav = await brainGoto(page, `https://x.com/${username}/with_replies`, 12000);
          if (replyNav.success) {
            const replyCount = await waitForTweets(page, 8000);
            if (replyCount > 0) {
              // Scroll a few times to get more replies
              for (let rs = 0; rs < 3; rs++) {
                await page.evaluate('window.scrollBy(0, 1200)');
                await page.waitForTimeout(1500);
              }
              replyTweets = await extractTweetsFromPage(page, {
                maxTweets: isGrowing ? 50 : 20,
                skipReplies: false,
              });
              // Mark author for any tweets from this user
              for (const rt of replyTweets) {
                rt.author_username = username;
                if (followerCount && !rt.author_followers) rt.author_followers = followerCount;
              }
            }
          }
        } catch {
          // Non-fatal — reply tab scraping is bonus data
        }
      }

      const allTweets = [...tweets, ...replyTweets];

      for (const tweet of allTweets) {
        tweet.author_username = username;
        if (followerCount && !tweet.author_followers) {
          tweet.author_followers = followerCount;
        }
      }

      await updateAccountAfterScrape(username, true, allTweets.length);

      if (allTweets.length > 0) {
        allResults.push({
          source: 'timeline',
          feed_run_id: feedRunId,
          tweets: allTweets,
        });
      }

      accountsScraped++;
      console.log(`${LOG_PREFIX} @${username}: ${tweets.length} tweets, ${followerCount ?? '?'} followers`);
    };
  });

  // Run in parallel across browser pool
  try {
    const { completed, errors } = await submitBatch('medium', tasks);
    console.log(`${LOG_PREFIX} Parallel batch: ${completed} completed, ${errors} errors`);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Batch error: ${err.message}`);
  }

  // Ingest all collected results
  if (allResults.length > 0) {
    const ingested = await ingestFeedResults(allResults);
    return {
      tweets_ingested: ingested.total_ingested,
      accounts_scraped: accountsScraped,
    };
  }

  return { tweets_ingested: 0, accounts_scraped: accountsScraped };
}

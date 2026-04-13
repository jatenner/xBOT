/**
 * Brain Feed: Account Timeline Scraper
 *
 * Scrapes timelines of accounts from brain_accounts table.
 * Prioritizes by staleness (least recently scraped first).
 * Domain-agnostic — scrapes any tracked account regardless of niche.
 *
 * Uses anonymous browsing — profile pages are public on Twitter.
 * Also visits /with_replies tab for growing accounts to capture reply strategy data.
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
const ACCOUNTS_PER_RUN = 15; // 15 accounts × 2 pages each (Posts + with_replies) fits in 5-min window
const TWEETS_PER_ACCOUNT_DEFAULT = 15;
const TWEETS_PER_ACCOUNT_HIGH_TIER = 30;
const TWEETS_PER_ACCOUNT_LOW_TIER = 5;
const TWEETS_PER_ACCOUNT_GROWING = 100;
const DELAY_BETWEEN_ACCOUNTS_MS = 1500;

export async function runAccountTimelineScraper(): Promise<{ tweets_ingested: number; accounts_scraped: number }> {
  const accounts = await getAccountsForScraping(ACCOUNTS_PER_RUN);
  if (accounts.length === 0) {
    console.log(`${LOG_PREFIX} No accounts to scrape`);
    return { tweets_ingested: 0, accounts_scraped: 0 };
  }

  const feedRunId = `brain_timeline_${Date.now()}`;
  const allResults: FeedResult[] = [];
  let accountsScraped = 0;

  let page: any;
  try {
    page = await getBrainPage(); // Anonymous — profiles are public
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed to get browser page: ${err.message}`);
    return { tweets_ingested: 0, accounts_scraped: 0 };
  }

  try {
    for (const account of accounts) {
      const username = account.username;
      const profileUrl = `https://x.com/${username}`;

      const nav = await brainGoto(page, profileUrl);
      if (!nav.success) {
        await updateAccountAfterScrape(username, false, 0);
        continue;
      }

      const tweetCount = await waitForTweets(page, 10000);
      if (tweetCount === 0) {
        await updateAccountAfterScrape(username, false, 0);
        continue;
      }

      const followerCount = await extractFollowerCount(page);

      // Growth-aware tweet depth
      const isGrowing = (account as any).growth_status === 'hot' || (account as any).growth_status === 'explosive';
      const isInteresting = (account as any).growth_status === 'interesting';
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

      // ALWAYS capture replies — they're critical behavioral data
      const tweets = await extractTweetsFromPage(page, {
        maxTweets: tweetsToFetch,
        skipReplies: false,
      });

      if (isGrowing) {
        console.log(`${LOG_PREFIX} GROWING @${username} (${(account as any).growth_status}): deep scrape ${tweets.length} tweets`);
      }

      // Scrape /with_replies tab for ALL accounts — reply data is critical
      // The Posts tab filters out replies. /with_replies shows everything.
      // This is how we learn reply strategy: who they reply to, how often, what they say.
      let replyTweets: any[] = [];
      {
        try {
          const replyUrl = `https://x.com/${username}/with_replies`;
          const replyNav = await brainGoto(page, replyUrl, 12000);
          if (!replyNav.success) {
            console.log(`${LOG_PREFIX} @${username}: /with_replies nav failed (loginWall=${replyNav.loginWall})`);
          }
          if (replyNav.success) {
            const rc = await waitForTweets(page, 8000);
            if (rc === 0) {
              console.log(`${LOG_PREFIX} @${username}: /with_replies loaded but 0 tweet articles found`);
            }
            if (rc > 0) {
              const replyScrolls = isGrowing ? 5 : isHighTier ? 3 : 1;
              for (let rs = 0; rs < replyScrolls; rs++) {
                await page.evaluate('window.scrollBy(0, 1200)');
                await page.waitForTimeout(1500);
              }
              replyTweets = await extractTweetsFromPage(page, {
                maxTweets: isGrowing ? 50 : isHighTier ? 20 : 10,
                skipReplies: false,
              });
            }
          }
        } catch {
          // Non-fatal
        }
      }

      // Deduplicate — /with_replies may overlap with Posts tab
      const seenTweetIds = new Set(tweets.map(t => t.tweet_id).filter(Boolean));
      const uniqueReplies = replyTweets.filter(t => t.tweet_id && !seenTweetIds.has(t.tweet_id));
      const allTweets = [...tweets, ...uniqueReplies];

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
      const replyTabTotal = replyTweets.length;
      const uniqueReplyCount = uniqueReplies.length;
      const detectedReplies = allTweets.filter(t => (t as any).tweet_type === 'reply').length;
      console.log(`${LOG_PREFIX} @${username}: ${tweets.length} posts + ${replyTabTotal} from reply tab (${uniqueReplyCount} new, ${detectedReplies} detected as replies), ${followerCount ?? '?'} followers`);

      // Delay between accounts
      if (accounts.indexOf(account) < accounts.length - 1) {
        await page.waitForTimeout(DELAY_BETWEEN_ACCOUNTS_MS);
      }
    }
  } finally {
    try { await page.close(); } catch {}
  }

  // Ingest all results
  if (allResults.length > 0) {
    const ingested = await ingestFeedResults(allResults);
    return {
      tweets_ingested: ingested.total_ingested,
      accounts_scraped: accountsScraped,
    };
  }

  return { tweets_ingested: 0, accounts_scraped: accountsScraped };
}

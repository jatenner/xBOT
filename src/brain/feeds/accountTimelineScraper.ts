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

import { getBrainPage, getBrainAuthPage, brainGoto, waitForTweets } from './brainNavigator';
import {
  extractTweetsFromPage,
  extractFollowerCount,
  ingestFeedResults,
  type FeedResult,
} from '../discoveryEngine';
import { getAccountsForScraping, updateAccountAfterScrape } from '../db';

const LOG_PREFIX = '[brain/feed/timeline]';
const ACCOUNTS_PER_RUN = 20; // 20 accounts per run, growing accounts get both tabs
const TWEETS_PER_ACCOUNT_DEFAULT = 15;
const TWEETS_PER_ACCOUNT_HIGH_TIER = 30;
const TWEETS_PER_ACCOUNT_LOW_TIER = 5;
const TWEETS_PER_ACCOUNT_GROWING = 100;
const TWEETS_FROM_WITH_REPLIES_TAB = 60;
const WITH_REPLIES_SCROLL_COUNT = 8;
const DELAY_BETWEEN_ACCOUNTS_MS = 1000;

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

  // Lazy-init an authed page only when we first hit a growing account.
  // The auth context uses a read-only burner session (TWITTER_SESSION_B64)
  // to access /with_replies, which is blocked for anonymous users.
  let authPage: any = null;
  let authPageUnavailable = false;
  let replyTabSuccess = 0;
  let replyTabFailures = 0;

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

      // /with_replies tab — captures the OUTBOUND reply graph (this account's replies
      // to other accounts). Blocked for anonymous users, so we use an authed read-only
      // burner session. Gated to growing accounts (interesting/hot/explosive) to limit
      // session heat and auth-page load.
      let replyTweets: any[] = [];
      const shouldFetchWithReplies = isGrowing || isInteresting;
      if (shouldFetchWithReplies && !authPageUnavailable) {
        if (!authPage) {
          try {
            authPage = await getBrainAuthPage();
          } catch (err: any) {
            console.warn(`${LOG_PREFIX} Auth page unavailable, skipping /with_replies: ${err.message}`);
            authPageUnavailable = true;
          }
        }
        if (authPage) {
          const wrUrl = `https://x.com/${username}/with_replies`;
          const wrNav = await brainGoto(authPage, wrUrl);
          if (wrNav.loginWall) {
            console.warn(`${LOG_PREFIX} Auth session hit login wall — disabling /with_replies for this run`);
            authPageUnavailable = true;
          } else if (wrNav.success) {
            const wrTweetCount = await waitForTweets(authPage, 10000);
            if (wrTweetCount > 0) {
              for (let s = 0; s < WITH_REPLIES_SCROLL_COUNT; s++) {
                await authPage.evaluate('window.scrollBy(0, 1200)');
                await authPage.waitForTimeout(1500);
              }
              replyTweets = await extractTweetsFromPage(authPage, {
                maxTweets: TWEETS_FROM_WITH_REPLIES_TAB,
                skipReplies: false,
              });
              replyTabSuccess++;
            } else {
              replyTabFailures++;
            }
          } else {
            replyTabFailures++;
          }
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
    if (authPage) {
      try { await authPage.close(); } catch {}
    }
    if (replyTabSuccess + replyTabFailures > 0) {
      console.log(`${LOG_PREFIX} /with_replies summary: ${replyTabSuccess} ok, ${replyTabFailures} failed`);
    }
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

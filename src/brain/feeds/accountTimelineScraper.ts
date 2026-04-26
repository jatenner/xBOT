/**
 * Brain Feed: Account Timeline Scraper
 *
 * Scrapes timelines of accounts from brain_accounts table.
 * Prioritizes by staleness (least recently scraped first).
 * Domain-agnostic — scrapes any tracked account regardless of niche.
 *
 * Profile timeline scraping uses the anon pool. /with_replies (auth-required)
 * uses the auth pool. The two run in parallel via submitBatch + submitBatchAuth.
 */

import { submitBatch, submitBatchAuth } from './brainBrowserPool';
import { brainGoto, waitForTweets } from './brainNavigator';
import {
  extractTweetsFromPage,
  extractFollowerCount,
  ingestFeedResults,
  type FeedResult,
} from '../discoveryEngine';
import { getAccountsForScraping, updateAccountAfterScrape } from '../db';
import type { Page } from 'playwright';

const LOG_PREFIX = '[brain/feed/timeline]';
const ACCOUNTS_PER_RUN = 20; // 20 accounts per run, growing accounts get both tabs

// Tweet-depth caps per account-tier (in tweets per visit). Was 5 for low-tier
// historically, which combined with 88% of accounts being C-tier produced a
// brain-wide median of 5 tweets/account — far below the ~50 threshold the
// growth-attribution literature (Cheng 2014, Gilbert 2013) requires for
// distributional change-detection. Now: low-tier still gets a meaningful read.
const TWEETS_PER_ACCOUNT_DEFAULT = 15;
const TWEETS_PER_ACCOUNT_HIGH_TIER = 30;
const TWEETS_PER_ACCOUNT_LOW_TIER = 30;   // was 5
const TWEETS_PER_ACCOUNT_GROWING = 100;
const TWEETS_FROM_WITH_REPLIES_TAB = 60;
const WITH_REPLIES_SCROLL_COUNT = 8;

interface PerAccountResult {
  profileTweets: any[];
  replyTabTweets: any[];
  followerCount: number | null;
  profileSucceeded: boolean;
}

export async function runAccountTimelineScraper(): Promise<{ tweets_ingested: number; accounts_scraped: number }> {
  const accounts = await getAccountsForScraping(ACCOUNTS_PER_RUN);
  if (accounts.length === 0) {
    console.log(`${LOG_PREFIX} No accounts to scrape`);
    return { tweets_ingested: 0, accounts_scraped: 0 };
  }

  const feedRunId = `brain_timeline_${Date.now()}`;
  const startedAt = Date.now();

  // Per-account scratchpad. Single-threaded JS means Map.set/get from inside
  // each pooled task is safe without locks.
  const resultsByUsername = new Map<string, PerAccountResult>();
  for (const account of accounts) {
    resultsByUsername.set(account.username, {
      profileTweets: [],
      replyTabTweets: [],
      followerCount: null,
      profileSucceeded: false,
    });
  }

  // -- Profile (anon) tasks: one per account --
  const profileTasks: ((page: Page) => Promise<void>)[] = accounts.map(account => async (page: Page) => {
    const username = account.username;
    const profileUrl = `https://x.com/${username}`;
    const result = resultsByUsername.get(username)!;

    const nav = await brainGoto(page, profileUrl);
    if (!nav.success) return;

    const tweetCount = await waitForTweets(page, 10000);
    if (tweetCount === 0) return;

    result.followerCount = await extractFollowerCount(page);

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

    // Scroll depth must match tweetsToFetch — without scrolls, X loads only ~10
    // tweets initially, capping ingestion regardless of the per-account quota.
    const scrollCount = isGrowing ? 12 : isHighTier ? 4 : isLowTier ? 3 : 2;
    for (let s = 0; s < scrollCount; s++) {
      await page.evaluate('window.scrollBy(0, 1200)');
      await page.waitForTimeout(1500);
    }

    const tweets = await extractTweetsFromPage(page, {
      maxTweets: tweetsToFetch,
      skipReplies: false,
    });

    result.profileTweets = tweets;
    result.profileSucceeded = true;

    if (isGrowing) {
      console.log(`${LOG_PREFIX} GROWING @${username} (${(account as any).growth_status}): deep scrape ${tweets.length} tweets`);
    }
  });

  // -- /with_replies (auth) tasks: one per growing/interesting account --
  const replyTabAccounts = accounts.filter(a => {
    const status = (a as any).growth_status;
    return status === 'hot' || status === 'explosive' || status === 'interesting';
  });
  let replyTabSuccess = 0;
  let replyTabFailures = 0;
  const replyTabTasks: ((page: Page) => Promise<void>)[] = replyTabAccounts.map(account => async (authPage: Page) => {
    const username = account.username;
    const result = resultsByUsername.get(username)!;
    const wrUrl = `https://x.com/${username}/with_replies`;

    const wrNav = await brainGoto(authPage, wrUrl);
    if (wrNav.loginWall) {
      console.warn(`${LOG_PREFIX} Auth session hit login wall on @${username}`);
      replyTabFailures++;
      return;
    }
    if (!wrNav.success) {
      replyTabFailures++;
      return;
    }
    const wrTweetCount = await waitForTweets(authPage, 10000);
    if (wrTweetCount === 0) {
      replyTabFailures++;
      return;
    }
    for (let s = 0; s < WITH_REPLIES_SCROLL_COUNT; s++) {
      await authPage.evaluate('window.scrollBy(0, 1200)');
      await authPage.waitForTimeout(1500);
    }
    const replyTweets = await extractTweetsFromPage(authPage, {
      maxTweets: TWEETS_FROM_WITH_REPLIES_TAB,
      skipReplies: false,
    });
    result.replyTabTweets = replyTweets;
    replyTabSuccess++;
  });

  // Run profile and reply-tab batches in parallel.
  // The anon and auth pools are independent, so neither blocks the other.
  const profileBatchPromise = submitBatch('medium', profileTasks);
  const replyTabBatchPromise = replyTabTasks.length > 0
    ? submitBatchAuth('medium', replyTabTasks).catch((err: any) => {
        console.warn(`${LOG_PREFIX} Auth pool unavailable, /with_replies skipped: ${err.message}`);
        return { completed: 0, errors: replyTabTasks.length };
      })
    : Promise.resolve({ completed: 0, errors: 0 });

  const [profileBatch, replyTabBatch] = await Promise.all([
    profileBatchPromise,
    replyTabBatchPromise,
  ]);

  // Aggregate per-account results, dedupe, ingest.
  const allResults: FeedResult[] = [];
  let accountsScraped = 0;

  for (const account of accounts) {
    const username = account.username;
    const result = resultsByUsername.get(username)!;

    if (!result.profileSucceeded) {
      await updateAccountAfterScrape(username, false, 0);
      continue;
    }

    const seenTweetIds = new Set(result.profileTweets.map(t => t.tweet_id).filter(Boolean));
    const uniqueReplies = result.replyTabTweets.filter(t => t.tweet_id && !seenTweetIds.has(t.tweet_id));
    const allTweets = [...result.profileTweets, ...uniqueReplies];

    for (const tweet of allTweets) {
      tweet.author_username = username;
      if (result.followerCount && !tweet.author_followers) {
        tweet.author_followers = result.followerCount;
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
    const detectedReplies = allTweets.filter(t => (t as any).tweet_type === 'reply').length;
    console.log(
      `${LOG_PREFIX} @${username}: ${result.profileTweets.length} posts + ${result.replyTabTweets.length} from reply tab ` +
      `(${uniqueReplies.length} new, ${detectedReplies} detected as replies), ${result.followerCount ?? '?'} followers`
    );
  }

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `${LOG_PREFIX} batch summary: profile ${profileBatch.completed}/${profileTasks.length} ok (${profileBatch.errors} err); ` +
    `auth ${replyTabBatch.completed}/${replyTabTasks.length} ok (${replyTabBatch.errors} err); elapsed=${elapsedSec}s`
  );
  if (replyTabSuccess + replyTabFailures > 0) {
    console.log(`${LOG_PREFIX} /with_replies summary: ${replyTabSuccess} ok, ${replyTabFailures} failed`);
  }

  if (allResults.length > 0) {
    const ingested = await ingestFeedResults(allResults);
    return {
      tweets_ingested: ingested.total_ingested,
      accounts_scraped: accountsScraped,
    };
  }

  return { tweets_ingested: 0, accounts_scraped: accountsScraped };
}

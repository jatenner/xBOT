/**
 * Brain Discovery Engine — Central Orchestrator
 *
 * Receives raw scraped tweets from any feed source, deduplicates them,
 * computes engagement ratios, extracts content features, and bulk upserts
 * to brain_tweets. Also discovers new accounts from ingested tweets.
 */

import { upsertBrainTweets, upsertBrainAccounts } from './db';
import { computeRatios, type BrainTweet, type DiscoverySource, type TweetType, type MediaType } from './types';
import { extractContentFeatures } from '../intelligence/contentFeatureExtractor';

const LOG_PREFIX = '[brain/discovery]';

// =============================================================================
// Raw tweet from any feed (minimal required fields)
// =============================================================================

export interface RawScrapedTweet {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string | null;

  // Metrics (all optional, default to 0)
  likes?: number;
  retweets?: number;
  replies?: number;
  views?: number;
  bookmarks?: number;
  quotes?: number;

  // Author metadata (optional)
  author_followers?: number | null;
  author_following?: number | null;

  // Classification hints (optional)
  tweet_type?: TweetType;
  media_type?: MediaType;
  is_thread?: boolean;
  thread_position?: number;
  parent_tweet_id?: string;
}

export interface FeedResult {
  source: DiscoverySource;
  keyword?: string;
  feed_run_id: string;
  tweets: RawScrapedTweet[];
  errors?: string[];
}

// =============================================================================
// Core: Process feed results into brain_tweets
// =============================================================================

export async function ingestFeedResults(results: FeedResult[]): Promise<{
  total_ingested: number;
  total_deduplicated: number;
  accounts_discovered: number;
}> {
  const allTweets: Partial<BrainTweet>[] = [];
  const seenIds = new Set<string>();
  const accountUsernames = new Map<string, { followers: number | null; following: number | null }>();

  for (const result of results) {
    for (const raw of result.tweets) {
      // Deduplicate within this batch
      if (seenIds.has(raw.tweet_id)) continue;
      if (!raw.tweet_id || !raw.content || raw.content.length < 5) continue;
      seenIds.add(raw.tweet_id);

      const likes = raw.likes ?? 0;
      const retweets = raw.retweets ?? 0;
      const replies = raw.replies ?? 0;
      const views = raw.views ?? 0;
      const bookmarks = raw.bookmarks ?? 0;
      const quotes = raw.quotes ?? 0;
      const authorFollowers = raw.author_followers ?? null;

      // Compute ratios
      const ratios = computeRatios({
        views, likes, retweets, replies, bookmarks, quotes,
        author_followers: authorFollowers,
      });

      // Extract content features
      let contentFeatures = null;
      try {
        contentFeatures = extractContentFeatures(raw.content);
      } catch {
        // Non-critical — proceed without features
      }

      // Parse timing
      const postedAt = raw.posted_at ? new Date(raw.posted_at) : null;
      const postedHourUtc = postedAt ? postedAt.getUTCHours() : null;
      const postedDayOfWeek = postedAt ? postedAt.getUTCDay() : null;

      // Detect tweet type if not provided
      const tweetType = raw.tweet_type ?? detectTweetType(raw);

      // Detect media if not provided
      const mediaType = raw.media_type ?? detectMediaType(raw.content);

      const brainTweet: Partial<BrainTweet> = {
        tweet_id: raw.tweet_id,
        author_username: raw.author_username.toLowerCase().replace(/^@/, ''),
        author_followers: authorFollowers,
        author_following: raw.author_following ?? null,
        author_tier: null, // Set by accountTiering job

        content: raw.content.substring(0, 2000),
        media_type: mediaType,
        tweet_type: tweetType,
        is_thread: raw.is_thread ?? false,
        thread_position: raw.thread_position ?? null,
        parent_tweet_id: raw.parent_tweet_id ?? null,

        views, likes, retweets, replies, bookmarks, quotes,

        ...ratios,

        posted_at: raw.posted_at ?? null,
        posted_hour_utc: postedHourUtc,
        posted_day_of_week: postedDayOfWeek,
        scraped_at: new Date().toISOString(),

        discovery_source: result.source,
        discovery_keyword: result.keyword ?? null,
        discovery_feed_run_id: result.feed_run_id,

        rescrape_count: 0,
        content_features: contentFeatures as any,
      };

      allTweets.push(brainTweet);

      // Track unique accounts for discovery
      const username = brainTweet.author_username!;
      if (!accountUsernames.has(username)) {
        accountUsernames.set(username, {
          followers: authorFollowers,
          following: raw.author_following ?? null,
        });
      }
    }
  }

  if (allTweets.length === 0) {
    return { total_ingested: 0, total_deduplicated: 0, accounts_discovered: 0 };
  }

  // Batch upsert tweets (chunks of 50)
  let totalIngested = 0;
  for (let i = 0; i < allTweets.length; i += 50) {
    const chunk = allTweets.slice(i, i + 50);
    const count = await upsertBrainTweets(chunk);
    totalIngested += count;
  }

  // Discover new accounts (upsert with ignoreDuplicates)
  const newAccounts = Array.from(accountUsernames.entries()).map(([username, meta]) => ({
    username,
    followers_count: meta.followers,
    following_count: meta.following,
    discovery_method: 'viral_author' as const,
    is_active: true,
  }));

  let accountsDiscovered = 0;
  if (newAccounts.length > 0) {
    for (let i = 0; i < newAccounts.length; i += 50) {
      const chunk = newAccounts.slice(i, i + 50);
      accountsDiscovered += await upsertBrainAccounts(chunk);
    }
  }

  console.log(`${LOG_PREFIX} Ingested ${totalIngested}/${allTweets.length} tweets, discovered ${accountsDiscovered} accounts`);

  return {
    total_ingested: totalIngested,
    total_deduplicated: seenIds.size - totalIngested,
    accounts_discovered: accountsDiscovered,
  };
}

// =============================================================================
// Helpers
// =============================================================================

function detectTweetType(raw: RawScrapedTweet): TweetType {
  if (raw.parent_tweet_id) return 'reply';
  if (raw.is_thread) return 'thread';
  return 'original';
}

function detectMediaType(content: string): MediaType {
  // Basic heuristic from content — real media detection needs DOM inspection
  if (/https?:\/\/t\.co\/\w+/i.test(content)) return 'link';
  return 'none';
}

// =============================================================================
// DOM Extraction: Shared page.evaluate payload
// =============================================================================

/**
 * Shared tweet extraction code for page.evaluate().
 * This is the canonical extraction function used by ALL brain feeds.
 *
 * Call from page.evaluate like:
 *   const tweets = await page.evaluate(EXTRACT_TWEETS_FN, { maxTweets: 30, skipReplies: true });
 */
export const EXTRACT_TWEETS_JS = `
(function(opts) {
  const maxTweets = opts.maxTweets || 30;
  const skipReplies = opts.skipReplies !== false;

  const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
  const results = [];

  for (let i = 0; i < Math.min(articles.length, maxTweets + 10); i++) {
    if (results.length >= maxTweets) break;
    const article = articles[i];

    // Tweet ID
    const tweetLink = article.querySelector('a[href*="/status/"]');
    if (!tweetLink) continue;
    const href = tweetLink.getAttribute('href') || '';
    const idMatch = href.match(/\\/status\\/(\\d+)/);
    if (!idMatch) continue;
    const tweet_id = idMatch[1];

    // Skip replies
    if (skipReplies) {
      const socialCtx = article.querySelector('[data-testid="socialContext"]');
      if (socialCtx && /Replying to/i.test(socialCtx.textContent || '')) continue;
    }

    // Content (robust span joining)
    const tweetTextEl = article.querySelector('[data-testid="tweetText"]');
    let content = '';
    if (tweetTextEl) {
      const spans = tweetTextEl.querySelectorAll('span');
      const parts = [];
      spans.forEach(function(s) {
        var t = s.textContent ? s.textContent.trim() : '';
        if (t.length > 0) parts.push(t);
      });
      content = parts.length > 0
        ? parts.join(' ').replace(/\\s+/g, ' ').trim()
        : (tweetTextEl.textContent || '').trim();
    }
    if (!content || content.length < 3) continue;

    // Author
    const authorLinks = article.querySelectorAll('a[role="link"]');
    let author_username = 'unknown';
    for (const al of authorLinks) {
      const ah = al.getAttribute('href') || '';
      if (ah.match(/^\\/[a-zA-Z0-9_]+$/) && !ah.includes('/status/')) {
        author_username = ah.replace('/', '');
        break;
      }
    }

    // Metrics
    function parseMetric(testId) {
      const el = article.querySelector('[data-testid="' + testId + '"]');
      if (!el) return 0;
      const txt = el.textContent || '0';
      const cleaned = txt.replace(/[^\\d.KkMmBb]/g, '').trim();
      if (!cleaned || cleaned === '') return 0;
      var num = parseFloat(cleaned.replace(/,/g, ''));
      var upper = cleaned.toUpperCase();
      if (upper.endsWith('K')) num = parseFloat(cleaned) * 1e3;
      else if (upper.endsWith('M')) num = parseFloat(cleaned) * 1e6;
      else if (upper.endsWith('B')) num = parseFloat(cleaned) * 1e9;
      return Number.isFinite(num) ? Math.round(num) : 0;
    }

    var likes = parseMetric('like');
    var replies_count = parseMetric('reply');
    var retweets = parseMetric('retweet');

    // Timestamp
    var timeEl = article.querySelector('time');
    var posted_at = timeEl ? timeEl.getAttribute('datetime') : null;

    // Author followers (if visible in card)
    var author_followers = null;
    var bodyText = article.innerText || article.textContent || '';
    var fMatch = bodyText.match(/([\\.\\d,]+)\\s*([KMB])?\\s*Followers?/i);
    if (fMatch) {
      var fn = parseFloat(fMatch[1].replace(/,/g, ''));
      var fs = (fMatch[2] || '').toUpperCase();
      if (fs === 'K') fn *= 1e3;
      else if (fs === 'M') fn *= 1e6;
      else if (fs === 'B') fn *= 1e9;
      if (Number.isFinite(fn) && fn >= 0) author_followers = Math.round(fn);
    }

    results.push({
      tweet_id: tweet_id,
      author_username: author_username,
      content: content.substring(0, 2000),
      posted_at: posted_at,
      likes: likes,
      retweets: retweets,
      replies: replies_count,
      views: 0,
      bookmarks: 0,
      quotes: 0,
      author_followers: author_followers,
    });
  }

  return results;
})
`;

/**
 * Helper to run the canonical tweet extraction on a page.
 */
export async function extractTweetsFromPage(
  page: any,
  options: { maxTweets?: number; skipReplies?: boolean } = {},
): Promise<RawScrapedTweet[]> {
  try {
    const maxTweets = options.maxTweets ?? 30;
    const skipReplies = options.skipReplies !== false;

    // Use string-based evaluate to avoid tsx/esbuild __name injection
    // which breaks in browser context
    const tweets = await page.evaluate(`
      (function() {
        var maxTweets = ${maxTweets};
        var skipReplies = ${skipReplies};
        var articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
        var results = [];

        for (var i = 0; i < Math.min(articles.length, maxTweets + 10); i++) {
          if (results.length >= maxTweets) break;
          var article = articles[i];

          var tweetLink = article.querySelector('a[href*="/status/"]');
          if (!tweetLink) continue;
          var href = tweetLink.getAttribute('href') || '';
          var idMatch = href.match(/\\/status\\/(\\d+)/);
          if (!idMatch) continue;
          var tweet_id = idMatch[1];

          // Detect if this tweet is a reply
          var is_reply = false;
          var reply_to_user = null;
          var socialCtx = article.querySelector('[data-testid="socialContext"]');
          if (socialCtx && /Replying to/i.test(socialCtx.textContent || '')) {
            is_reply = true;
            // Try to extract who they're replying to
            var replyLink = socialCtx.querySelector('a');
            if (replyLink) {
              var rh = replyLink.getAttribute('href') || '';
              if (rh.match(/^\\/[a-zA-Z0-9_]+$/)) {
                reply_to_user = rh.replace('/', '');
              }
            }
          }
          // Also check for reply indicator in tweet text area
          var replyIndicator = article.querySelector('[data-testid="tweet"] [data-testid="socialContext"]');
          if (!is_reply && replyIndicator && /Replying/i.test(replyIndicator.textContent || '')) {
            is_reply = true;
          }

          if (skipReplies && is_reply) continue;

          var tweetTextEl = article.querySelector('[data-testid="tweetText"]');
          var content = '';
          if (tweetTextEl) {
            var spans = tweetTextEl.querySelectorAll('span');
            var parts = [];
            spans.forEach(function(s) {
              var t = s.textContent ? s.textContent.trim() : '';
              if (t.length > 0) parts.push(t);
            });
            content = parts.length > 0
              ? parts.join(' ').replace(/\\s+/g, ' ').trim()
              : (tweetTextEl.textContent || '').trim();
          }
          if (!content || content.length < 3) continue;

          var authorLinks = article.querySelectorAll('a[role="link"]');
          var author_username = 'unknown';
          for (var j = 0; j < authorLinks.length; j++) {
            var ah = authorLinks[j].getAttribute('href') || '';
            if (ah.match(/^\\/[a-zA-Z0-9_]+$/) && ah.indexOf('/status/') === -1) {
              author_username = ah.replace('/', '');
              break;
            }
          }

          // Parse metrics — try aria-label first (most reliable), then text content
          function pm(testId) {
            var el = article.querySelector('[data-testid="' + testId + '"]');
            if (!el) return 0;

            // Method 1: aria-label on the button or parent group
            // Twitter puts exact counts in aria-labels like "4523 likes" or "12 replies"
            var ariaEl = el.closest('button') || el;
            var aria = ariaEl.getAttribute('aria-label') || '';
            var ariaMatch = aria.match(/(\\d[\\d,]*)/);
            if (ariaMatch) {
              var n = parseInt(ariaMatch[1].replace(/,/g, ''), 10);
              if (n > 0) return n;
            }

            // Method 2: text content with K/M/B suffix
            var txt = (el.textContent || '').replace(/[^\\d.KkMmBb,]/g, '').trim();
            if (!txt || txt === '0' || txt === '') return 0;
            var num = parseFloat(txt.replace(/,/g, ''));
            var upper = txt.toUpperCase();
            if (upper.endsWith('K')) num = parseFloat(txt) * 1e3;
            else if (upper.endsWith('M')) num = parseFloat(txt) * 1e6;
            else if (upper.endsWith('B')) num = parseFloat(txt) * 1e9;
            return Number.isFinite(num) ? Math.round(num) : 0;
          }

          var likes = pm('like');
          var replies_count = pm('reply');
          var retweets = pm('retweet');

          // Try to get bookmarks too
          var bookmarks = 0;
          var bookmarkEl = article.querySelector('[data-testid="bookmark"]');
          if (bookmarkEl) {
            var bAria = (bookmarkEl.closest('button') || bookmarkEl).getAttribute('aria-label') || '';
            var bMatch = bAria.match(/(\\d[\\d,]*)/);
            if (bMatch) bookmarks = parseInt(bMatch[1].replace(/,/g, ''), 10) || 0;
          }

          // Also try the group aria-label which has all metrics
          // Twitter puts "X replies, Y reposts, Z likes, W bookmarks" on the action group
          if (likes === 0 && retweets === 0) {
            var actionGroup = article.querySelector('[role="group"]');
            if (actionGroup) {
              var groupAria = actionGroup.getAttribute('aria-label') || '';
              var likesMatch = groupAria.match(/(\\d[\\d,]*)\\s*like/i);
              var retweetsMatch = groupAria.match(/(\\d[\\d,]*)\\s*repost/i);
              var repliesMatch = groupAria.match(/(\\d[\\d,]*)\\s*repl/i);
              var bookmarksMatch = groupAria.match(/(\\d[\\d,]*)\\s*bookmark/i);
              if (likesMatch) likes = parseInt(likesMatch[1].replace(/,/g, ''), 10) || 0;
              if (retweetsMatch) retweets = parseInt(retweetsMatch[1].replace(/,/g, ''), 10) || 0;
              if (repliesMatch) replies_count = parseInt(repliesMatch[1].replace(/,/g, ''), 10) || 0;
              if (bookmarksMatch) bookmarks = parseInt(bookmarksMatch[1].replace(/,/g, ''), 10) || 0;
            }
          }

          var timeEl = article.querySelector('time');
          var posted_at = timeEl ? timeEl.getAttribute('datetime') : null;

          var author_followers = null;
          var bodyText = article.innerText || article.textContent || '';
          var fMatch = bodyText.match(/([\\d.,]+)\\s*([KMB])?\\s*Followers?/i);
          if (fMatch) {
            var fn = parseFloat(fMatch[1].replace(/,/g, ''));
            var fs = (fMatch[2] || '').toUpperCase();
            if (fs === 'K') fn *= 1e3;
            else if (fs === 'M') fn *= 1e6;
            else if (fs === 'B') fn *= 1e9;
            if (Number.isFinite(fn) && fn >= 0) author_followers = Math.round(fn);
          }

          results.push({
            tweet_id: tweet_id,
            author_username: author_username,
            content: content.substring(0, 2000),
            posted_at: posted_at,
            likes: likes,
            retweets: retweets,
            replies: replies_count,
            views: 0,
            bookmarks: bookmarks,
            quotes: 0,
            author_followers: author_followers,
            tweet_type: is_reply ? 'reply' : 'original',
            reply_to_user: reply_to_user
          });
        }
        return results;
      })()
    `);
    return tweets ?? [];
  } catch (err: any) {
    console.error(`${LOG_PREFIX} extractTweetsFromPage error:`, err.message);
    return [];
  }
}

/**
 * Extract follower count from a profile page.
 */
export async function extractFollowerCount(page: any): Promise<number | null> {
  try {
    return await page.evaluate(() => {
      const bodyText = document.body?.innerText || document.body?.textContent || '';
      const match = bodyText.match(/([\d.,]+)\s*([KMB])?\s*Followers?/i);
      if (!match) return null;
      let num = parseFloat(match[1].replace(/,/g, ''));
      const suffix = (match[2] || '').toUpperCase();
      if (suffix === 'K') num *= 1e3;
      else if (suffix === 'M') num *= 1e6;
      else if (suffix === 'B') num *= 1e9;
      return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
    });
  } catch {
    return null;
  }
}

/**
 * Extract trending topic names from Explore page.
 */
export async function extractTrendingTopics(page: any): Promise<string[]> {
  try {
    return await page.evaluate(() => {
      const topics: string[] = [];
      // Trending items typically have spans with trend text
      const trendCells = document.querySelectorAll('[data-testid="trend"]');
      trendCells.forEach(cell => {
        const spans = cell.querySelectorAll('span');
        spans.forEach(span => {
          const text = (span.textContent || '').trim();
          // Filter out metadata like "Trending", numbers, "posts"
          if (text.length > 2 && text.length < 100
            && !/^\d+[KMB]?\s*(posts?|tweets?)?$/i.test(text)
            && !/^Trending/i.test(text)
            && !/^#?\d+\s*·/i.test(text)) {
            topics.push(text.replace(/^#/, ''));
          }
        });
      });
      return Array.from(new Set(topics)).slice(0, 30);
    });
  } catch {
    return [];
  }
}

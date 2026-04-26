/**
 * Brain Discovery Engine — Central Orchestrator
 *
 * Receives raw scraped tweets from any feed source, deduplicates them,
 * computes engagement ratios, extracts content features, and bulk upserts
 * to brain_tweets. Also discovers new accounts from ingested tweets.
 */

import { upsertBrainTweets, upsertBrainAccounts } from './db';
import { computeRatios, getFollowerRange, type BrainTweet, type DiscoverySource, type TweetType, type MediaType } from './types';
import { extractContentFeatures } from '../intelligence/contentFeatureExtractor';
import { getSupabaseClient } from '../db';

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
  reply_to_username?: string;

  // Profile hints (optional)
  is_verified?: boolean;
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

      // Algorithm signal ratios
      const bookmarkSaveRate = likes > 0 ? Math.round((bookmarks / likes) * 1000) / 1000 : null;
      const conversationRatio = likes > 0 ? Math.round((replies / likes) * 1000) / 1000 : null;
      const shareRatio = likes > 0 ? Math.round((retweets / likes) * 1000) / 1000 : null;
      const isRatiod = replies > 0 && likes > 0 && replies > likes * 2; // More replies than 2x likes = ratiod

      // Composite algo score: high views relative to followers + high save rate + conversation
      const viralMult = ratios.viral_multiplier ?? 0;
      const algoScore = viralMult > 0
        ? Math.round((viralMult * (1 + (bookmarkSaveRate ?? 0) * 2 + (conversationRatio ?? 0))) * 100) / 100
        : null;

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
        reply_to_username: raw.reply_to_username ?? null,

        views, likes, retweets, replies, bookmarks, quotes,

        ...ratios,

        // Algorithm signals
        bookmark_save_rate: bookmarkSaveRate,
        conversation_ratio: conversationRatio,
        share_ratio: shareRatio,
        is_ratiod: isRatiod,
        algo_score: algoScore,

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

  // ── Identify which incoming tweet_ids are NEW (not yet in brain_tweets) ──
  // Causal columns (author_followers_at_post_time, parent_engagement_at_post_time,
  // first_scrape_*) and the velocity-snapshot queue must only fire on first scrape.
  // Re-discoveries leave those values intact.
  const supa = getSupabaseClient();
  const incomingIds = allTweets.map(t => t.tweet_id!).filter(Boolean);
  const existingIds = new Set<string>();
  if (incomingIds.length > 0) {
    for (let i = 0; i < incomingIds.length; i += 200) {
      const slice = incomingIds.slice(i, i + 200);
      const { data: existing } = await supa
        .from('brain_tweets')
        .select('tweet_id')
        .in('tweet_id', slice);
      (existing ?? []).forEach((r: any) => existingIds.add(r.tweet_id));
    }
  }

  // Look up parent metrics for new replies — enables parent_engagement_at_post_time
  const newReplyParentIds = Array.from(new Set(
    allTweets
      .filter(t => !existingIds.has(t.tweet_id!) && t.tweet_type === 'reply' && t.parent_tweet_id)
      .map(t => t.parent_tweet_id as string)
  ));
  const parentMetricsById = new Map<string, Record<string, number>>();
  if (newReplyParentIds.length > 0) {
    for (let i = 0; i < newReplyParentIds.length; i += 200) {
      const slice = newReplyParentIds.slice(i, i + 200);
      const { data: parents } = await supa
        .from('brain_tweets')
        .select('tweet_id, likes, replies, views, retweets, bookmarks')
        .in('tweet_id', slice);
      (parents ?? []).forEach((p: any) => {
        parentMetricsById.set(p.tweet_id, {
          likes: p.likes ?? 0,
          replies: p.replies ?? 0,
          views: p.views ?? 0,
          retweets: p.retweets ?? 0,
          bookmarks: p.bookmarks ?? 0,
        });
      });
    }
  }

  // Tag NEW tweets with causal-snapshot fields. Existing tweets are left alone
  // so the upsert-on-conflict doesn't overwrite first-scrape values.
  const nowIso = new Date().toISOString();
  for (const t of allTweets) {
    if (existingIds.has(t.tweet_id!)) continue;
    if (t.author_followers != null) {
      (t as any).author_followers_at_post_time = t.author_followers;
    }
    (t as any).first_scrape_likes = t.likes ?? 0;
    (t as any).first_scrape_at = nowIso;
    if (t.tweet_type === 'reply' && t.parent_tweet_id && parentMetricsById.has(t.parent_tweet_id as string)) {
      (t as any).parent_engagement_at_post_time = parentMetricsById.get(t.parent_tweet_id as string);
    }
  }

  // Batch upsert tweets (chunks of 50)
  let totalIngested = 0;
  for (let i = 0; i < allTweets.length; i += 50) {
    const chunk = allTweets.slice(i, i + 50);
    const count = await upsertBrainTweets(chunk);
    totalIngested += count;
  }

  // Enqueue velocity snapshots for fresh new tweets (posted within last 90 min,
  // so even the +60m bucket fires before the algo's first-distribution window
  // closes). Idempotent via UNIQUE (tweet_id, target_offset_min).
  const VELOCITY_FRESHNESS_MS = 90 * 60 * 1000;
  const VELOCITY_OFFSETS_MIN = [5, 15, 60];
  const velocityRows: any[] = [];
  for (const t of allTweets) {
    if (existingIds.has(t.tweet_id!)) continue;
    const postedAt = t.posted_at ? new Date(t.posted_at as string) : null;
    if (!postedAt || isNaN(postedAt.getTime())) continue;
    if (Date.now() - postedAt.getTime() > VELOCITY_FRESHNESS_MS) continue;
    for (const offset of VELOCITY_OFFSETS_MIN) {
      velocityRows.push({
        tweet_id: t.tweet_id,
        target_offset_min: offset,
        due_at: new Date(postedAt.getTime() + offset * 60_000).toISOString(),
      });
    }
  }
  if (velocityRows.length > 0) {
    for (let i = 0; i < velocityRows.length; i += 200) {
      const chunk = velocityRows.slice(i, i + 200);
      const { error } = await supa
        .from('pending_velocity_snapshots')
        .upsert(chunk, { onConflict: 'tweet_id,target_offset_min', ignoreDuplicates: true });
      if (error && !error.message?.includes('schema cache')) {
        console.warn(`${LOG_PREFIX} velocity enqueue chunk error: ${error.message}`);
      }
    }
  }

  // Enqueue log-spaced engagement re-captures (5m/15m/1h/6h/24h/7d) for new
  // tweets from S/A-tier accounts. This is the per-tweet engagement curve
  // that cascade-prediction models (Cheng 2014, Hawkes/TiDeH) require.
  // Lower-tier accounts skip this — the depth budget is reserved for the
  // accounts the tier daemon has selected as worth deeply tracking.
  const RECAPTURE_FRESHNESS_MS = 60 * 60 * 1000; // 1h — tweet must still be in the algo's first-distribution window
  const RECAPTURE_AGE_BUCKETS: Array<{ bucket: string; minutes: number }> = [
    { bucket: '5m', minutes: 5 },
    { bucket: '15m', minutes: 15 },
    { bucket: '1h', minutes: 60 },
    { bucket: '6h', minutes: 360 },
    { bucket: '24h', minutes: 1440 },
    { bucket: '7d', minutes: 10080 },
  ];
  const newTweetUsernames = Array.from(new Set(
    allTweets
      .filter(t => !existingIds.has(t.tweet_id!))
      .map(t => (t.author_username as string)?.toLowerCase())
      .filter(Boolean) as string[]
  ));
  let tierByUsername = new Map<string, string>();
  if (newTweetUsernames.length > 0) {
    const { data: tierRows } = await supa
      .from('brain_accounts')
      .select('username, tier')
      .in('username', newTweetUsernames);
    tierByUsername = new Map(
      (tierRows ?? [])
        .filter((r: any) => r.tier === 'S' || r.tier === 'A')
        .map((r: any) => [String(r.username).toLowerCase(), String(r.tier)]),
    );
  }
  const recaptureRows: any[] = [];
  for (const t of allTweets) {
    if (existingIds.has(t.tweet_id!)) continue;
    const username = (t.author_username as string)?.toLowerCase();
    if (!username) continue;
    const tier = tierByUsername.get(username);
    if (!tier) continue; // skip non-S/A
    const postedAt = t.posted_at ? new Date(t.posted_at as string) : null;
    if (!postedAt || isNaN(postedAt.getTime())) continue;
    // Only enqueue for genuinely fresh tweets — the 5m/15m buckets aren't
    // meaningful for tweets we discovered hours after they were posted.
    if (Date.now() - postedAt.getTime() > RECAPTURE_FRESHNESS_MS) continue;
    for (const { bucket, minutes } of RECAPTURE_AGE_BUCKETS) {
      recaptureRows.push({
        tweet_id: t.tweet_id,
        age_bucket: bucket,
        due_at: new Date(postedAt.getTime() + minutes * 60_000).toISOString(),
        account_tier: tier,
      });
    }
  }
  if (recaptureRows.length > 0) {
    for (let i = 0; i < recaptureRows.length; i += 200) {
      const chunk = recaptureRows.slice(i, i + 200);
      const { error } = await supa
        .from('pending_engagement_recaptures')
        .upsert(chunk, { onConflict: 'tweet_id,age_bucket', ignoreDuplicates: true });
      if (error && !error.message?.includes('schema cache')) {
        console.warn(`${LOG_PREFIX} engagement-recapture enqueue chunk error: ${error.message}`);
      }
    }
  }

  // Also discover accounts mentioned in tweets (reply targets, @mentions)
  for (const tweet of allTweets) {
    // Add reply-to targets as discoverable accounts
    if (tweet.reply_to_username) {
      const replyTo = (tweet.reply_to_username as string).toLowerCase().replace(/^@/, '');
      if (replyTo && !accountUsernames.has(replyTo)) {
        accountUsernames.set(replyTo, { followers: null, following: null });
      }
    }
    // Extract @mentions from content
    if (tweet.content) {
      const mentions = (tweet.content as string).match(/@([a-zA-Z0-9_]{1,15})/g) || [];
      for (const mention of mentions) {
        const username = mention.replace('@', '').toLowerCase();
        if (username && !accountUsernames.has(username)) {
          accountUsernames.set(username, { followers: null, following: null });
        }
      }
    }
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

  // Extract and store hashtags from ingested tweets
  await extractAndStoreHashtags(allTweets);

  console.log(`${LOG_PREFIX} Ingested ${totalIngested}/${allTweets.length} tweets, discovered ${accountsDiscovered} accounts`);

  return {
    total_ingested: totalIngested,
    total_deduplicated: seenIds.size - totalIngested,
    accounts_discovered: accountsDiscovered,
  };
}

// =============================================================================
// Hashtag Extraction
// =============================================================================

const HASHTAG_REGEX = /#([a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)/g;

function extractHashtags(content: string): string[] {
  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  // Reset regex state
  HASHTAG_REGEX.lastIndex = 0;
  while ((match = HASHTAG_REGEX.exec(content)) !== null) {
    const tag = match[1].toLowerCase();
    if (tag.length >= 2 && tag.length <= 100) {
      tags.add(tag);
    }
  }
  return Array.from(tags);
}

async function extractAndStoreHashtags(tweets: Partial<BrainTweet>[]): Promise<number> {
  const rows: Array<{
    tweet_id: string;
    hashtag: string;
    author_username: string;
    posted_at: string | null;
    likes: number;
    views: number;
    author_followers: number | null;
    follower_range: string | null;
  }> = [];

  for (const tweet of tweets) {
    if (!tweet.content || !tweet.tweet_id) continue;
    const hashtags = extractHashtags(tweet.content);
    if (hashtags.length === 0) continue;

    const range = tweet.author_followers ? getFollowerRange(tweet.author_followers) : null;

    for (const tag of hashtags) {
      rows.push({
        tweet_id: tweet.tweet_id,
        hashtag: tag,
        author_username: tweet.author_username ?? 'unknown',
        posted_at: tweet.posted_at ?? null,
        likes: tweet.likes ?? 0,
        views: tweet.views ?? 0,
        author_followers: tweet.author_followers ?? null,
        follower_range: range,
      });
    }
  }

  if (rows.length === 0) return 0;

  let stored = 0;
  const supabase = getSupabaseClient();

  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase
      .from('brain_tweet_hashtags')
      .upsert(chunk, { onConflict: 'tweet_id,hashtag', ignoreDuplicates: true });

    if (error) {
      // Table might not exist yet (migration not run) — log and continue
      if (error.message?.includes('relation') || error.message?.includes('schema cache')) {
        console.warn(`${LOG_PREFIX} brain_tweet_hashtags not ready yet — skipping hashtag storage`);
        return 0;
      }
      console.error(`${LOG_PREFIX} hashtag upsert error:`, error.message);
    } else {
      stored += chunk.length;
    }
  }

  if (stored > 0) {
    console.log(`${LOG_PREFIX} Stored ${stored} hashtag entries from ${tweets.length} tweets`);
  }

  return stored;
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

          // Extract content FIRST (needed for reply detection below)
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

          // Detect tweet type: reply, thread, quote, or original
          // (runs AFTER content + author extraction so we can check content text)
          var is_reply = false;
          var is_thread = false;
          var is_quote = false;
          var reply_to_user = null;

          // Method 1: "Replying to" social context
          var socialCtx = article.querySelector('[data-testid="socialContext"]');
          if (socialCtx) {
            var sctx = socialCtx.textContent || '';
            if (/Replying to/i.test(sctx)) {
              is_reply = true;
              var replyLink = socialCtx.querySelector('a');
              if (replyLink) {
                var rh = replyLink.getAttribute('href') || '';
                if (rh.match(/^\\/[a-zA-Z0-9_]+$/)) {
                  reply_to_user = rh.replace('/', '');
                }
              }
            }
          }

          // Method 2: Content starts with @username — very likely a reply
          if (!is_reply && content && content.match(/^@[a-zA-Z0-9_]/)) {
            is_reply = true;
            var mentionMatch = content.match(/^@([a-zA-Z0-9_]+)/);
            if (mentionMatch && !reply_to_user) {
              reply_to_user = mentionMatch[1];
            }
          }

          // Method 3: Self-reply = thread continuation
          if (is_reply && reply_to_user && author_username !== 'unknown' &&
              reply_to_user.toLowerCase() === author_username.toLowerCase()) {
            is_thread = true;
            is_reply = false;
          }

          // Thread line connector
          var threadLine = article.querySelector('[data-testid="tweet-thread-line"]');
          if (threadLine) is_thread = true;

          // Quote tweet: embedded tweet card
          var quoteTweet = article.querySelector('[data-testid="quoteTweet"]');
          if (quoteTweet) is_quote = true;

          var detected_type = 'original';
          if (is_quote) detected_type = 'quote';
          else if (is_thread) detected_type = 'thread';
          else if (is_reply) detected_type = 'reply';

          if (skipReplies && is_reply) continue;

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

          // ALWAYS parse the group aria-label — it has ALL metrics including views
          // Twitter puts "X replies, Y reposts, Z likes, W bookmarks, V views" on the action group
          var views = 0;
          var quotes = 0;
          var actionGroup = article.querySelector('[role="group"]');
          if (actionGroup) {
            var groupAria = actionGroup.getAttribute('aria-label') || '';
            // Parse views (most important metric we were missing)
            var viewsMatch = groupAria.match(/(\\d[\\d,]*)\\s*view/i);
            if (viewsMatch) views = parseInt(viewsMatch[1].replace(/,/g, ''), 10) || 0;
            // Parse quotes
            var quotesMatch = groupAria.match(/(\\d[\\d,]*)\\s*quote/i);
            if (quotesMatch) quotes = parseInt(quotesMatch[1].replace(/,/g, ''), 10) || 0;
            // Backfill likes/retweets/replies/bookmarks if individual selectors missed them
            if (likes === 0) {
              var likesMatch = groupAria.match(/(\\d[\\d,]*)\\s*like/i);
              if (likesMatch) likes = parseInt(likesMatch[1].replace(/,/g, ''), 10) || 0;
            }
            if (retweets === 0) {
              var retweetsMatch = groupAria.match(/(\\d[\\d,]*)\\s*repost/i);
              if (retweetsMatch) retweets = parseInt(retweetsMatch[1].replace(/,/g, ''), 10) || 0;
            }
            if (replies_count === 0) {
              var repliesMatch = groupAria.match(/(\\d[\\d,]*)\\s*repl/i);
              if (repliesMatch) replies_count = parseInt(repliesMatch[1].replace(/,/g, ''), 10) || 0;
            }
            if (bookmarks === 0) {
              var bookmarksMatch = groupAria.match(/(\\d[\\d,]*)\\s*bookmark/i);
              if (bookmarksMatch) bookmarks = parseInt(bookmarksMatch[1].replace(/,/g, ''), 10) || 0;
            }
          }

          // Also try analytics link for views (Twitter shows "X views" as a link)
          if (views === 0) {
            var analyticsLinks = article.querySelectorAll('a[href*="/analytics"]');
            for (var al = 0; al < analyticsLinks.length; al++) {
              var alText = (analyticsLinks[al].textContent || '').trim();
              var alMatch = alText.match(/([\\d.,]+)\\s*([KMB])?/i);
              if (alMatch) {
                var vn = parseFloat(alMatch[1].replace(/,/g, ''));
                var vs = (alMatch[2] || '').toUpperCase();
                if (vs === 'K') vn *= 1e3;
                else if (vs === 'M') vn *= 1e6;
                else if (vs === 'B') vn *= 1e9;
                if (Number.isFinite(vn) && vn > 0) views = Math.round(vn);
                break;
              }
            }
          }

          // Detect verified badge
          var is_verified = false;
          var verifiedBadge = article.querySelector('[data-testid="icon-verified"]');
          if (!verifiedBadge) verifiedBadge = article.querySelector('svg[aria-label*="Verified"]');
          if (!verifiedBadge) verifiedBadge = article.querySelector('[aria-label*="verified" i]');
          if (verifiedBadge) is_verified = true;

          // Detect media type from tweet
          var media_type = 'none';
          if (article.querySelector('[data-testid="tweetPhoto"]')) media_type = 'image';
          else if (article.querySelector('[data-testid="videoPlayer"]') || article.querySelector('video')) media_type = 'video';
          else if (article.querySelector('[data-testid="card.wrapper"]')) media_type = 'link';
          else if (article.querySelector('[data-testid="poll"]')) media_type = 'poll';

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
            views: views,
            bookmarks: bookmarks,
            quotes: quotes,
            author_followers: author_followers,
            tweet_type: detected_type,
            reply_to_username: reply_to_user,
            is_verified: is_verified,
            is_thread: is_thread,
            media_type: media_type
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

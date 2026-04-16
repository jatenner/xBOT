/**
 * Reply Tree Scraper — captures the inbound reply graph for notable tweets.
 *
 * Stage 4's deep analysis only runs on viral tweets (viral_multiplier > 5) at
 * 5 per hour, which leaves the inbound reply graph nearly empty for the vast
 * majority of tweets. Growth often comes from conversations on medium-engagement
 * tweets, not outliers — so we run this as a separate, broader scraper.
 *
 * For each tweet selected:
 *   1. Navigate to /{username}/status/{tweet_id}
 *   2. Scroll within the conversation to load more replies
 *   3. Extract reply data (text, author, likes, posted_at)
 *   4. Bulk-upsert into external_reply_patterns (structured reply intelligence)
 *   5. Mark brain_tweets.reply_tree_scraped_at so we don't re-scrape
 *
 * Runs every 20 minutes. Limit per run is bounded by MAX_TWEETS_PER_RUN and
 * per-tweet timeout to keep latency predictable.
 */

import { getSupabaseClient } from '../../db';
import { getBrainPage, brainGoto } from './brainNavigator';

const LOG_PREFIX = '[brain/feed/reply-tree]';

const MAX_TWEETS_PER_RUN = 15;
const MIN_LIKES_FOR_SCRAPE = 20;
const HOURS_LOOKBACK = 48;
const SCROLL_COUNT = 5;
const SCROLL_DELAY_MS = 1800;
const PER_TWEET_TIMEOUT_MS = 25000;

interface TweetToScrape {
  tweet_id: string;
  author_username: string;
  author_followers: number | null;
  likes: number;
  views: number | null;
  posted_at: string | null;
  domain: string | null;
}

export async function runReplyTreeScraper(): Promise<{
  tweets_processed: number;
  replies_captured: number;
  errors: number;
}> {
  const supabase = getSupabaseClient();

  // Select candidates: recent enough, engaged enough, from growing accounts,
  // not yet reply-tree scraped.
  const sinceIso = new Date(Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000).toISOString();
  const { data: candidates, error: selectErr } = await supabase
    .from('brain_tweets')
    .select('tweet_id, author_username, author_followers, likes, views, posted_at')
    .gte('posted_at', sinceIso)
    .gte('likes', MIN_LIKES_FOR_SCRAPE)
    .is('reply_tree_scraped_at', null)
    .order('likes', { ascending: false })
    .limit(MAX_TWEETS_PER_RUN);

  if (selectErr) {
    console.error(`${LOG_PREFIX} Select failed: ${selectErr.message}`);
    return { tweets_processed: 0, replies_captured: 0, errors: 1 };
  }

  if (!candidates || candidates.length === 0) {
    console.log(`${LOG_PREFIX} No eligible tweets to scrape`);
    return { tweets_processed: 0, replies_captured: 0, errors: 0 };
  }

  // Filter to growing accounts (hot / explosive / interesting) — these are
  // the accounts whose reply graphs tell us something about growth.
  const usernames = Array.from(new Set(candidates.map((c: any) => c.author_username)));
  const { data: accountRows } = await supabase
    .from('brain_accounts')
    .select('username, growth_status')
    .in('username', usernames);

  const growingSet = new Set(
    (accountRows ?? [])
      .filter((a: any) => ['hot', 'explosive', 'interesting'].includes(a.growth_status))
      .map((a: any) => a.username),
  );

  const tweets = (candidates as TweetToScrape[]).filter(t => growingSet.has(t.author_username));
  if (tweets.length === 0) {
    console.log(`${LOG_PREFIX} No candidates from growing accounts this run`);
    return { tweets_processed: 0, replies_captured: 0, errors: 0 };
  }

  let processed = 0;
  let captured = 0;
  let errors = 0;

  const page = await getBrainPage();
  try {
    for (const tweet of tweets) {
      try {
        const url = `https://x.com/${tweet.author_username}/status/${tweet.tweet_id}`;
        const nav = await brainGoto(page, url, PER_TWEET_TIMEOUT_MS);
        if (!nav.success) {
          errors++;
          continue;
        }

        try {
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
        } catch {
          errors++;
          continue;
        }

        for (let s = 0; s < SCROLL_COUNT; s++) {
          await page.evaluate('window.scrollBy(0, 1200)');
          await page.waitForTimeout(SCROLL_DELAY_MS);
        }

        const replyData = await extractReplyTree(page);
        const insertedCount = await persistReplies(supabase, tweet, replyData);
        captured += insertedCount;
        processed++;

        await supabase
          .from('brain_tweets')
          .update({ reply_tree_scraped_at: new Date().toISOString() })
          .eq('tweet_id', tweet.tweet_id);

        await page.waitForTimeout(1500);
      } catch (err: any) {
        errors++;
        console.error(`${LOG_PREFIX} Tweet ${tweet.tweet_id} failed: ${err.message}`);
      }
    }
  } finally {
    try { await page.close(); } catch {}
  }

  console.log(
    `${LOG_PREFIX} Done — ${processed}/${tweets.length} tweets, ${captured} replies captured, ${errors} errors`,
  );

  return { tweets_processed: processed, replies_captured: captured, errors };
}

// ─── Extraction ────────────────────────────────────────────────────────────

interface ExtractedReply {
  tweet_id: string | null;
  author_username: string;
  author_followers: number | null;
  text: string;
  likes: number;
  views: number;
  posted_at: string | null;
  position: number;
}

async function extractReplyTree(page: any): Promise<ExtractedReply[]> {
  return page.evaluate(`
    (function() {
      var articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      // First article is the parent tweet itself — skip it
      var replies = articles.slice(1);
      var results = [];

      for (var i = 0; i < replies.length; i++) {
        var article = replies[i];

        // Tweet ID
        var link = article.querySelector('a[href*="/status/"]');
        var tweetId = null;
        if (link) {
          var href = link.getAttribute('href') || '';
          var m = href.match(/\\/status\\/(\\d+)/);
          if (m) tweetId = m[1];
        }

        // Author
        var authorLinks = article.querySelectorAll('a[role="link"]');
        var author = 'unknown';
        for (var j = 0; j < authorLinks.length; j++) {
          var ah = authorLinks[j].getAttribute('href') || '';
          if (ah.match(/^\\/[a-zA-Z0-9_]+$/) && ah.indexOf('/status/') === -1) {
            author = ah.replace('/', '');
            break;
          }
        }

        // Text
        var textEl = article.querySelector('[data-testid="tweetText"]');
        var text = '';
        if (textEl) {
          var spans = textEl.querySelectorAll('span');
          var parts = [];
          spans.forEach(function(s) {
            var t = s.textContent ? s.textContent.trim() : '';
            if (t.length > 0) parts.push(t);
          });
          text = parts.length > 0
            ? parts.join(' ').replace(/\\s+/g, ' ').trim()
            : (textEl.textContent || '').trim();
        }
        if (!text || text.length < 2) continue;

        // Likes (from aria or group)
        function pm(testId) {
          var el = article.querySelector('[data-testid="' + testId + '"]');
          if (!el) return 0;
          var aria = (el.closest('button') || el).getAttribute('aria-label') || '';
          var am = aria.match(/(\\d[\\d,]*)/);
          if (am) {
            var n = parseInt(am[1].replace(/,/g, ''), 10);
            if (n > 0) return n;
          }
          var txt = (el.textContent || '').replace(/[^\\d.KkMmBb,]/g, '').trim();
          if (!txt) return 0;
          var num = parseFloat(txt.replace(/,/g, ''));
          var upper = txt.toUpperCase();
          if (upper.endsWith('K')) num = parseFloat(txt) * 1e3;
          else if (upper.endsWith('M')) num = parseFloat(txt) * 1e6;
          return Number.isFinite(num) ? Math.round(num) : 0;
        }
        var likes = pm('like');

        // Views from action group
        var views = 0;
        var group = article.querySelector('[role="group"]');
        if (group) {
          var ga = group.getAttribute('aria-label') || '';
          var vm = ga.match(/(\\d[\\d,]*)\\s*view/i);
          if (vm) views = parseInt(vm[1].replace(/,/g, ''), 10) || 0;
        }

        // Follower count (if visible in hover card)
        var followers = null;
        var body = article.innerText || article.textContent || '';
        var fm = body.match(/([\\d.,]+)\\s*([KMB])?\\s*Followers?/i);
        if (fm) {
          var fn = parseFloat(fm[1].replace(/,/g, ''));
          var fs = (fm[2] || '').toUpperCase();
          if (fs === 'K') fn *= 1e3;
          else if (fs === 'M') fn *= 1e6;
          else if (fs === 'B') fn *= 1e9;
          if (Number.isFinite(fn)) followers = Math.round(fn);
        }

        // Posted at
        var timeEl = article.querySelector('time');
        var postedAt = timeEl ? timeEl.getAttribute('datetime') : null;

        results.push({
          tweet_id: tweetId,
          author_username: author,
          author_followers: followers,
          text: text.substring(0, 2000),
          likes: likes,
          views: views,
          posted_at: postedAt,
          position: i,
        });
      }

      return results;
    })()
  `);
}

// ─── Persistence ───────────────────────────────────────────────────────────

async function persistReplies(
  supabase: any,
  parent: TweetToScrape,
  replies: ExtractedReply[],
): Promise<number> {
  if (replies.length === 0) return 0;

  // Sort replies by likes desc — top position marker
  const sortedByLikes = [...replies].sort((a, b) => b.likes - a.likes);
  const topTweetIds = new Set(sortedByLikes.slice(0, 3).map(r => r.tweet_id).filter(Boolean));

  const parentPostedMs = parent.posted_at ? new Date(parent.posted_at).getTime() : null;

  const rows = replies
    .filter(r => r.tweet_id && r.text)
    .map(r => {
      const replyPostedMs = r.posted_at ? new Date(r.posted_at).getTime() : null;
      const replyDelayMinutes =
        parentPostedMs !== null && replyPostedMs !== null
          ? Math.max(0, Math.round((replyPostedMs - parentPostedMs) / 60000))
          : null;

      return {
        parent_tweet_id: parent.tweet_id,
        parent_author_username: parent.author_username,
        parent_followers: parent.author_followers ?? null,
        parent_views: parent.views ?? null,
        parent_likes: parent.likes,
        parent_posted_at: parent.posted_at,

        reply_tweet_id: r.tweet_id,
        reply_author_username: r.author_username,
        reply_author_followers: r.author_followers,
        reply_text: r.text,
        reply_likes: r.likes,
        reply_views: r.views,
        reply_position: r.position,
        reply_posted_at: r.posted_at,
        reply_delay_minutes: replyDelayMinutes,

        is_top_reply: topTweetIds.has(r.tweet_id),
        classified: false,
        scraped_at: new Date().toISOString(),
      };
    });

  if (rows.length === 0) return 0;

  const { data, error } = await supabase
    .from('external_reply_patterns')
    .upsert(rows, { onConflict: 'reply_tweet_id', ignoreDuplicates: false })
    .select('reply_tweet_id');

  if (error) {
    console.warn(`${LOG_PREFIX} persistReplies error: ${error.message}`);
    return 0;
  }

  return data?.length ?? 0;
}

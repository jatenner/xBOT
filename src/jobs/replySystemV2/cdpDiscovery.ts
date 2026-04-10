/**
 * CDP-based live discovery (Mac executor path).
 * Extracts tweets from an authenticated Chrome page (timeline or search)
 * and returns normalized tweet objects for persistence to reply_opportunities.
 */

import type { Page } from 'playwright';

export const CDP_DISCOVERY_FRESHNESS_MAX_AGE_MS =
  typeof process.env.CDP_DISCOVERY_FRESHNESS_MAX_AGE_MS !== 'undefined'
    ? parseInt(process.env.CDP_DISCOVERY_FRESHNESS_MAX_AGE_MS, 10)
    : 3 * 60 * 60 * 1000; // 3h default

/** Comma-separated list: CDP_DISCOVERY_SEARCH_TERMS="ozempic,sleep,creatine" or single CDP_DISCOVERY_SEARCH_TERM */
export function getCdpSearchTerms(): string[] {
  const termsEnv = process.env.CDP_DISCOVERY_SEARCH_TERMS || process.env.CDP_DISCOVERY_SEARCH_TERM || '';
  if (!termsEnv.trim()) return [];
  return termsEnv
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export interface CdpNormalizedTweet {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string | null;
  like_count: number;
  reply_count: number;
  is_reply: boolean;
  /** Author follower count when visible on card (e.g. "1.2K Followers"). Null if not found. */
  author_follower_count: number | null;
}

/**
 * Parse follower count from text like "1,234 Followers", "1.2K Followers", "10K", "1.5M".
 * Returns null if no match.
 */
export function parseFollowerCountFromText(text: string): number | null {
  if (!text || !text.trim()) return null;
  // Match: optional leading digits/commas, optional .digits, optional K/M, then "Follower(s)"
  const m = text.match(/([\d,]+)(?:\.(\d+))?\s*([KMB])?\s*Followers?/i);
  if (!m) return null;
  let num = parseInt(m[1].replace(/,/g, ''), 10);
  if (isNaN(num)) return null;
  const frac = m[2] ? parseInt(m[2], 10) / Math.pow(10, m[2].length) : 0;
  num = num + frac;
  const mult = (m[3] || '').toUpperCase();
  if (mult === 'K') num *= 1e3;
  else if (mult === 'M') num *= 1e6;
  else if (mult === 'B') num *= 1e9;
  return Math.round(num);
}

/**
 * Extract tweets from current page (timeline or search results).
 * Uses article[data-testid="tweet"], skips replies, gets datetime from time element.
 */
export async function extractTweetsFromPage(page: Page): Promise<CdpNormalizedTweet[]> {
    const raw = await page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const results: Array<{
      tweet_id: string;
      author_username: string;
      content: string;
      posted_at: string | null;
      like_count: number;
      reply_count: number;
      is_reply: boolean;
      author_follower_count: number | null;
    }> = [];

    for (const card of articles) {
      try {
        const text = card.textContent || '';
        if (text.includes('Replying to')) continue;

        const link = card.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
        const href = link?.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        const tweet_id = match ? match[1] : '';
        if (!tweet_id) continue;

        const authorEl = card.querySelector('[data-testid="User-Name"] a[href*="/"]') as HTMLAnchorElement | null;
        let author_username = '';
        if (authorEl) {
          const h = authorEl.getAttribute('href') || '';
          const m = h.match(/\/([^/]+)$/);
          author_username = (m ? m[1] : '').replace('@', '').trim() || '';
        }
        if (!author_username) author_username = 'unknown';

        const textEl = card.querySelector('[data-testid="tweetText"]');
        const content = (textEl?.textContent || '').trim().substring(0, 500);

        const timeEl = card.querySelector('time');
        const datetime = timeEl?.getAttribute('datetime') || null;
        const posted_at = datetime;

        let like_count = 0;
        let reply_count = 0;
        const likeBtn = card.querySelector('[data-testid="like"]');
        const replyBtn = card.querySelector('[data-testid="reply"]');
        if (likeBtn) {
          const aria = likeBtn.getAttribute('aria-label') || '';
          const n = aria.match(/([\d,]+)/);
          if (n) like_count = parseInt(n[1].replace(/,/g, ''), 10) || 0;
        }
        if (replyBtn) {
          const aria = replyBtn.getAttribute('aria-label') || '';
          const n = aria.match(/([\d,]+)/);
          if (n) reply_count = parseInt(n[1].replace(/,/g, ''), 10) || 0;
        }

        // Author follower count: look for "X Followers" / "X.XK Followers" in card (often in User-Name area)
        let author_follower_count: number | null = null;
        const followerMatch = text.match(/([\d,]+)(?:\.(\d+))?\s*([KMB])?\s*Followers?/i);
        if (followerMatch) {
          let num = parseInt(followerMatch[1].replace(/,/g, ''), 10);
          if (!isNaN(num)) {
            const frac = followerMatch[2] ? parseInt(followerMatch[2], 10) / Math.pow(10, followerMatch[2].length) : 0;
            num = num + frac;
            const mult = (followerMatch[3] || '').toUpperCase();
            if (mult === 'K') num *= 1e3;
            else if (mult === 'M') num *= 1e6;
            else if (mult === 'B') num *= 1e9;
            author_follower_count = Math.round(num);
          }
        }

        results.push({
          tweet_id,
          author_username,
          content,
          posted_at,
          like_count,
          reply_count,
          is_reply: false,
          author_follower_count,
        });
      } catch (_) {
        continue;
      }
    }
    return results;
  });

  return raw;
}

/**
 * Discover from home timeline via CDP context.
 * Creates a new page, navigates to home, extracts tweets, closes page.
 */
export async function discoverFromTimeline(context: { newPage(): Promise<Page> }): Promise<{
  tweets: CdpNormalizedTweet[];
  discovered_total: number;
  source: string;
}> {
  const page = await context.newPage();
  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(3500);
    const tweets = await extractTweetsFromPage(page);
    return { tweets, discovered_total: tweets.length, source: 'cdp_timeline' };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * Safe discovery_source label for a search term (e.g. cdp_search_ozempic).
 * Used for persistence and source learning.
 */
export function searchTermToSourceLabel(searchTerm: string): string {
  const safe = searchTerm.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 30);
  return safe ? `cdp_search_${safe}` : 'cdp_search_unknown';
}

/**
 * Discover from search "Latest" via CDP context.
 * Uses f=live for live/latest results. Returns source label like cdp_search_<term>.
 */
export async function discoverFromSearch(
  context: { newPage(): Promise<Page> },
  searchTerm: string
): Promise<{ tweets: CdpNormalizedTweet[]; discovered_total: number; source: string }> {
  const page = await context.newPage();
  try {
    const q = encodeURIComponent(searchTerm);
    const url = `https://x.com/search?q=${q}&src=typed_query&f=live`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(3500);
    const tweets = await extractTweetsFromPage(page);
    const source = searchTermToSourceLabel(searchTerm);
    return { tweets, discovered_total: tweets.length, source };
  } finally {
    await page.close().catch(() => {});
  }
}

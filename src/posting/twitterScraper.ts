/**
 * 🐦 TWITTER/X METRICS SCRAPER
 * 
 * Uses PROVEN selectors from bulletproofTwitterScraper
 * Updated selectors + proper textContent extraction
 */

import { BrowserContext, Page } from 'playwright';

interface TweetMetrics {
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  quotes: number;
  profile_visits: number;
  link_clicks: number;
  follows: number;
}

/**
 * Collect tweet metrics using Playwright automation
 */
export async function collectTweetMetrics(
  tweetId: string,
  pass: number,
  context?: BrowserContext
): Promise<TweetMetrics | null> {
  if (!context) {
    console.warn('[TWITTER_SCRAPER] ⚠️ No browser context provided, cannot scrape');
    return null;
  }

  let page: Page | null = null;
  
  try {
    console.log(`[TWITTER_SCRAPER] 🔍 Collecting metrics for tweet_id=${tweetId} (pass=${pass})...`);

    page = await context.newPage();
    
    // Navigate to tweet
    const tweetUrl = `https://twitter.com/i/web/status/${tweetId}`;
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for engagement buttons to load
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 }).catch(() => null);
    await page.waitForTimeout(3000);

    // Extract metrics
    const metrics = await extractMetricsFromPage(page, tweetId, pass);

    console.log(
      `[TWITTER_SCRAPER] ✅ Collected: ` +
      `likes=${metrics.likes} retweets=${metrics.retweets} replies=${metrics.replies} views=${metrics.impressions}`
    );

    return metrics;
  } catch (error: any) {
    console.error(`[TWITTER_SCRAPER] ❌ Failed to collect metrics: ${error.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/**
 * Extract metrics using PROVEN selectors from bulletproofTwitterScraper
 */
async function extractMetricsFromPage(
  page: Page,
  tweetId: string,
  pass: number
): Promise<TweetMetrics> {
  const metrics: TweetMetrics = {
    impressions: 0,
    likes: 0,
    retweets: 0,
    replies: 0,
    bookmarks: 0,
    quotes: 0,
    profile_visits: 0,
    link_clicks: 0,
    follows: 0
  };

  // Helper to parse count text (handles "1.2K", "5.3M", etc.)
  const parseCount = (text: string): number => {
    if (!text) return 0;
    const cleaned = text.trim().toLowerCase().replace(/,/g, '');
    if (cleaned.endsWith('k')) return Math.floor(parseFloat(cleaned) * 1000);
    if (cleaned.endsWith('m')) return Math.floor(parseFloat(cleaned) * 1000000);
    return parseInt(cleaned, 10) || 0;
  };

  // ============ PROVEN SELECTORS FROM bulletproofTwitterScraper ============
  const SELECTORS = {
    likes: [
      '[data-testid="like"] span:not([aria-hidden])',  // PRIMARY - PROVEN
      '[aria-label*="like"] span',
      'div[role="group"] button:nth-child(3) span',
      '[data-testid="like"]'
    ],
    retweets: [
      '[data-testid="retweet"] span:not([aria-hidden])',  // PRIMARY - PROVEN
      '[aria-label*="repost"] span',
      '[aria-label*="retweet"] span',
      'div[role="group"] button:nth-child(2) span',
      '[data-testid="retweet"]'
    ],
    replies: [
      '[data-testid="reply"] span:not([aria-hidden])',  // PRIMARY - PROVEN
      '[aria-label*="repl"] span',
      'div[role="group"] button:nth-child(1) span',
      '[data-testid="reply"]'
    ],
    bookmarks: [
      '[data-testid="bookmark"] span:not([aria-hidden])',  // PRIMARY - PROVEN
      '[aria-label*="bookmark"] span',
      '[data-testid="bookmark"]'
    ],
    views: [
      'a[href*="analytics"] span',  // PRIMARY - PROVEN
      '[aria-label*="view"] span',
      '[data-testid="analyticsButton"] span'
    ]
  };

  // Extract likes
  try {
    for (const selector of SELECTORS.likes) {
      try {
        const text = await page.$eval(selector, (el: any) => el.textContent?.trim() || '');
        if (text && text !== '0' && text !== '') {
          metrics.likes = parseCount(text);
          console.log(`✅ likes: ${metrics.likes} (${selector.substring(0, 30)}...)`);
          break;
        }
      } catch (e) {}
    }
    if (metrics.likes === 0) console.log('⚠️ likes: All selectors returned 0 or failed');
  } catch (e) {
    console.log('[SCRAPER] ⚠️ Could not extract likes');
  }

  // Extract retweets
  try {
    for (const selector of SELECTORS.retweets) {
      try {
        const text = await page.$eval(selector, (el: any) => el.textContent?.trim() || '');
        if (text && text !== '') {
          metrics.retweets = parseCount(text);
          console.log(`✅ retweets: ${metrics.retweets}`);
          break;
        }
      } catch (e) {}
    }
  } catch (e) {
    console.log('[SCRAPER] ⚠️ Could not extract retweets');
  }

  // Extract replies
  try {
    for (const selector of SELECTORS.replies) {
      try {
        const text = await page.$eval(selector, (el: any) => el.textContent?.trim() || '');
        if (text && text !== '') {
          metrics.replies = parseCount(text);
          console.log(`✅ replies: ${metrics.replies}`);
          break;
        }
      } catch (e) {}
    }
  } catch (e) {
    console.log('[SCRAPER] ⚠️ Could not extract replies');
  }

  // Extract bookmarks
  try {
    for (const selector of SELECTORS.bookmarks) {
      try {
        const text = await page.$eval(selector, (el: any) => el.textContent?.trim() || '');
        if (text && text !== '') {
          metrics.bookmarks = parseCount(text);
          console.log(`✅ bookmarks: ${metrics.bookmarks}`);
          break;
        }
      } catch (e) {}
    }
  } catch (e) {
    console.log('[SCRAPER] ⚠️ Could not extract bookmarks');
  }

  // Extract impressions (view count)
  try {
    for (const selector of SELECTORS.views) {
      try {
        const text = await page.$eval(selector, (el: any) => el.textContent?.trim() || '');
        if (text && text.match(/\d/)) {
          metrics.impressions = parseCount(text);
          console.log(`✅ impressions: ${metrics.impressions}`);
          break;
        }
      } catch (e) {}
    }
  } catch (e) {
    console.log('[SCRAPER] ⚠️ Could not extract impressions');
  }

  // For pass 2 (24h), estimate follower attribution
  if (pass === 2) {
    const engagementRate = (metrics.likes + metrics.retweets + metrics.replies) / Math.max(1, metrics.impressions);
    const profileClickEstimate = Math.floor(metrics.impressions * 0.05);
    const followRateEstimate = 0.02;
    metrics.follows = Math.floor(profileClickEstimate * followRateEstimate);
    metrics.profile_visits = profileClickEstimate;
  }

  return metrics;
}

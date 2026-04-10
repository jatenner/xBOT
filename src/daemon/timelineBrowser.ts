import { Page } from 'playwright';

export interface TimelineCandidate {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string | null;
  like_count: number;
  reply_count: number;
  retweet_count: number;
}

export interface BrowseResult {
  candidates: TimelineCandidate[];
  liked_count: number;
  scroll_count: number;
  duration_ms: number;
}

export async function browseTimeline(page: Page): Promise<BrowseResult> {
  const startTime = Date.now();
  let liked = 0;
  const allTweets = new Map<string, TimelineCandidate>();

  console.log('[TIMELINE] 🏠 Navigating to home timeline...');

  try {
    await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (navErr: any) {
    console.warn(`[TIMELINE] ⚠️ Navigation failed: ${navErr.message}`);
    return { candidates: [], liked_count: 0, scroll_count: 0, duration_ms: Date.now() - startTime };
  }

  // Wait for tweets to render
  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 });
  } catch {
    console.warn('[TIMELINE] ⚠️ No tweets found on home timeline');
    return { candidates: [], liked_count: 0, scroll_count: 0, duration_ms: Date.now() - startTime };
  }

  // Initial pause (human reads before scrolling)
  await page.waitForTimeout(2000 + Math.random() * 2000);

  // Extract + scroll loop (4-8 rounds)
  const scrollRounds = 4 + Math.floor(Math.random() * 5);

  for (let i = 0; i < scrollRounds; i++) {
    // Extract tweets currently visible
    const tweets = await extractVisibleTweets(page);
    for (const t of tweets) {
      if (t.tweet_id && !allTweets.has(t.tweet_id)) {
        allTweets.set(t.tweet_id, t);
      }
    }

    // Occasionally like a tweet (30% chance per scroll)
    if (Math.random() < 0.3 && liked < 3) {
      try {
        const likeButtons = page.locator('article[data-testid="tweet"] [data-testid="like"]');
        const count = await likeButtons.count();
        if (count > 0) {
          const idx = Math.floor(Math.random() * Math.min(count, 5));
          const btn = likeButtons.nth(idx);
          if (await btn.isVisible({ timeout: 1000 })) {
            await btn.click({ delay: 30 + Math.random() * 70 });
            liked++;
            console.log(`[TIMELINE] 👍 Liked tweet #${liked}`);
            await page.waitForTimeout(500 + Math.random() * 1000);
          }
        }
      } catch { /* like failed, no big deal */ }
    }

    // Scroll naturally
    await page.evaluate(() => {
      const scrollAmount = 300 + Math.random() * 500;
      window.scrollBy({ top: scrollAmount, behavior: 'smooth' });
    });

    // Human reading pause between scrolls (2-5 seconds)
    await page.waitForTimeout(2000 + Math.random() * 3000);
  }

  // Final extraction
  const finalTweets = await extractVisibleTweets(page);
  for (const t of finalTweets) {
    if (t.tweet_id && !allTweets.has(t.tweet_id)) {
      allTweets.set(t.tweet_id, t);
    }
  }

  const candidates = Array.from(allTweets.values());
  const duration = Date.now() - startTime;
  console.log(`[TIMELINE] ✅ Browsed ${scrollRounds} scrolls, extracted ${candidates.length} tweets, liked ${liked} (${Math.round(duration/1000)}s)`);

  return { candidates, liked_count: liked, scroll_count: scrollRounds, duration_ms: duration };
}

async function extractVisibleTweets(page: Page): Promise<TimelineCandidate[]> {
  return page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const results: any[] = [];

    for (const article of articles) {
      try {
        // Skip replies in timeline
        if (article.textContent?.includes('Replying to')) continue;

        // Tweet ID from link
        const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
        const href = link?.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        const tweet_id = match ? match[1] : '';
        if (!tweet_id) continue;

        // Author
        const authorEl = article.querySelector('[data-testid="User-Name"] a[href*="/"]') as HTMLAnchorElement | null;
        let author_username = '';
        if (authorEl) {
          const h = authorEl.getAttribute('href') || '';
          const m = h.match(/\/([^/]+)$/);
          author_username = (m ? m[1] : '').replace('@', '').trim();
        }
        if (!author_username) continue;

        // Content
        const textEl = article.querySelector('[data-testid="tweetText"]');
        const content = (textEl?.textContent || '').trim().substring(0, 500);
        if (!content || content.length < 10) continue;

        // Timestamp
        const timeEl = article.querySelector('time');
        const posted_at = timeEl?.getAttribute('datetime') || null;

        // Engagement from aria-labels
        let like_count = 0, reply_count = 0, retweet_count = 0;

        const likeBtn = article.querySelector('[data-testid="like"]');
        if (likeBtn) {
          const aria = likeBtn.getAttribute('aria-label') || '';
          const n = aria.match(/([\d,]+)/);
          if (n) like_count = parseInt(n[1].replace(/,/g, ''), 10) || 0;
        }

        const replyBtn = article.querySelector('[data-testid="reply"]');
        if (replyBtn) {
          const aria = replyBtn.getAttribute('aria-label') || '';
          const n = aria.match(/([\d,]+)/);
          if (n) reply_count = parseInt(n[1].replace(/,/g, ''), 10) || 0;
        }

        const retweetBtn = article.querySelector('[data-testid="retweet"]');
        if (retweetBtn) {
          const aria = retweetBtn.getAttribute('aria-label') || '';
          const n = aria.match(/([\d,]+)/);
          if (n) retweet_count = parseInt(n[1].replace(/,/g, ''), 10) || 0;
        }

        results.push({ tweet_id, author_username, content, posted_at, like_count, reply_count, retweet_count });
      } catch { continue; }
    }
    return results;
  });
}

import { Page } from 'playwright';

export interface ScrapedTweet {
  tweet_id: string;
  author_username: string;
  content: string;
  posted_at: string | null;
  like_count: number;
  reply_count: number;
  retweet_count: number;
  view_count: number;
  bookmark_count: number;
}

export interface ScrapedReply {
  reply_tweet_id: string;
  reply_author: string;
  reply_text: string;
  reply_likes: number;
  reply_position: number;
  is_loser_sample: boolean;
  parent_tweet_id: string;
}

export interface TweetMetrics {
  tweet_id: string;
  views: number;
  likes: number;
  replies: number;
  retweets: number;
  bookmarks: number;
}

export interface AccountProfile {
  username: string;
  bio: string;
  followers: number;
  following: number;
  is_health_related: boolean;
}

// ─── CONSENT / LOGIN WALL HANDLING ───

export async function handleConsentWall(page: Page): Promise<void> {
  try {
    const acceptBtn = page.getByRole('button', { name: /accept|agree|allow|continue|ok/i }).first();
    if (await acceptBtn.isVisible({ timeout: 3000 })) {
      await acceptBtn.click();
      await page.waitForTimeout(2000);
      console.log('[ANON_SCRAPER] Consent wall accepted');
    }
  } catch { /* no wall */ }

  if (page.url().includes('/i/flow/login')) {
    throw new Error('LOGIN_WALL');
  }
}

// ─── PROFILE SCRAPING (works anonymously) ───

export async function scrapeAccountTweets(page: Page, username: string): Promise<ScrapedTweet[]> {
  console.log(`[ANON_SCRAPER] Scraping @${username}...`);

  try {
    await page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000 + Math.random() * 2000);
    await handleConsentWall(page);
  } catch (err: any) {
    if (err.message === 'LOGIN_WALL') throw err;
    console.warn(`[ANON_SCRAPER] Navigation failed for @${username}: ${err.message}`);
    return [];
  }

  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
  } catch {
    console.warn(`[ANON_SCRAPER] No tweets found for @${username}`);
    return [];
  }

  // Scroll 5 times to load more tweets (gets ~20-30 per profile instead of ~10)
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 600 + Math.random() * 400));
    await page.waitForTimeout(800 + Math.random() * 700);
  }

  const tweets = await extractTweets(page, username);
  console.log(`[ANON_SCRAPER] @${username}: ${tweets.length} tweets extracted`);
  return tweets;
}

// ─── PROFILE EVALUATION (check if health-related) ───

export async function evaluateProfile(page: Page, username: string): Promise<AccountProfile | null> {
  try {
    await page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1500 + Math.random() * 1500);
    await handleConsentWall(page);

    return await page.evaluate((handle) => {
      // Extract bio
      const bioEl = document.querySelector('[data-testid="UserDescription"]');
      const bio = (bioEl?.textContent || '').trim();

      // Extract follower/following counts
      let followers = 0;
      let following = 0;
      const links = document.querySelectorAll('a[href*="/followers"], a[href*="/following"]');
      for (const link of Array.from(links)) {
        const text = link.textContent || '';
        const match = text.match(/([\d,.]+[KkMm]?)/);
        if (!match) continue;
        let num = match[1].replace(/,/g, '');
        let value = 0;
        if (num.endsWith('K') || num.endsWith('k')) value = Math.round(parseFloat(num) * 1000);
        else if (num.endsWith('M') || num.endsWith('m')) value = Math.round(parseFloat(num) * 1000000);
        else value = parseInt(num) || 0;

        const href = (link as HTMLAnchorElement).getAttribute('href') || '';
        if (href.includes('/followers')) followers = value;
        else if (href.includes('/following')) following = value;
      }

      // Check if health-related based on bio keywords
      const healthKeywords = [
        'health', 'doctor', 'dr.', 'md', 'phd', 'researcher', 'scientist',
        'nutrition', 'fitness', 'wellness', 'neuroscience', 'neuro', 'brain',
        'sleep', 'medicine', 'medical', 'longevity', 'biohack', 'coach',
        'dietitian', 'physiologist', 'psychologist', 'therapist', 'nurse',
        'pharmacist', 'cardio', 'exercise', 'metabolism', 'gut', 'immune',
        'mental health', 'mindfulness', 'yoga', 'meditation', 'performance',
        'strength', 'recovery', 'supplement', 'vitamin', 'protein',
      ];
      const bioLower = bio.toLowerCase();
      const is_health_related = healthKeywords.some(kw => bioLower.includes(kw));

      return { username: handle, bio, followers, following, is_health_related };
    }, username);
  } catch {
    return null;
  }
}

// ─── DISCOVER NEW ACCOUNTS FROM A PROFILE'S REPLIES ───

export async function discoverAccountsFromReplies(page: Page, tweetId: string): Promise<string[]> {
  // Visit a popular tweet, extract usernames of people who replied
  // These are potential accounts to evaluate and follow
  try {
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000 + Math.random() * 2000);
    await handleConsentWall(page);
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

    // Scroll to load replies
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(1000 + Math.random() * 1000);
    }

    return await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const usernames = new Set<string>();
      // Skip first article (parent tweet)
      for (let i = 1; i < articles.length; i++) {
        const authorEl = articles[i].querySelector('[data-testid="User-Name"] a[href*="/"]') as HTMLAnchorElement | null;
        if (authorEl) {
          const href = authorEl.getAttribute('href') || '';
          const match = href.match(/\/([^/]+)$/);
          if (match && match[1] && !match[1].includes('status')) {
            usernames.add(match[1]);
          }
        }
      }
      return Array.from(usernames);
    });
  } catch {
    return [];
  }
}

// ─── REPLY PATTERN SCRAPING ───

export async function scrapeReplyPatterns(page: Page, tweetId: string): Promise<ScrapedReply[]> {
  console.log(`[ANON_SCRAPER] Scraping replies for ${tweetId}...`);

  try {
    await page.goto(`https://x.com/i/status/${tweetId}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000 + Math.random() * 2000);
    await handleConsentWall(page);
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
  } catch (err: any) {
    if (err.message === 'LOGIN_WALL') throw err;
    return [];
  }

  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(1000 + Math.random() * 1000);
  }

  const replies = await page.evaluate((parentId) => {
    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const results: any[] = [];
    for (let i = 1; i < articles.length && results.length < 10; i++) {
      try {
        const article = articles[i];
        const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
        const href = link?.getAttribute('href') || '';
        const match = href.match(/\/status\/(\d+)/);
        const reply_tweet_id = match ? match[1] : '';
        if (!reply_tweet_id || reply_tweet_id === parentId) continue;

        const authorEl = article.querySelector('[data-testid="User-Name"] a[href*="/"]') as HTMLAnchorElement | null;
        let reply_author = '';
        if (authorEl) { const m = (authorEl.getAttribute('href') || '').match(/\/([^/]+)$/); reply_author = m ? m[1] : ''; }

        const textEl = article.querySelector('[data-testid="tweetText"]');
        const reply_text = (textEl?.textContent || '').trim().substring(0, 500);

        let reply_likes = 0;
        const likeBtn = article.querySelector('[data-testid="like"]');
        if (likeBtn) { const n = (likeBtn.getAttribute('aria-label') || '').match(/([\d,]+)/); if (n) reply_likes = parseInt(n[1].replace(/,/g, ''), 10) || 0; }

        results.push({ reply_tweet_id, reply_author, reply_text, reply_likes, reply_position: i, is_loser_sample: i > 5, parent_tweet_id: parentId });
      } catch { continue; }
    }
    return results;
  }, tweetId);

  console.log(`[ANON_SCRAPER] ${tweetId}: ${replies.length} replies extracted`);
  return replies;
}

// ─── OUR OWN TWEET METRICS (public) ───

export async function scrapeOurTweetMetrics(page: Page, tweetUrl: string): Promise<TweetMetrics | null> {
  try {
    await page.goto(tweetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000 + Math.random() * 2000);
    await handleConsentWall(page);
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });

    return await page.evaluate(() => {
      const article = document.querySelector('article[data-testid="tweet"]');
      if (!article) return null;

      const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
      const match = (link?.getAttribute('href') || '').match(/\/status\/(\d+)/);
      const tweet_id = match ? match[1] : '';

      let views = 0, likes = 0, replies = 0, retweets = 0, bookmarks = 0;

      // Method 1: Full metrics from combined aria-label
      // Twitter puts everything in one label: "54 replies, 162 reposts, 1437 likes, 1251 bookmarks, 379846 views"
      const allAriaEls = article.querySelectorAll('[aria-label]');
      for (const el of Array.from(allAriaEls)) {
        const aria = el.getAttribute('aria-label') || '';
        if (aria.includes('replies') && aria.includes('likes') && aria.includes('views')) {
          const viewsMatch = aria.match(/([\d,]+)\s*views?/i);
          const likesMatch = aria.match(/([\d,]+)\s*likes?/i);
          const repliesMatch = aria.match(/([\d,]+)\s*repl/i);
          const repostsMatch = aria.match(/([\d,]+)\s*repost/i);
          const bookmarksMatch = aria.match(/([\d,]+)\s*bookmark/i);
          if (viewsMatch) views = parseInt(viewsMatch[1].replace(/,/g, '')) || 0;
          if (likesMatch) likes = parseInt(likesMatch[1].replace(/,/g, '')) || 0;
          if (repliesMatch) replies = parseInt(repliesMatch[1].replace(/,/g, '')) || 0;
          if (repostsMatch) retweets = parseInt(repostsMatch[1].replace(/,/g, '')) || 0;
          if (bookmarksMatch) bookmarks = parseInt(bookmarksMatch[1].replace(/,/g, '')) || 0;
          break;
        }
      }

      // Method 2: Analytics link text (e.g., "379.8K Views")
      if (views === 0) {
        const analyticsLink = article.querySelector('a[href*="/analytics"]');
        if (analyticsLink) {
          const text = analyticsLink.textContent || '';
          const viewMatch = text.match(/([\d,.]+[KkMm]?)\s*[Vv]iews?/);
          if (viewMatch) {
            let v = viewMatch[1].replace(/,/g, '');
            if (v.endsWith('K') || v.endsWith('k')) views = Math.round(parseFloat(v) * 1000);
            else if (v.endsWith('M') || v.endsWith('m')) views = Math.round(parseFloat(v) * 1000000);
            else views = parseInt(v) || 0;
          }
        }
      }

      // Method 3: Individual button aria-labels (fallback for likes/replies/retweets)
      if (likes === 0) {
        const likeBtn = article.querySelector('[data-testid="like"]');
        if (likeBtn) { const n = (likeBtn.getAttribute('aria-label') || '').match(/([\d,]+)/); if (n) likes = parseInt(n[1].replace(/,/g, '')) || 0; }
      }
      if (replies === 0) {
        const replyBtn = article.querySelector('[data-testid="reply"]');
        if (replyBtn) { const n = (replyBtn.getAttribute('aria-label') || '').match(/([\d,]+)/); if (n) replies = parseInt(n[1].replace(/,/g, '')) || 0; }
      }
      if (retweets === 0) {
        const retweetBtn = article.querySelector('[data-testid="retweet"]');
        if (retweetBtn) { const n = (retweetBtn.getAttribute('aria-label') || '').match(/([\d,]+)/); if (n) retweets = parseInt(n[1].replace(/,/g, '')) || 0; }
      }

      return { tweet_id, views, likes, replies, retweets, bookmarks };
    });
  } catch {
    return null;
  }
}

// ─── SHARED TWEET EXTRACTION ───

async function extractTweets(page: Page, defaultAuthor?: string): Promise<ScrapedTweet[]> {
  return page.evaluate((defAuthor) => {
    const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    const results: any[] = [];
    for (const article of articles.slice(0, 30)) {
      try {
        if (article.textContent?.includes('Replying to')) continue;
        const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
        const match = (link?.getAttribute('href') || '').match(/\/status\/(\d+)/);
        const tweet_id = match ? match[1] : '';
        if (!tweet_id) continue;

        const authorEl = article.querySelector('[data-testid="User-Name"] a[href*="/"]') as HTMLAnchorElement | null;
        let author_username = defAuthor || '';
        if (authorEl) { const m = (authorEl.getAttribute('href') || '').match(/\/([^/]+)$/); if (m) author_username = m[1]; }

        const textEl = article.querySelector('[data-testid="tweetText"]');
        const content = (textEl?.textContent || '').trim().substring(0, 500);
        if (!content || content.length < 10) continue;

        const timeEl = article.querySelector('time');
        const posted_at = timeEl?.getAttribute('datetime') || null;

        let like_count = 0, reply_count = 0, retweet_count = 0, view_count = 0, bookmark_count = 0;

        // Try combined aria-label first (has all metrics including views)
        const ariaEls = article.querySelectorAll('[aria-label]');
        for (const el of Array.from(ariaEls)) {
          const aria = el.getAttribute('aria-label') || '';
          if (aria.includes('like') && aria.includes('view')) {
            const vm = aria.match(/([\d,]+)\s*views?/i); if (vm) view_count = parseInt(vm[1].replace(/,/g, '')) || 0;
            const lm = aria.match(/([\d,]+)\s*likes?/i); if (lm) like_count = parseInt(lm[1].replace(/,/g, '')) || 0;
            const rm = aria.match(/([\d,]+)\s*repl/i); if (rm) reply_count = parseInt(rm[1].replace(/,/g, '')) || 0;
            const rtm = aria.match(/([\d,]+)\s*repost/i); if (rtm) retweet_count = parseInt(rtm[1].replace(/,/g, '')) || 0;
            const bm = aria.match(/([\d,]+)\s*bookmark/i); if (bm) bookmark_count = parseInt(bm[1].replace(/,/g, '')) || 0;
            break;
          }
        }

        // Fallback: individual button aria-labels
        if (like_count === 0) {
          const likeBtn = article.querySelector('[data-testid="like"]');
          if (likeBtn) { const n = (likeBtn.getAttribute('aria-label') || '').match(/([\d,]+)/); if (n) like_count = parseInt(n[1].replace(/,/g, '')) || 0; }
        }
        if (reply_count === 0) {
          const replyBtn = article.querySelector('[data-testid="reply"]');
          if (replyBtn) { const n = (replyBtn.getAttribute('aria-label') || '').match(/([\d,]+)/); if (n) reply_count = parseInt(n[1].replace(/,/g, '')) || 0; }
        }
        if (retweet_count === 0) {
          const retweetBtn = article.querySelector('[data-testid="retweet"]');
          if (retweetBtn) { const n = (retweetBtn.getAttribute('aria-label') || '').match(/([\d,]+)/); if (n) retweet_count = parseInt(n[1].replace(/,/g, '')) || 0; }
        }

        results.push({ tweet_id, author_username, content, posted_at, like_count, reply_count, retweet_count, view_count, bookmark_count });
      } catch { continue; }
    }
    return results;
  }, defaultAuthor || '');
}

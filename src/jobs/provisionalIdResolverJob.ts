/**
 * 🔍 PROVISIONAL TWEET ID RESOLVER
 *
 * Resolves `posted_strong_evidence_*` placeholder IDs to real tweet IDs
 * by checking the user's profile for matching content.
 *
 * Without this, ~10-15% of posts are invisible to the metrics scraper
 * and never feed into the learning loop.
 */

import { getSupabaseClient } from '../db';

export interface ProvisionalResolverResult {
  checked: number;
  resolved: number;
  unresolved: number;
  errors: string[];
}

/**
 * Simple Dice coefficient for fuzzy text matching (no external dependencies)
 */
function diceCoefficient(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const aN = normalize(a);
  const bN = normalize(b);
  if (aN === bN) return 1;
  if (aN.length < 2 || bN.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const set = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bi = s.substring(i, i + 2);
      set.set(bi, (set.get(bi) || 0) + 1);
    }
    return set;
  };

  const aB = bigrams(aN);
  const bB = bigrams(bN);
  let intersection = 0;
  for (const [bi, count] of aB) {
    intersection += Math.min(count, bB.get(bi) || 0);
  }
  return (2 * intersection) / (aN.length - 1 + bN.length - 1);
}

export async function runProvisionalIdResolver(): Promise<ProvisionalResolverResult> {
  const result: ProvisionalResolverResult = { checked: 0, resolved: 0, unresolved: 0, errors: [] };

  // Guard: only run on Mac executor (needs browser)
  if (process.env.RUNNER_MODE !== 'true') {
    console.log('[PROVISIONAL_RESOLVER] ⏭️ Skipping — RUNNER_MODE not set');
    return result;
  }

  const supabase = getSupabaseClient();

  // 1. Find posts with provisional tweet IDs from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: provisionalPosts, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, content, posted_at')
    .eq('status', 'posted')
    .like('tweet_id', 'posted_strong_evidence_%')
    .gte('posted_at', sevenDaysAgo)
    .order('posted_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[PROVISIONAL_RESOLVER] ❌ Query failed:', error.message);
    result.errors.push(error.message);
    return result;
  }

  if (!provisionalPosts || provisionalPosts.length === 0) {
    console.log('[PROVISIONAL_RESOLVER] ✅ No provisional IDs to resolve');
    return result;
  }

  console.log(`[PROVISIONAL_RESOLVER] 🔍 Found ${provisionalPosts.length} provisional IDs to resolve`);

  // 2. Acquire browser and navigate to profile
  try {
    const { withBrowserLock, BrowserPriority } = await import('../browser/BrowserSemaphore');
    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');

    await withBrowserLock('provisional_resolver', BrowserPriority.METRICS, async () => {
      const pool = UnifiedBrowserPool.getInstance();
      const page = await pool.acquirePage('provisional_resolver');

      // Get username from env or page
      let username = process.env.TWITTER_USERNAME;
      if (!username) {
        // Try to extract from page DOM
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForTimeout(2000);
        const profileLink = await page.$('a[data-testid="AppTabBar_Profile_Link"]');
        if (profileLink) {
          const href = await profileLink.getAttribute('href');
          if (href) {
            const match = href.match(/\/([^\/]+)$/);
            if (match?.[1]) username = match[1];
          }
        }
      }

      if (!username) {
        console.error('[PROVISIONAL_RESOLVER] ❌ Could not determine Twitter username');
        result.errors.push('username_not_found');
        return;
      }

      console.log(`[PROVISIONAL_RESOLVER] 👤 Username: ${username}`);

      // Navigate to profile with_replies (ONE navigation for all provisionals)
      await page.goto(`https://x.com/${username}/with_replies`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });
      await page.waitForTimeout(3000);

      // Extract all visible tweets (ID + content)
      const profileTweets: { id: string; content: string }[] = [];
      const articles = await page.$$('article[data-testid="tweet"]');
      console.log(`[PROVISIONAL_RESOLVER] 📄 Found ${articles.length} tweets on profile`);

      for (const article of articles.slice(0, 20)) {
        try {
          const link = await article.$('a[href*="/status/"]');
          if (!link) continue;
          const href = await link.getAttribute('href');
          if (!href) continue;
          const match = href.match(/\/status\/(\d{15,20})/);
          if (!match) continue;

          const text = await article.textContent();
          if (!text) continue;

          profileTweets.push({ id: match[1], content: text });
        } catch {
          continue;
        }
      }

      console.log(`[PROVISIONAL_RESOLVER] 📊 Extracted ${profileTweets.length} tweets with IDs`);

      // 3. Match each provisional post against profile tweets
      for (const post of provisionalPosts) {
        result.checked++;
        const dbContent = post.content || '';
        if (!dbContent || dbContent.length < 10) {
          console.log(`[PROVISIONAL_RESOLVER] ⏭️ Skipping ${post.decision_id} — content too short`);
          result.unresolved++;
          continue;
        }

        let bestMatch: { id: string; score: number } | null = null;

        for (const tweet of profileTweets) {
          const score = diceCoefficient(dbContent, tweet.content);
          if (score >= 0.7 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { id: tweet.id, score };
          }
        }

        if (bestMatch) {
          if (/^\d{15,20}$/.test(bestMatch.id)) {
            const { error: updateErr } = await supabase
              .from('content_generation_metadata_comprehensive')
              .update({ tweet_id: bestMatch.id })
              .eq('decision_id', post.decision_id);

            if (updateErr) {
              console.error(`[PROVISIONAL_RESOLVER] ❌ DB update failed for ${post.decision_id}: ${updateErr.message}`);
              result.errors.push(`update_failed:${post.decision_id}`);
              result.unresolved++;
            } else {
              console.log(`[PROVISIONAL_RESOLVER] ✅ Resolved ${post.decision_id}: ${post.tweet_id} → ${bestMatch.id} (score=${bestMatch.score.toFixed(2)})`);
              result.resolved++;
            }
          } else {
            result.unresolved++;
          }
        } else {
          console.log(`[PROVISIONAL_RESOLVER] ⚠️ No match for ${post.decision_id} (best score below 0.7)`);
          result.unresolved++;
        }
      }
    });
  } catch (err: any) {
    console.error(`[PROVISIONAL_RESOLVER] ❌ Browser operation failed: ${err.message}`);
    result.errors.push(err.message);
  }

  console.log(`[PROVISIONAL_RESOLVER] 📊 Done: checked=${result.checked} resolved=${result.resolved} unresolved=${result.unresolved}`);
  return result;
}

import { Page } from 'playwright';

export async function scrapeOwnProfile(page: Page, username: string): Promise<void> {
  console.log(`[OWN_PROFILE] Checking @${username} metrics...`);

  try {
    await page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000 + Math.random() * 2000);

    // Wait for tweets
    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
    } catch {
      console.warn('[OWN_PROFILE] No tweets found on profile');
      return;
    }

    // Scroll a couple times (human behavior)
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy({ top: 400 + Math.random() * 300, behavior: 'smooth' }));
      await page.waitForTimeout(1500 + Math.random() * 1500);
    }

    // Extract metrics from visible tweets
    const metrics = await page.evaluate(() => {
      const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      const results: any[] = [];

      for (const article of articles) {
        try {
          // Tweet ID
          const link = article.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null;
          const href = link?.getAttribute('href') || '';
          const match = href.match(/\/status\/(\d+)/);
          const tweet_id = match ? match[1] : '';
          if (!tweet_id) continue;

          // Engagement from aria-labels
          let likes = 0, replies = 0, retweets = 0, views = 0;

          const likeBtn = article.querySelector('[data-testid="like"]');
          if (likeBtn) {
            const aria = likeBtn.getAttribute('aria-label') || '';
            const n = aria.match(/([\d,]+)/);
            if (n) likes = parseInt(n[1].replace(/,/g, ''), 10) || 0;
          }

          const replyBtn = article.querySelector('[data-testid="reply"]');
          if (replyBtn) {
            const aria = replyBtn.getAttribute('aria-label') || '';
            const n = aria.match(/([\d,]+)/);
            if (n) replies = parseInt(n[1].replace(/,/g, ''), 10) || 0;
          }

          const retweetBtn = article.querySelector('[data-testid="retweet"]');
          if (retweetBtn) {
            const aria = retweetBtn.getAttribute('aria-label') || '';
            const n = aria.match(/([\d,]+)/);
            if (n) retweets = parseInt(n[1].replace(/,/g, ''), 10) || 0;
          }

          // View count (visible on own tweets when logged in)
          // Try analytics link
          const analyticsLink = article.querySelector('a[href*="/analytics"]');
          if (analyticsLink) {
            const text = analyticsLink.textContent || '';
            const viewMatch = text.match(/([\d,.]+[KkMm]?)\s*view/i);
            if (viewMatch) {
              let v = viewMatch[1].replace(/,/g, '');
              if (v.endsWith('K') || v.endsWith('k')) views = Math.round(parseFloat(v) * 1000);
              else if (v.endsWith('M') || v.endsWith('m')) views = Math.round(parseFloat(v) * 1000000);
              else views = parseInt(v) || 0;
            }
          }
          // Also try aria-label with "views"
          if (views === 0) {
            const allLinks = article.querySelectorAll('a');
            for (const a of Array.from(allLinks)) {
              const aria = a.getAttribute('aria-label') || '';
              const viewMatch = aria.match(/([\d,]+)\s*view/i);
              if (viewMatch) {
                views = parseInt(viewMatch[1].replace(/,/g, ''), 10) || 0;
                break;
              }
            }
          }

          results.push({ tweet_id, views, likes, replies, retweets });
        } catch { continue; }
      }
      return results;
    });

    if (metrics.length === 0) {
      console.log('[OWN_PROFILE] No tweet metrics extracted');
      return;
    }

    // Write metrics to DB
    try {
      const { getSupabaseClient } = await import('../db/index');
      const supabase = getSupabaseClient();

      for (const m of metrics) {
        // Update outcomes table
        await supabase.from('outcomes').upsert({
          tweet_id: m.tweet_id,
          views: m.views || null,
          likes: m.likes,
          replies: m.replies,
          retweets: m.retweets,
          collected_at: new Date().toISOString(),
          data_source: 'own_profile_scrape',
        }, { onConflict: 'tweet_id' });

        // Update content_metadata
        await supabase.from('content_generation_metadata_comprehensive')
          .update({
            actual_impressions: m.views || undefined,
            actual_likes: m.likes,
            updated_at: new Date().toISOString(),
          })
          .eq('tweet_id', m.tweet_id);
      }

      console.log(`[OWN_PROFILE] Updated metrics for ${metrics.length} tweets (views: ${metrics.map(m => m.views).join(', ')})`);
    } catch (dbErr: any) {
      console.warn(`[OWN_PROFILE] DB write failed: ${dbErr.message}`);
    }

  } catch (err: any) {
    console.warn(`[OWN_PROFILE] Profile scrape failed: ${err.message}`);
  }
}

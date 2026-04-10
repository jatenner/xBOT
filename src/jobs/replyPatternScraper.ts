/**
 * Reply Pattern Scraper
 *
 * Scrapes top replies on viral tweets to learn what reply patterns
 * get engagement. Collects features for downstream AI classification.
 */

import { getSupabaseClient } from '../db/index';
import { extractContentFeatures } from '../utils/contentFeatureExtractor';

const TAG = '[REPLY_PATTERN_SCRAPER]';

interface ExtractedReply {
  reply_text: string;
  author_handle: string;
  like_count: number;
  reply_position: number;
  is_loser_sample: boolean;
}

export async function replyPatternScraperJob(): Promise<{
  tweetsChecked: number;
  repliesCollected: number;
  errors: number;
}> {
  let tweetsChecked = 0;
  let repliesCollected = 0;
  let errors = 0;

  try {
    const supabase = getSupabaseClient();
    if (!supabase) {
      console.log(`${TAG} No supabase client available, aborting`);
      return { tweetsChecked, repliesCollected, errors: 1 };
    }

    // ── 1. Gather viral parent tweets from two sources ──────────────

    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [viResult, roResult] = await Promise.all([
      supabase
        .from('vi_collected_tweets')
        .select('tweet_id')
        .or('is_viral.eq.true,likes.gt.500')
        .gte('created_at', cutoff)
        .limit(15),
      supabase
        .from('reply_opportunities')
        .select('tweet_id')
        .gt('like_count', 500)
        .gte('created_at', cutoff)
        .limit(10),
    ]);

    const seen = new Set<string>();
    const parentTweetIds: string[] = [];

    for (const row of viResult.data ?? []) {
      if (row.tweet_id && !seen.has(row.tweet_id)) {
        seen.add(row.tweet_id);
        parentTweetIds.push(row.tweet_id);
      }
    }
    for (const row of roResult.data ?? []) {
      if (row.tweet_id && !seen.has(row.tweet_id)) {
        seen.add(row.tweet_id);
        parentTweetIds.push(row.tweet_id);
      }
    }

    // Cap at 25 total
    const targets = parentTweetIds.slice(0, 25);
    console.log(`${TAG} Found ${targets.length} viral tweets to scrape replies from`);

    if (targets.length === 0) {
      console.log(`${TAG} No viral tweets found in last 48h, exiting`);
      return { tweetsChecked, repliesCollected, errors };
    }

    // ── 2. Acquire browser pool ─────────────────────────────────────

    const { UnifiedBrowserPool } = await import('../browser/UnifiedBrowserPool');
    const pool = UnifiedBrowserPool.getInstance();

    // ── 3. Scrape replies for each parent tweet ─────────────────────

    for (const tweetId of targets) {
      try {
        await pool.withContext('reply_scraper', async (context) => {
          const page = await context.newPage();
          try {
            // Navigate to tweet
            await page.goto(`https://x.com/i/status/${tweetId}`, {
              waitUntil: 'domcontentloaded',
              timeout: 15000,
            });

            // Wait for tweet elements to appear
            await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });

            // Scroll down 3 times to load top replies
            for (let i = 0; i < 3; i++) {
              await page.evaluate(() => window.scrollBy(0, window.innerHeight));
              await new Promise((r) => setTimeout(r, 1000));
            }

            // Scroll more to load lower-ranked replies
            for (let s = 0; s < 5; s++) {
              await page.evaluate(() => window.scrollBy(0, 800));
              await page.waitForTimeout(800 + Math.random() * 400);
            }

            // Extract top replies (positions 1-5) and loser replies (positions 15-20)
            const replies = await page.evaluate<ExtractedReply[]>(() => {
              function extractReply(el: Element, position: number, isLoser: boolean) {
                const textEl = el.querySelector('[data-testid="tweetText"]');
                const replyText = textEl?.textContent?.trim() ?? '';

                const handleLink = el.querySelector('a[href^="/"]');
                const href = handleLink?.getAttribute('href') ?? '';
                const authorHandle = href.replace(/^\//, '').split('/')[0] || 'unknown';

                let likeCount = 0;
                const likeButton = el.querySelector('[data-testid="like"]') || el.querySelector('[data-testid="unlike"]');
                if (likeButton) {
                  const label = likeButton.getAttribute('aria-label') ?? '';
                  const m = label.match(/(\d[\d,]*)/);
                  if (m) likeCount = parseInt(m[1].replace(/,/g, ''), 10) || 0;
                }

                return {
                  reply_text: replyText,
                  author_handle: authorHandle,
                  like_count: likeCount,
                  reply_position: position,
                  is_loser_sample: isLoser,
                };
              }

              const allTweets = Array.from(document.querySelectorAll('[data-testid="tweet"]'));
              // First tweet is the parent — skip it
              const replyElements = allTweets.slice(1);
              const results: any[] = [];

              // Top replies: positions 1-5
              const topSlice = replyElements.slice(0, 5);
              for (let i = 0; i < topSlice.length; i++) {
                results.push(extractReply(topSlice[i], i + 1, false));
              }

              // Loser replies: positions 15-20 (lower engagement, further down)
              const loserSlice = replyElements.slice(14, 20);
              for (let i = 0; i < loserSlice.length; i++) {
                results.push(extractReply(loserSlice[i], 15 + i, true));
              }

              return results;
            });

            tweetsChecked++;
            console.log(`${TAG} Tweet ${tweetId}: extracted ${replies.length} replies`);

            // Upsert each reply
            for (const reply of replies) {
              if (!reply.reply_text) continue;

              const features = extractContentFeatures(reply.reply_text);

              // Build a deterministic reply_tweet_id when we don't have one
              const replyTweetId = `${tweetId}_pos${reply.reply_position}`;

              const { error: upsertError } = await supabase
                .from('external_reply_patterns')
                .upsert(
                  {
                    reply_tweet_id: replyTweetId,
                    parent_tweet_id: tweetId,
                    reply_text: reply.reply_text,
                    author_handle: reply.author_handle,
                    like_count: reply.like_count,
                    reply_position: reply.reply_position,
                    is_loser_sample: reply.is_loser_sample,
                    features,
                    classified: false,
                    scraped_at: new Date().toISOString(),
                  },
                  { onConflict: 'reply_tweet_id' }
                );

              if (upsertError) {
                console.log(`${TAG} Upsert error for reply on ${tweetId}: ${upsertError.message}`);
                errors++;
              } else {
                repliesCollected++;
              }
            }
          } finally {
            await page.close();
          }
        }, 7);

        // Random delay 2-3s between tweets
        const delay = 2000 + Math.random() * 1000;
        await new Promise((r) => setTimeout(r, delay));
      } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg.includes('queue') || msg.includes('Queue')) {
          console.log(`${TAG} Browser pool queue full, returning early`);
          return { tweetsChecked, repliesCollected, errors };
        }
        console.warn(`${TAG} Failed to scrape replies for tweet ${tweetId}: ${msg}`);
        errors++;
      }
    }

    console.log(
      `${TAG} Done. tweetsChecked=${tweetsChecked} repliesCollected=${repliesCollected} errors=${errors}`
    );
  } catch (err: any) {
    console.error(`${TAG} Fatal error: ${err?.message ?? err}`);
    errors++;
  }

  return { tweetsChecked, repliesCollected, errors };
}

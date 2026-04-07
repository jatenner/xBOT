/**
 * Reply Context Enricher
 *
 * Background job that fills in missing reply context on brain_tweets.
 * For reply tweets that have reply_to_username but are missing
 * reply_delay_minutes and reply_target_followers, this job:
 *
 * 1. Navigates to the reply tweet's status page (anonymous)
 * 2. Extracts the parent tweet's timestamp and author follower count
 * 3. Computes reply_delay_minutes
 * 4. Updates the brain_tweet record
 *
 * This is essential for behavioral analysis — without reply delay and
 * target size, we can't answer "when should we reply?" or "who should
 * we reply to?"
 *
 * Runs every 15 minutes, processes 20 tweets per cycle.
 */

import { getSupabaseClient } from '../../db';
import { getBrainPage, brainGoto } from '../feeds/brainNavigator';

const LOG_PREFIX = '[observatory/reply-enricher]';
const BATCH_SIZE = 20;

export async function runReplyContextEnricher(): Promise<{
  enriched: number;
  errors: number;
}> {
  const supabase = getSupabaseClient();

  // Find reply tweets that need enrichment
  const { data: unenriched } = await supabase
    .from('brain_tweets')
    .select('id, tweet_id, reply_to_username, posted_at, author_username')
    .eq('tweet_type', 'reply')
    .not('reply_to_username', 'is', null)
    .is('reply_delay_minutes', null)
    .order('created_at', { ascending: false })
    .limit(BATCH_SIZE);

  if (!unenriched || unenriched.length === 0) {
    return { enriched: 0, errors: 0 };
  }

  let enriched = 0;
  let errors = 0;

  let page: any;
  try {
    page = await getBrainPage();
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Failed to get browser page: ${err.message}`);
    return { enriched: 0, errors: 0 };
  }

  try {
    for (const tweet of unenriched) {
      try {
        const result = await enrichReplyContext(page, tweet);

        if (result) {
          const updateData: Record<string, any> = {};

          if (result.reply_delay_minutes !== null) {
            updateData.reply_delay_minutes = result.reply_delay_minutes;
          }
          if (result.reply_target_followers !== null) {
            updateData.reply_target_followers = result.reply_target_followers;
          }
          if (result.parent_tweet_id) {
            updateData.parent_tweet_id = result.parent_tweet_id;
          }
          if ((result as any).parent_content) {
            updateData.parent_content = (result as any).parent_content;
          }
          if ((result as any).parent_author) {
            updateData.parent_author = (result as any).parent_author;
          }
          if ((result as any).parent_likes > 0) {
            updateData.parent_likes = (result as any).parent_likes;
          }

          if (Object.keys(updateData).length > 0) {
            await supabase
              .from('brain_tweets')
              .update(updateData)
              .eq('id', tweet.id);
            enriched++;
          }
        } else {
          // Mark as enriched with null to avoid re-processing
          // Set delay to -1 to indicate "could not determine"
          await supabase
            .from('brain_tweets')
            .update({ reply_delay_minutes: -1 })
            .eq('id', tweet.id);
        }
      } catch (err: any) {
        errors++;
      }
    }
  } finally {
    try { await page.close(); } catch {}
  }

  if (enriched > 0 || errors > 0) {
    console.log(`${LOG_PREFIX} Enriched ${enriched} replies, ${errors} errors`);
  }

  return { enriched, errors };
}

async function enrichReplyContext(
  page: any,
  tweet: { tweet_id: string; reply_to_username: string; posted_at: string | null; author_username: string },
): Promise<{
  reply_delay_minutes: number | null;
  reply_target_followers: number | null;
  parent_tweet_id: string | null;
} | null> {
  // Navigate to the reply tweet's status page — this shows it in thread context
  const statusUrl = `https://x.com/${tweet.author_username}/status/${tweet.tweet_id}`;
  const nav = await brainGoto(page, statusUrl, 12000);

  if (!nav.success) return null;

  // Wait briefly for thread to load
  try {
    await page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 });
  } catch {
    return null;
  }

  // Extract parent tweet info from the conversation thread
  const context = await page.evaluate(`
    (function() {
      var result = { parent_time: null, parent_followers: null, parent_tweet_id: null, parent_content: null, parent_author: null, parent_likes: 0 };

      // In a conversation view, the parent tweet appears ABOVE the current tweet
      var articles = document.querySelectorAll('article[data-testid="tweet"]');

      if (articles.length < 2) return result; // No parent visible

      // First article is typically the parent tweet
      var parentArticle = articles[0];

      // Extract parent tweet time
      var timeEl = parentArticle.querySelector('time');
      if (timeEl) {
        var datetime = timeEl.getAttribute('datetime');
        if (datetime) result.parent_time = datetime;
      }

      // Extract parent tweet ID from link
      var links = parentArticle.querySelectorAll('a[href*="/status/"]');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        var match = href.match(/\\/status\\/(\\d+)/);
        if (match) {
          result.parent_tweet_id = match[1];
          break;
        }
      }

      // Extract parent tweet CONTENT — what they actually replied to
      var parentTextEl = parentArticle.querySelector('[data-testid="tweetText"]');
      if (parentTextEl) {
        result.parent_content = (parentTextEl.textContent || '').trim().substring(0, 500);
      }

      // Extract parent author username
      var authorLinks = parentArticle.querySelectorAll('a[role="link"]');
      for (var j = 0; j < authorLinks.length; j++) {
        var ah = authorLinks[j].getAttribute('href') || '';
        if (ah.match(/^\\/[a-zA-Z0-9_]+$/) && ah.indexOf('/status/') === -1) {
          result.parent_author = ah.replace('/', '');
          break;
        }
      }

      // Extract parent likes (engagement of the tweet they replied to)
      var likeEl = parentArticle.querySelector('[data-testid="like"]');
      if (likeEl) {
        var btn = likeEl.closest('button') || likeEl;
        var aria = (btn.getAttribute('aria-label') || '');
        var m = aria.match(/(\\d[\\d,]*)/);
        if (m) result.parent_likes = parseInt(m[1].replace(/,/g, ''), 10);
      }

      return result;
    })()
  `);

  if (!context || !context.parent_time) return null;

  // Compute reply delay
  let delayMinutes: number | null = null;
  if (tweet.posted_at && context.parent_time) {
    const replyTime = new Date(tweet.posted_at).getTime();
    const parentTime = new Date(context.parent_time).getTime();
    if (replyTime > parentTime) {
      delayMinutes = Math.round((replyTime - parentTime) / (60 * 1000));
    }
  }

  // Look up the target's follower count from brain_accounts
  let targetFollowers: number | null = null;
  if (tweet.reply_to_username) {
    const supabase = getSupabaseClient();
    const { data: targetAccount } = await supabase
      .from('brain_accounts')
      .select('followers_count')
      .eq('username', tweet.reply_to_username.toLowerCase())
      .single();

    if (targetAccount) {
      targetFollowers = targetAccount.followers_count;
    }
  }

  return {
    reply_delay_minutes: delayMinutes,
    reply_target_followers: targetFollowers,
    parent_tweet_id: context.parent_tweet_id,
  };
}

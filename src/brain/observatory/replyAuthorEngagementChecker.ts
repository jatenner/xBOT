/**
 * Reply-Author Engagement Checker
 *
 * Captures the highest-weighted signal in the public X Heavy Ranker config:
 * `reply_engaged_by_author` (weight 75.0 — the single largest positive weight).
 *
 * For each external_reply_patterns row where parent is recent and check is
 * unset, navigate to the parent's thread and detect which captured replies
 * the parent author themselves replied back to. Set
 * `parent_author_replied_to_this_reply` accordingly.
 *
 * Anonymous browsing — public conversations don't require auth.
 */
import { getSupabaseClient } from '../../db';
import { submitBatch } from '../feeds/brainBrowserPool';
import { brainGoto } from '../feeds/brainNavigator';
import type { Page } from 'playwright';

const LOG_PREFIX = '[brain/observatory/reply-author-check]';

const MAX_PARENTS_PER_RUN = 50;
const HOURS_LOOKBACK = 24; // authors rarely engage older replies
const SCROLL_COUNT = 6;
const SCROLL_DELAY_MS = 1500;
const PER_PAGE_TIMEOUT_MS = 25000;

interface ParentBatch {
  parent_tweet_id: string;
  parent_author_username: string;
  parent_posted_at: string | null;
  reply_authors_to_check: Set<string>; // lowercased
  reply_row_ids: string[]; // we update by (parent_tweet_id, reply_author_username) pair
}

export async function runReplyAuthorEngagementChecker(): Promise<{
  parents_processed: number;
  rows_updated: number;
  errors: number;
}> {
  const supabase = getSupabaseClient();
  const sinceIso = new Date(Date.now() - HOURS_LOOKBACK * 60 * 60 * 1000).toISOString();

  const { data: pendingRows, error } = await supabase
    .from('external_reply_patterns')
    .select(
      'parent_tweet_id, parent_author_username, parent_posted_at, reply_author_username, reply_tweet_id',
    )
    .is('parent_author_replied_to_this_reply', null)
    .gte('parent_posted_at', sinceIso)
    .order('parent_posted_at', { ascending: false })
    .limit(MAX_PARENTS_PER_RUN * 30); // ~30 replies per parent on average

  if (error) {
    console.error(`${LOG_PREFIX} Select failed: ${error.message}`);
    return { parents_processed: 0, rows_updated: 0, errors: 1 };
  }
  if (!pendingRows || pendingRows.length === 0) {
    console.log(`${LOG_PREFIX} No pending rows`);
    return { parents_processed: 0, rows_updated: 0, errors: 0 };
  }

  // Group rows by parent so we visit each thread once.
  const byParent = new Map<string, ParentBatch>();
  for (const r of pendingRows as any[]) {
    if (!r.parent_tweet_id || !r.parent_author_username || !r.reply_author_username) continue;
    let batch = byParent.get(r.parent_tweet_id);
    if (!batch) {
      batch = {
        parent_tweet_id: r.parent_tweet_id,
        parent_author_username: r.parent_author_username,
        parent_posted_at: r.parent_posted_at,
        reply_authors_to_check: new Set<string>(),
        reply_row_ids: [],
      };
      byParent.set(r.parent_tweet_id, batch);
    }
    batch.reply_authors_to_check.add(String(r.reply_author_username).toLowerCase());
    if (r.reply_tweet_id) batch.reply_row_ids.push(r.reply_tweet_id);
  }

  const parents = Array.from(byParent.values()).slice(0, MAX_PARENTS_PER_RUN);

  let parentsProcessed = 0;
  let rowsUpdated = 0;
  let errors = 0;
  const startedAt = Date.now();

  // One browser task per parent thread.
  const tasks = parents.map(parent => async (page: Page) => {
    const url = `https://x.com/${parent.parent_author_username}/status/${parent.parent_tweet_id}`;
    const nav = await brainGoto(page, url, PER_PAGE_TIMEOUT_MS);
    if (!nav.success) {
      errors++;
      // Mark attempt so we don't loop on hard-broken parents
      await markAttemptedOnly(supabase, parent.parent_tweet_id);
      return;
    }

    try {
      await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
    } catch {
      errors++;
      await markAttemptedOnly(supabase, parent.parent_tweet_id);
      return;
    }

    for (let s = 0; s < SCROLL_COUNT; s++) {
      await page.evaluate('window.scrollBy(0, 1200)');
      await page.waitForTimeout(SCROLL_DELAY_MS);
    }

    const repliedTo = await extractParentAuthorRepliedTo(page, parent.parent_author_username);

    // For each reply_author we checked, was it replied to by parent author?
    const updates: { reply_author: string; replied: boolean }[] = [];
    for (const replyAuthor of parent.reply_authors_to_check) {
      updates.push({ reply_author: replyAuthor, replied: repliedTo.has(replyAuthor) });
    }

    const updated = await persistFlags(supabase, parent.parent_tweet_id, updates);
    rowsUpdated += updated;
    parentsProcessed++;
  });

  await submitBatch('low', tasks);

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `${LOG_PREFIX} Done — ${parentsProcessed}/${parents.length} parents, ` +
    `${rowsUpdated} rows flagged, ${errors} errors, elapsed=${elapsedSec}s`,
  );

  return { parents_processed: parentsProcessed, rows_updated: rowsUpdated, errors };
}

// ─── DOM extraction ────────────────────────────────────────────────────────

async function extractParentAuthorRepliedTo(
  page: Page,
  parentAuthor: string,
): Promise<Set<string>> {
  const parentAuthorLower = parentAuthor.toLowerCase();
  const result: string[] = await page.evaluate(`
    (function(parentAuthor) {
      var articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
      var repliedTo = new Set();

      // Skip first article (the parent tweet itself).
      for (var i = 1; i < articles.length; i++) {
        var article = articles[i];

        // Identify the author of this article (the reply card author).
        var authorLinks = article.querySelectorAll('a[role="link"]');
        var author = null;
        for (var j = 0; j < authorLinks.length; j++) {
          var ah = authorLinks[j].getAttribute('href') || '';
          if (ah.match(/^\\/[a-zA-Z0-9_]+$/) && ah.indexOf('/status/') === -1) {
            author = ah.replace('/', '').toLowerCase();
            break;
          }
        }
        if (!author || author !== parentAuthor) continue;

        // This article is a reply BY the parent author. What is it replying to?
        // X renders "Replying to @user1 @user2" near the article header.
        var bodyText = article.innerText || article.textContent || '';
        var rxAll = /Replying to\\s+((?:@[a-zA-Z0-9_]+(?:[\\s,]+)?)+)/gi;
        var rxOne;
        while ((rxOne = rxAll.exec(bodyText)) !== null) {
          var users = rxOne[1].match(/@[a-zA-Z0-9_]+/g) || [];
          for (var u = 0; u < users.length; u++) {
            repliedTo.add(users[u].substring(1).toLowerCase());
          }
        }
      }

      return Array.from(repliedTo);
    })(${JSON.stringify(parentAuthorLower)})
  `);

  return new Set(result);
}

// ─── Persistence ───────────────────────────────────────────────────────────

async function persistFlags(
  supabase: any,
  parentTweetId: string,
  updates: { reply_author: string; replied: boolean }[],
): Promise<number> {
  if (updates.length === 0) return 0;

  let total = 0;
  for (const u of updates) {
    // Match by parent + reply_author (lowercased) — the natural pair.
    const { error, count } = await supabase
      .from('external_reply_patterns')
      .update({
        parent_author_replied_to_this_reply: u.replied,
        engagement_check_attempted_at: new Date().toISOString(),
      }, { count: 'exact' })
      .eq('parent_tweet_id', parentTweetId)
      .ilike('reply_author_username', u.reply_author);
    if (error) {
      console.warn(`${LOG_PREFIX} update failed for parent=${parentTweetId} reply_author=${u.reply_author}: ${error.message}`);
      continue;
    }
    total += count ?? 0;
  }
  return total;
}

async function markAttemptedOnly(supabase: any, parentTweetId: string): Promise<void> {
  // Mark engagement_check_attempted_at so we don't retry on the next tick.
  // parent_author_replied_to_this_reply stays NULL so a periodic re-check job
  // (if added later) can target unflagged-but-attempted rows separately.
  await supabase
    .from('external_reply_patterns')
    .update({ engagement_check_attempted_at: new Date().toISOString() })
    .eq('parent_tweet_id', parentTweetId)
    .is('parent_author_replied_to_this_reply', null);
}

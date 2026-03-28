/**
 * Content Archiver
 *
 * Selectively scrapes timelines of GROWING accounts only.
 * Stores every tweet with timestamps for chronological reconstruction.
 *
 * When the growth detector flags an account as interesting/hot/explosive,
 * the content archiver scrapes their full visible timeline so we have
 * the evidence of what they were doing when they grew.
 *
 * Reuses existing extractTweetsFromPage() and ingestFeedResults()
 * from the brain discovery engine.
 *
 * Archive frequency:
 *   explosive: every 6 hours
 *   hot: every 12 hours
 *   interesting: every 24 hours
 *   boring/unknown: not archived (census only)
 */

import { getSupabaseClient } from '../../db';
import { submitTask } from '../feeds/brainBrowserPool';
import { brainGoto, scrollForMore } from '../feeds/brainNavigator';
import { extractTweetsFromPage, ingestFeedResults, type FeedResult } from '../discoveryEngine';

const LOG_PREFIX = '[observatory/content-archiver]';

const ARCHIVE_FREQUENCY_HOURS: Record<string, number> = {
  explosive: 6,
  hot: 12,
  interesting: 24,
};

const MAX_ACCOUNTS_PER_RUN = 15;
const TWEETS_PER_ACCOUNT_DEFAULT = 25;
const TWEETS_PER_ACCOUNT_EXPLOSIVE = 50;

export async function runContentArchiver(): Promise<{
  accounts_archived: number;
  tweets_ingested: number;
  errors: number;
}> {
  const supabase = getSupabaseClient();

  // Find growing accounts that need archiving
  const { data: accounts, error } = await supabase
    .from('brain_accounts')
    .select('username, growth_status, last_scraped_at, followers_count')
    .in('growth_status', ['interesting', 'hot', 'explosive'])
    .eq('is_active', true)
    .order('last_scraped_at', { ascending: true, nullsFirst: true })
    .limit(MAX_ACCOUNTS_PER_RUN * 3); // Overfetch to filter by freshness

  if (error || !accounts || accounts.length === 0) {
    return { accounts_archived: 0, tweets_ingested: 0, errors: 0 };
  }

  // Filter to accounts that are due for re-archive
  const now = Date.now();
  const dueAccounts = accounts.filter(a => {
    const freqHours = ARCHIVE_FREQUENCY_HOURS[a.growth_status] ?? 24;
    if (!a.last_scraped_at) return true; // Never archived
    const lastScraped = new Date(a.last_scraped_at).getTime();
    return (now - lastScraped) >= freqHours * 60 * 60 * 1000;
  }).slice(0, MAX_ACCOUNTS_PER_RUN);

  if (dueAccounts.length === 0) {
    return { accounts_archived: 0, tweets_ingested: 0, errors: 0 };
  }

  let totalArchived = 0;
  let totalIngested = 0;
  let totalErrors = 0;
  const allResults: FeedResult[] = [];
  const feedRunId = `growth_archive_${Date.now()}`;

  for (const account of dueAccounts) {
    const username = account.username;
    const isExplosive = account.growth_status === 'explosive';
    const maxTweets = isExplosive ? TWEETS_PER_ACCOUNT_EXPLOSIVE : TWEETS_PER_ACCOUNT_DEFAULT;
    const scrollCount = isExplosive ? 5 : 3;

    try {
      await submitTask('medium', async (page) => {
        const nav = await brainGoto(page, `https://x.com/${username}`, 20000);
        if (!nav.success) {
          totalErrors++;
          return;
        }

        // Wait for tweets
        try {
          await page.waitForSelector('article[data-testid="tweet"]', { timeout: 10000 });
        } catch {
          totalErrors++;
          return;
        }

        // Scroll to load more tweets
        await scrollForMore(page, scrollCount, 1500);

        // Extract ALL tweets (including replies — we want the full picture)
        const tweets = await extractTweetsFromPage(page, {
          maxTweets: maxTweets,
          skipReplies: false, // Archive replies too — they're part of the growth story
        });

        if (tweets.length > 0) {
          // Tag each tweet with the account's username (profile scraping may miss @handle)
          for (const tweet of tweets) {
            if (!tweet.author_username || tweet.author_username === 'unknown') {
              tweet.author_username = username;
            }
            // Mark author_followers from our known data
            if (!tweet.author_followers && account.followers_count) {
              tweet.author_followers = account.followers_count;
            }
          }

          allResults.push({
            source: 'timeline' as any, // Reuse existing source type
            keyword: `growth_archive_${account.growth_status}`,
            feed_run_id: feedRunId,
            tweets,
          });

          totalArchived++;
          console.log(
            `${LOG_PREFIX} @${username} (${account.growth_status}): ${tweets.length} tweets archived ` +
            `(${account.followers_count} followers)`
          );
        }

        // Update last_scraped_at
        await supabase
          .from('brain_accounts')
          .update({ last_scraped_at: new Date().toISOString() })
          .eq('username', username);
      });
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error archiving @${username}: ${err.message}`);
      totalErrors++;
    }
  }

  // Bulk ingest all collected tweets
  if (allResults.length > 0) {
    const ingested = await ingestFeedResults(allResults);
    totalIngested = ingested.total_ingested;
  }

  if (totalArchived > 0) {
    console.log(
      `${LOG_PREFIX} Archived ${totalArchived} accounts, ${totalIngested} tweets ingested, ${totalErrors} errors`
    );
  }

  return {
    accounts_archived: totalArchived,
    tweets_ingested: totalIngested,
    errors: totalErrors,
  };
}

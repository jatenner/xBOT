/**
 * Census Worker
 *
 * Browser-based job that processes the census queue. For each account:
 * 1. Navigate to profile (anonymous)
 * 2. Extract follower count (+ tweets for growing accounts)
 * 3. Store snapshot in brain_account_snapshots
 * 4. Update brain_accounts with latest data
 *
 * Uses the dedicated CensusBrowserPool for parallel scraping.
 *
 * Two modes:
 * - Lightweight: boring/unknown accounts — follower count only (~1.5s)
 * - Full: interesting/hot/explosive — follower count + tweets + replies tab (~5s)
 *
 * Processes up to BATCH_SIZE accounts per cycle using parallel browsers.
 */

import { getSupabaseClient } from '../../db';
import { getBrainPage, brainGoto } from '../feeds/brainNavigator';
import { extractTweetsFromPage, ingestFeedResults } from '../discoveryEngine';
import { censusQueue, getQueuedAccounts, clearQueuedAccount } from './censusScheduler';
import { getFollowerRange } from '../types';
import { lightweightCensusCheck, processLightweightResult } from './lightweightCensus';
import { runCensusBatch } from './censusBrowserPool';

const LOG_PREFIX = '[observatory/census-worker]';
const BATCH_SIZE = 100; // Up from 30 — parallel processing handles the load

// Tiered tweet grabbing during census
const TWEETS_PER_CENSUS: Record<string, number> = {
  explosive: 25,
  hot: 25,
  interesting: 15,
  boring: 5,
  unknown: 0,
};

export async function runCensusWorker(): Promise<{ checked: number; errors: number }> {
  // Get accounts from DB-backed queue
  const queuedAccounts = await getQueuedAccounts(BATCH_SIZE);

  // Also drain legacy in-memory queue
  const legacyBatch = censusQueue.splice(0, Math.max(0, BATCH_SIZE - queuedAccounts.length));

  if (queuedAccounts.length === 0 && legacyBatch.length === 0) {
    return { checked: 0, errors: 0 };
  }

  // Merge: DB queue takes priority, legacy fills remaining capacity
  const allAccounts: Array<{ username: string; growth_status: string | null; follower_range: string | null }> = [
    ...queuedAccounts,
    ...legacyBatch.map(u => ({ username: u, growth_status: null as string | null, follower_range: null as string | null })),
  ];

  // Split into lightweight and full census batches
  const lightweightBatch: typeof allAccounts = [];
  const fullBatch: typeof allAccounts = [];

  for (const acct of allAccounts) {
    const status = acct.growth_status ?? 'unknown';
    if (status === 'boring' || status === 'unknown') {
      lightweightBatch.push(acct);
    } else {
      fullBatch.push(acct);
    }
  }

  let totalChecked = 0;
  let totalErrors = 0;

  // Process lightweight batch using census browser pool (parallel)
  if (lightweightBatch.length > 0) {
    const tasks = lightweightBatch.map(acct => ({
      username: acct.username,
      execute: async (page: any) => {
        const result = await lightweightCensusCheck(page, acct.username);
        if (result.success) {
          await processLightweightResult(result);
        }
      },
    }));

    try {
      const { completed, errors } = await runCensusBatch(tasks);
      totalChecked += completed;
      totalErrors += errors;
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Census pool error: ${err.message}`);
      totalErrors += lightweightBatch.length;
    }

    // Clear DB queue flags for lightweight accounts
    for (const acct of lightweightBatch) {
      await clearQueuedAccount(acct.username);
    }
  }

  // Process full census batch sequentially (needs tweet extraction + tab navigation)
  if (fullBatch.length > 0) {
    let page: any;
    try {
      page = await getBrainPage();
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Failed to get browser page for full census: ${err.message}`);
      totalErrors += fullBatch.length;
      return { checked: totalChecked, errors: totalErrors };
    }

    for (const acct of fullBatch) {
      try {
        await runFullCensus(page, acct.username, acct.growth_status);
        totalChecked++;
      } catch (err: any) {
        console.error(`${LOG_PREFIX} Full census error for @${acct.username}: ${err.message}`);
        totalErrors++;
      }

      // Clear DB queue flag
      await clearQueuedAccount(acct.username);
    }

    try { await page.close(); } catch {}
  }

  if (totalChecked > 0 || totalErrors > 0) {
    console.log(
      `${LOG_PREFIX} Census: ${totalChecked} checked (${lightweightBatch.length} lightweight, ${fullBatch.length} full), ` +
      `${totalErrors} errors`
    );
  }

  return { checked: totalChecked, errors: totalErrors };
}

/**
 * Full census: extracts follower count + tweets + replies tab.
 * Used for interesting/hot/explosive accounts.
 */
async function runFullCensus(
  page: any,
  username: string,
  growthStatus: string | null,
): Promise<void> {
  const supabase = getSupabaseClient();
  const profileUrl = `https://x.com/${username}`;

  const nav = await brainGoto(page, profileUrl, 15000);
  if (!nav.success) throw new Error('Navigation failed');

  // Extract follower and following counts
  const metrics = await page.evaluate(`
    (function() {
      var result = { followers: null, following: null, bio: null };

      var links = document.querySelectorAll('a[href*="/followers"], a[href*="/following"], a[href*="/verified_followers"]');
      for (var i = 0; i < links.length; i++) {
        var href = links[i].getAttribute('href') || '';
        var text = links[i].textContent || '';

        var match = text.match(/([\\d.,]+)\\s*([KMB])?/);
        if (!match) continue;

        var num = parseFloat(match[1].replace(/,/g, ''));
        var suffix = (match[2] || '').toUpperCase();
        if (suffix === 'K') num *= 1e3;
        else if (suffix === 'M') num *= 1e6;
        else if (suffix === 'B') num *= 1e9;
        num = Math.round(num);

        if (href.includes('/followers') || href.includes('/verified_followers')) {
          result.followers = num;
        } else if (href.includes('/following')) {
          result.following = num;
        }
      }

      if (result.followers === null) {
        var bodyText = document.body ? document.body.innerText : '';
        var fMatch = bodyText.match(/([\\d.,]+)\\s*([KMB])?\\s*Followers?/i);
        if (fMatch) {
          var fn = parseFloat(fMatch[1].replace(/,/g, ''));
          var fs = (fMatch[2] || '').toUpperCase();
          if (fs === 'K') fn *= 1e3;
          else if (fs === 'M') fn *= 1e6;
          else if (fs === 'B') fn *= 1e9;
          result.followers = Math.round(fn);
        }
      }

      var bioEl = document.querySelector('[data-testid="UserDescription"]');
      if (bioEl) {
        result.bio = (bioEl.textContent || '').trim().substring(0, 500);
      }

      return result;
    })()
  `);

  if (metrics.followers === null) throw new Error('Could not extract followers');

  // Grab tweets based on growth status
  const tweetCount = TWEETS_PER_CENSUS[growthStatus ?? 'unknown'] ?? 5;

  try {
    if (tweetCount > 0) {
      const originals = await extractTweetsFromPage(page, {
        maxTweets: tweetCount,
        skipReplies: false,
      });

      // For hot/explosive accounts, also check the replies tab
      let replyTweets: any[] = [];
      if (growthStatus === 'hot' || growthStatus === 'explosive') {
        try {
          const replyNav = await brainGoto(page, `https://x.com/${username}/with_replies`, 10000);
          if (replyNav.success) {
            try {
              await page.waitForSelector('article[data-testid="tweet"]', { timeout: 5000 });
            } catch {}

            replyTweets = await extractTweetsFromPage(page, {
              maxTweets: tweetCount,
              skipReplies: false,
            });

            for (const t of replyTweets) {
              if (t.author_username?.toLowerCase() === username.toLowerCase() && t.content?.startsWith('@')) {
                (t as any).tweet_type = 'reply';
              }
            }
          }
        } catch {}
      }

      const allTweets = [...originals, ...replyTweets];
      if (allTweets.length > 0) {
        for (const t of allTweets) {
          t.author_username = username;
          if (!t.author_followers) t.author_followers = metrics.followers;
        }

        await ingestFeedResults([{
          source: 'timeline' as any,
          keyword: 'census_timeline',
          feed_run_id: `census_${Date.now()}`,
          tweets: allTweets,
        }]);
      }
    }
  } catch {
    // Non-fatal — follower count is the priority
  }

  // Get previous follower count for delta
  const { data: existing } = await supabase
    .from('brain_accounts')
    .select('followers_count, first_snapshot_at, snapshot_count')
    .eq('username', username)
    .single();

  const prevFollowers = existing?.followers_count ?? null;
  const isFirstSnapshot = !existing?.first_snapshot_at;

  // Insert snapshot
  await supabase.from('brain_account_snapshots').insert({
    username,
    followers_count: metrics.followers,
    following_count: metrics.following,
    bio_text: metrics.bio,
    checked_at: new Date().toISOString(),
  });

  // Update brain_accounts
  const followerRange = getFollowerRange(metrics.followers);
  const updateData: Record<string, any> = {
    followers_count: metrics.followers,
    following_count: metrics.following,
    prev_followers_count: prevFollowers,
    follower_range: followerRange,
    latest_snapshot_at: new Date().toISOString(),
    last_census_at: new Date().toISOString(),
    census_queued_at: null,
    snapshot_count: (existing?.snapshot_count ?? 0) + 1,
    updated_at: new Date().toISOString(),
  };

  if (isFirstSnapshot) {
    updateData.first_snapshot_at = new Date().toISOString();
    updateData.follower_range_at_first_snapshot = followerRange;
  }

  if (metrics.bio) {
    updateData.bio_text = metrics.bio;
  }

  if (metrics.followers && metrics.following && metrics.following > 0) {
    updateData.ff_ratio = Math.round((metrics.followers / metrics.following) * 100) / 100;
  }

  await supabase
    .from('brain_accounts')
    .update(updateData)
    .eq('username', username);
}

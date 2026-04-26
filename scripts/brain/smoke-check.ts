/**
 * Brain pipeline smoke check (manual, post-deploy).
 *
 * Runs the algorithmically meaningful parts of the brain pipeline
 * end-to-end against a small set of accounts and asserts that the new
 * algo-signal columns get populated within their expected windows.
 *
 * Usage:
 *   pnpm smoke:brain
 *
 * Prints a structured report and exits 0 on green, 1 on any check failed.
 *
 * NOT for CI — total runtime is ~65 minutes (waits for the +60m velocity
 * window to fire). Run it manually after a staging deploy when you want
 * proof the pipeline is alive.
 */

import { getSupabaseClient } from '../../src/db/index';

const TAG = '[smoke:brain]';

const POLL_INTERVAL_MS = 30_000;
const TOTAL_TIMEOUT_MS = 65 * 60 * 1000;

// Accounts to seed. Manually maintained — pick recently-active accounts you
// know will produce fresh tweets within the 90-min freshness window.
const SMOKE_ACCOUNTS = (process.env.BRAIN_SMOKE_ACCOUNTS || 'naval,paulg,levelsio').split(',');

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

const results: CheckResult[] = [];

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  console.log(`${TAG} starting smoke check on accounts: ${SMOKE_ACCOUNTS.join(', ')}`);

  // ── Step 1: scrape these accounts ──
  const { runAccountTimelineScraper } = await import('../../src/brain/feeds/accountTimelineScraper');

  // We force-prioritize these accounts by upserting them with stale scrape
  // status so the next scraper run picks them up.
  for (const username of SMOKE_ACCOUNTS) {
    await supabase
      .from('brain_accounts')
      .upsert({
        username: username.trim(),
        scrape_priority: 1.0,
        last_scraped_at: null,
        is_active: true,
        discovery_method: 'manual',
      }, { onConflict: 'username' });
  }

  const scrapeResult = await runAccountTimelineScraper();
  results.push({
    name: 'timeline scraper produced tweets',
    passed: scrapeResult.tweets_ingested > 0,
    detail: `tweets_ingested=${scrapeResult.tweets_ingested} accounts_scraped=${scrapeResult.accounts_scraped}`,
  });

  // ── Step 2: pick 5 freshly-ingested tweets to track ──
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data: freshTweets } = await supabase
    .from('brain_tweets')
    .select('tweet_id, author_username, posted_at, author_followers_at_post_time, parent_engagement_at_post_time, tweet_type')
    .in('author_username', SMOKE_ACCOUNTS.map(s => s.trim().toLowerCase()))
    .gte('scraped_at', fiveMinutesAgo)
    .not('posted_at', 'is', null)
    .order('scraped_at', { ascending: false })
    .limit(5);

  if (!freshTweets || freshTweets.length === 0) {
    results.push({
      name: '5 fresh tweets selected for tracking',
      passed: false,
      detail: 'no fresh tweets after scrape — pipeline may be broken',
    });
    return finalize();
  }

  results.push({
    name: '5 fresh tweets selected for tracking',
    passed: true,
    detail: `${freshTweets.length} tweets selected`,
  });

  // ── Step 3: causal columns populated at first scrape ──
  const causalOk = freshTweets.every((t: any) => t.author_followers_at_post_time != null);
  results.push({
    name: 'author_followers_at_post_time populated on new tweets',
    passed: causalOk,
    detail: causalOk
      ? `${freshTweets.length}/${freshTweets.length} tweets carry causal followers`
      : `${freshTweets.filter((t: any) => t.author_followers_at_post_time != null).length}/${freshTweets.length} populated`,
  });

  // For replies, parent_engagement_at_post_time should be populated WHEN the
  // parent is in our DB (won't always be).
  const replies = freshTweets.filter((t: any) => t.tweet_type === 'reply');
  if (replies.length > 0) {
    const populated = replies.filter((r: any) => r.parent_engagement_at_post_time != null).length;
    results.push({
      name: 'parent_engagement_at_post_time populated on replies (if parent known)',
      passed: true, // soft check — parent may not be in our DB
      detail: `${populated}/${replies.length} reply rows had known parents`,
    });
  }

  // ── Step 4: poll until velocity_5m / velocity_15m / velocity_60m populate ──
  const tweetIds = freshTweets.map((t: any) => t.tweet_id);
  const startedAt = Date.now();
  const seen = { v5: false, v15: false, v60: false };

  console.log(`${TAG} polling for velocity bucket population (max ${TOTAL_TIMEOUT_MS / 60_000}min)...`);
  while (Date.now() - startedAt < TOTAL_TIMEOUT_MS) {
    const { data: tracked } = await supabase
      .from('brain_tweets')
      .select('tweet_id, velocity_5m, velocity_15m, velocity_60m')
      .in('tweet_id', tweetIds);

    if (tracked) {
      const has5 = tracked.some((t: any) => t.velocity_5m != null);
      const has15 = tracked.some((t: any) => t.velocity_15m != null);
      const has60 = tracked.some((t: any) => t.velocity_60m != null);
      if (has5 && !seen.v5) {
        seen.v5 = true;
        console.log(`${TAG} velocity_5m populated at +${Math.round((Date.now() - startedAt) / 60_000)}min`);
      }
      if (has15 && !seen.v15) {
        seen.v15 = true;
        console.log(`${TAG} velocity_15m populated at +${Math.round((Date.now() - startedAt) / 60_000)}min`);
      }
      if (has60 && !seen.v60) {
        seen.v60 = true;
        console.log(`${TAG} velocity_60m populated at +${Math.round((Date.now() - startedAt) / 60_000)}min`);
        break;
      }
    }

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }

  results.push({ name: 'velocity_5m populated within window',  passed: seen.v5,  detail: seen.v5  ? 'yes' : 'NEVER POPULATED' });
  results.push({ name: 'velocity_15m populated within window', passed: seen.v15, detail: seen.v15 ? 'yes' : 'NEVER POPULATED' });
  results.push({ name: 'velocity_60m populated within window', passed: seen.v60, detail: seen.v60 ? 'yes' : 'NEVER POPULATED' });

  // ── Step 5: reply-author engagement checker run ──
  try {
    const { runReplyAuthorEngagementChecker } = await import('../../src/brain/observatory/replyAuthorEngagementChecker');
    const checkResult = await runReplyAuthorEngagementChecker();
    results.push({
      name: 'reply-author checker ran',
      passed: true,
      detail: `parents=${checkResult.parents_processed} rows_updated=${checkResult.rows_updated} errors=${checkResult.errors}`,
    });
  } catch (err: any) {
    results.push({
      name: 'reply-author checker ran',
      passed: false,
      detail: `threw: ${err.message}`,
    });
  }

  // ── Step 6: data_health view returns brain metrics ──
  const { data: health, error: healthErr } = await supabase
    .from('data_health')
    .select('brain_tweets_ingested_24h, external_patterns_brain_source_count, velocity_5m_populated_ratio, velocity_15m_populated_ratio, velocity_60m_populated_ratio, pending_velocity_queue_depth, reply_author_check_coverage_24h')
    .single();

  if (healthErr || !health) {
    results.push({ name: 'data_health view extension', passed: false, detail: `view error: ${healthErr?.message}` });
  } else {
    const h: any = health;
    results.push({
      name: 'data_health view returns brain columns',
      passed: h.brain_tweets_ingested_24h != null,
      detail: `ingested_24h=${h.brain_tweets_ingested_24h} brain_patterns=${h.external_patterns_brain_source_count} ` +
              `vel5_ratio=${h.velocity_5m_populated_ratio} queue_depth=${h.pending_velocity_queue_depth}`,
    });
  }

  finalize();
}

function finalize(): void {
  console.log('\n' + '='.repeat(70));
  console.log(`${TAG} smoke check report`);
  console.log('='.repeat(70));
  for (const r of results) {
    const icon = r.passed ? 'OK ' : 'FAIL';
    console.log(`[${icon}] ${r.name}`);
    console.log(`       ${r.detail}`);
  }
  console.log('='.repeat(70));
  const failures = results.filter(r => !r.passed).length;
  console.log(`${results.length - failures}/${results.length} checks passed`);
  process.exit(failures > 0 ? 1 : 0);
}

main().catch(err => {
  console.error(`${TAG} fatal: ${err.stack || err.message}`);
  process.exit(2);
});

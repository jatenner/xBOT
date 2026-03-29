/**
 * One-shot controlled metrics scrape for a single known post.
 * Forces RUNNER_MODE and runs the real scraper path for one CONTROLLED_DECISION_ID or CONTROLLED_TWEET_ID.
 *
 * Usage:
 *   CONTROLLED_DECISION_ID=<uuid> RUNNER_MODE=true pnpm tsx scripts/ops/controlled-metrics-once.ts
 *   CONTROLLED_TWEET_ID=<tweet_id> RUNNER_MODE=true pnpm tsx scripts/ops/controlled-metrics-once.ts
 *
 * Requires: CONTROLLED_DECISION_ID or CONTROLLED_TWEET_ID; RUNNER_MODE=true.
 */

import './load-env';
import { getSupabaseClient } from '../../src/db/index';
import { metricsScraperJob } from '../../src/jobs/metricsScraperJob';

const PREFIX = '[CONTROLLED_METRICS]';

function enforceEnv(): void {
  process.env.RUNNER_MODE = 'true';
  const decisionId = process.env.CONTROLLED_DECISION_ID?.trim();
  const tweetId = process.env.CONTROLLED_TWEET_ID?.trim();
  if (!decisionId && !tweetId) {
    console.error(`${PREFIX} ❌ Set CONTROLLED_DECISION_ID or CONTROLLED_TWEET_ID.`);
    process.exit(1);
  }
  if (process.env.RUNNER_MODE !== 'true') {
    console.error(`${PREFIX} ❌ RUNNER_MODE=true required for local scraper.`);
    process.exit(1);
  }
}

async function resolveTarget(): Promise<{ decision_id: string; tweet_id: string } | null> {
  const supabase = getSupabaseClient();
  const decisionId = process.env.CONTROLLED_DECISION_ID?.trim();
  const tweetId = process.env.CONTROLLED_TWEET_ID?.trim();
  if (decisionId) {
    const { data, error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, tweet_id')
      .eq('decision_id', decisionId)
      .eq('status', 'posted')
      .not('tweet_id', 'is', null)
      .in('decision_type', ['single', 'thread'])
      .maybeSingle();
    if (error || !data) return null;
    return { decision_id: data.decision_id, tweet_id: String(data.tweet_id) };
  }
  if (tweetId) {
    const { data, error } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, tweet_id')
      .eq('tweet_id', tweetId)
      .eq('status', 'posted')
      .in('decision_type', ['single', 'thread'])
      .maybeSingle();
    if (error || !data) return null;
    return { decision_id: data.decision_id, tweet_id: String(data.tweet_id) };
  }
  return null;
}

async function getMetricsRow(decisionId: string): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('actual_impressions, actual_likes, actual_retweets, actual_replies, actual_engagement_rate, updated_at')
    .eq('decision_id', decisionId)
    .maybeSingle();
  return data as Record<string, unknown> | null;
}

async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔒 CONTROLLED METRICS — ONE-SHOT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  enforceEnv();
  const decisionId = process.env.CONTROLLED_DECISION_ID?.trim();
  const tweetId = process.env.CONTROLLED_TWEET_ID?.trim();

  const target = await resolveTarget();
  if (!target) {
    console.error(`${PREFIX} ❌ No posted post found for CONTROLLED_DECISION_ID/CONTROLLED_TWEET_ID.`);
    process.exit(1);
  }

  const runnerMode = process.env.RUNNER_MODE ?? 'undefined';
  const localRunner = process.env.RUNNER_MODE === 'true';
  console.log(`${PREFIX} proof_preflight decision_id=${target.decision_id} tweet_id=${target.tweet_id} RUNNER_MODE=${runnerMode} local_runner=${localRunner}`);
  console.log('');

  const before = await getMetricsRow(target.decision_id);

  await metricsScraperJob();

  const after = await getMetricsRow(target.decision_id);

  const hasImpressions = after?.actual_impressions != null;
  const hasLikes = after?.actual_likes != null;
  const hasRetweets = after?.actual_retweets != null;
  const hasReplies = after?.actual_replies != null;
  const hasEr = after?.actual_engagement_rate != null;
  const fieldsUpdated = [
    hasImpressions && 'actual_impressions',
    hasLikes && 'actual_likes',
    hasRetweets && 'actual_retweets',
    hasReplies && 'actual_replies',
    hasEr && 'actual_engagement_rate',
  ].filter(Boolean) as string[];

  const scrapedSuccess = fieldsUpdated.length > 0;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📋 PROOF SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   selected=1`);
  console.log(`   scraped=${scrapedSuccess ? 'success' : 'fail'}`);
  console.log(`   fields_updated=${fieldsUpdated.length ? fieldsUpdated.join(',') : 'none'}`);
  if (after) {
    console.log(`   actual_impressions=${after.actual_impressions ?? 'null'}`);
    console.log(`   actual_likes=${after.actual_likes ?? 'null'}`);
    console.log(`   actual_retweets=${after.actual_retweets ?? 'null'}`);
    console.log(`   actual_replies=${after.actual_replies ?? 'null'}`);
    console.log(`   actual_engagement_rate=${after.actual_engagement_rate ?? 'null'}`);
    console.log(`   updated_at=${(after.updated_at as string) ?? 'null'}`);
  } else {
    console.log(`   (no row read back for decision_id)`);
  }
  console.log('═══════════════════════════════════════════════════════════════════════');

  process.exit(0);
}

run().catch((err) => {
  console.error(`${PREFIX} Fatal:`, err?.message || err);
  process.exit(1);
});

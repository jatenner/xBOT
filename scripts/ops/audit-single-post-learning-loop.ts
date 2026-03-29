/**
 * Audit: Post-performance and learning loop for a single proven original post.
 * Traces decision_id + tweet_id through: performance snapshot scheduling,
 * metrics scraping (outcomes, learning_posts, content_metadata), learnJob inputs.
 * Evidence-based; no thread posting.
 *
 * Usage: CONTROLLED_DECISION_ID=<uuid> CONTROLLED_TWEET_ID=<tweet_id> pnpm tsx scripts/ops/audit-single-post-learning-loop.ts
 * Example: CONTROLLED_DECISION_ID=b6097cba-7c50-4935-9138-8392745d4c86 CONTROLLED_TWEET_ID=2034024426652434887 pnpm tsx scripts/ops/audit-single-post-learning-loop.ts
 */

import '../load-local-env';
import { getSupabaseClient } from '../../src/db/index';

const DECISION_ID = process.env.CONTROLLED_DECISION_ID?.trim() || 'b6097cba-7c50-4935-9138-8392745d4c86';
const TWEET_ID = process.env.CONTROLLED_TWEET_ID?.trim() || '2034024426652434887';

async function main() {
  const supabase = getSupabaseClient();
  const out: {
    content_metadata: any;
    outcomes: any[];
    learning_posts: any;
    tweet_metrics: any[];
    performance_snapshot_scheduled_events: any[];
    performance_snapshots: any[];
    metrics_scrape_proven: boolean;
    learning_update_proven: boolean;
    tables_rows: string[];
    blockers: string[];
  } = {
    content_metadata: null,
    outcomes: [],
    learning_posts: null,
    tweet_metrics: [],
    performance_snapshot_scheduled_events: [],
    performance_snapshots: [],
    metrics_scrape_proven: false,
    learning_update_proven: false,
    tables_rows: [],
    blockers: [],
  };

  console.log('[AUDIT] Tracing decision_id=%s tweet_id=%s\n', DECISION_ID, TWEET_ID);

  // 1) content_metadata then base table (dashboard + metrics job writes to base)
  let cm: any = null;
  const { data: cmData, error: eCm } = await supabase
    .from('content_metadata')
    .select('decision_id, tweet_id, status, decision_type, posted_at, updated_at, actual_impressions, actual_likes, actual_retweets, actual_replies, actual_engagement_rate')
    .eq('decision_id', DECISION_ID)
    .maybeSingle();
  if (eCm) {
    out.blockers.push(`content_metadata read error: ${eCm.message}`);
  } else {
    cm = cmData || null;
  }
  if (!cm) {
    const { data: baseData, error: eBase } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, tweet_id, status, decision_type, posted_at, updated_at, actual_impressions, actual_likes, actual_retweets, actual_replies, actual_engagement_rate')
      .eq('decision_id', DECISION_ID)
      .maybeSingle();
    if (!eBase && baseData) cm = baseData;
  }
  out.content_metadata = cm;
  if (cm) out.tables_rows.push(`content_metadata/base: 1 row (decision_id=${DECISION_ID})`);

  // 2) outcomes (learnJob reads; metricsScraperJob upserts by decision_id)
  const { data: outcomes, error: eOut } = await supabase
    .from('outcomes')
    .select('decision_id, tweet_id, likes, retweets, replies, impressions, views, engagement_rate, collected_at, data_source, simulated')
    .eq('decision_id', DECISION_ID)
    .order('collected_at', { ascending: false });
  if (eOut) {
    out.blockers.push(`outcomes read error: ${eOut.message}`);
  } else {
    out.outcomes = outcomes || [];
    if ((outcomes || []).length > 0) out.tables_rows.push(`outcomes: ${outcomes!.length} row(s)`);
  }

  // 3) learning_posts (tweet_id key; metricsScraperJob upserts)
  const { data: lp, error: eLp } = await supabase
    .from('learning_posts')
    .select('tweet_id, likes_count, retweets_count, replies_count, impressions_count, updated_at')
    .eq('tweet_id', TWEET_ID)
    .maybeSingle();
  if (eLp) {
    out.blockers.push(`learning_posts read error: ${eLp.message}`);
  } else {
    out.learning_posts = lp || null;
    if (lp) out.tables_rows.push(`learning_posts: 1 row (tweet_id=${TWEET_ID})`);
  }

  // 4) tweet_metrics (timing/quantity optimizers)
  const { data: tm, error: eTm } = await supabase
    .from('tweet_metrics')
    .select('tweet_id, likes_count, retweets_count, replies_count, impressions_count, updated_at, created_at')
    .eq('tweet_id', TWEET_ID)
    .order('updated_at', { ascending: false });
  if (eTm) {
    out.blockers.push(`tweet_metrics read error: ${eTm.message}`);
  } else {
    out.tweet_metrics = tm || [];
    if ((tm || []).length > 0) out.tables_rows.push(`tweet_metrics: ${tm!.length} row(s)`);
  }

  // 5) system_events: PERFORMANCE_SNAPSHOT_SCHEDULED (enqueued on post success)
  const { data: eventsRaw, error: eEv } = await supabase
    .from('system_events')
    .select('id, event_type, event_data, created_at')
    .eq('event_type', 'PERFORMANCE_SNAPSHOT_SCHEDULED')
    .limit(50);
  const events = (eventsRaw || []).filter((e: any) => {
    if (!e.event_data) return false;
    const data = typeof e.event_data === 'string' ? (() => { try { return JSON.parse(e.event_data); } catch { return {}; } })() : e.event_data;
    return data.decision_id === DECISION_ID;
  });
  if (eEv) {
    out.blockers.push(`system_events read error: ${eEv.message}`);
  } else {
    out.performance_snapshot_scheduled_events = events;
    if (events.length > 0) out.tables_rows.push(`system_events (PERFORMANCE_SNAPSHOT_SCHEDULED): ${events.length} row(s)`);
  }

  // 6) performance_snapshots (filled by performanceSnapshotJob when it runs; table may not exist in all envs)
  const { data: snaps, error: eSnap } = await supabase
    .from('performance_snapshots')
    .select('decision_id, tweet_id, horizon_minutes, impressions, likes, collected_at, source')
    .eq('decision_id', DECISION_ID)
    .order('horizon_minutes', { ascending: true });
  if (eSnap) {
    if (eSnap.message?.includes('does not exist')) out.blockers.push('performance_snapshots table does not exist (migration not applied).');
    else out.blockers.push(`performance_snapshots read error: ${eSnap.message}`);
  } else {
    out.performance_snapshots = snaps || [];
    if ((snaps || []).length > 0) out.tables_rows.push(`performance_snapshots: ${snaps!.length} row(s)`);
  }

  // Determine metrics_scrape_proven: content_metadata has actual_* OR outcomes has row with collected_at
  const hasActualMetrics = out.content_metadata && (
    (out.content_metadata.actual_impressions != null && out.content_metadata.actual_impressions > 0) ||
    (out.content_metadata.actual_likes != null) ||
    (out.content_metadata.actual_retweets != null)
  );
  const hasOutcomeRow = out.outcomes.length > 0 && out.outcomes.some((o: any) => o.collected_at);
  out.metrics_scrape_proven = !!(hasActualMetrics || hasOutcomeRow);

  // learning_update_proven: learnJob reads outcomes; if outcomes has row, learning *can* use it. Bandit arms update requires runLearningCycle.
  out.learning_update_proven = out.outcomes.length > 0;

  // Blockers
  if (!out.metrics_scrape_proven) out.blockers.push('No metrics in content_metadata or outcomes for this decision.');
  if (!out.learning_posts && out.metrics_scrape_proven) out.blockers.push('learning_posts missing for tweet_id (metrics job may not have written it).');
  if (out.performance_snapshot_scheduled_events.length === 0) out.blockers.push('No PERFORMANCE_SNAPSHOT_SCHEDULED event (enqueue may have failed or not run).');
  if (out.performance_snapshots.length === 0 && out.performance_snapshot_scheduled_events.length > 0 && !out.blockers.some(b => b.includes('does not exist'))) {
    out.blockers.push('performance_snapshots empty but events exist: performance snapshot job not scheduled in jobManager (only reply_performance_snapshot is).');
  }

  // Print evidence
  console.log('--- content_metadata ---');
  console.log(JSON.stringify(out.content_metadata, null, 2));
  console.log('\n--- outcomes ---');
  console.log(JSON.stringify(out.outcomes, null, 2));
  console.log('\n--- learning_posts ---');
  console.log(JSON.stringify(out.learning_posts, null, 2));
  console.log('\n--- tweet_metrics (count) ---');
  console.log(out.tweet_metrics.length);
  if (out.tweet_metrics.length > 0) console.log(JSON.stringify(out.tweet_metrics[0], null, 2));
  console.log('\n--- performance_snapshot_scheduled_events (count) ---');
  console.log(out.performance_snapshot_scheduled_events.length);
  if (out.performance_snapshot_scheduled_events.length > 0) console.log(JSON.stringify(out.performance_snapshot_scheduled_events[0], null, 2));
  console.log('\n--- performance_snapshots ---');
  console.log(JSON.stringify(out.performance_snapshots, null, 2));

  console.log('\n========== SUMMARY ==========');
  console.log('metrics_scrape_proven:', out.metrics_scrape_proven);
  console.log('learning_update_proven:', out.learning_update_proven);
  console.log('tables/rows:', out.tables_rows.join(', '));
  console.log('blockers:', out.blockers.length ? out.blockers : ['none']);
  console.log('============================\n');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

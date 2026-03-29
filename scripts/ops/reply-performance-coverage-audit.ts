#!/usr/bin/env tsx
/**
 * Reply Performance Learning V1 — coverage audit.
 * Measures real-world coverage of reply performance data for operational reliability.
 *
 * Usage: pnpm exec tsx scripts/ops/reply-performance-coverage-audit.ts
 *
 * Output: total events, snapshots by checkpoint and scrape_status, % with impressions,
 * % with engagement fields, % of live replies with ≥1 usable snapshot, % with usable 24h,
 * % of live replies whose tweet_id appears in content_metadata, and source breakdown
 * (content_metadata_or_outcomes vs scrape_fallback) for fallback vs non-fallback comparison.
 */

import path from 'path';
import fs from 'fs';
const envPath = path.join(process.cwd(), '.env');
const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) require('dotenv').config({ path: envLocal });
else if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });

async function main() {
  const { getSupabaseClient } = await import('../../src/db/index');
  const supabase = getSupabaseClient();

  const out: string[] = [];
  const p = (s: string) => {
    out.push(s);
    console.log(s);
  };

  p('=== Reply Performance Learning V1 — Coverage Audit ===');
  p(`Run at: ${new Date().toISOString()}\n`);

  // 1. Total live reply_execution_events
  const { count: eventsTotal, error: e1 } = await supabase
    .from('reply_execution_events')
    .select('*', { count: 'exact', head: true })
    .eq('dry_run', false);
  const totalEvents = e1 ? 0 : (eventsTotal ?? 0);
  p(`1. Total live reply_execution_events: ${totalEvents}`);

  // 2. Total reply_performance_snapshots
  const { count: snapTotal, error: e2 } = await supabase
    .from('reply_performance_snapshots')
    .select('*', { count: 'exact', head: true });
  const totalSnapshots = e2 ? 0 : (snapTotal ?? 0);
  p(`2. Total reply_performance_snapshots: ${totalSnapshots}`);

  // 3. Snapshot counts by checkpoint
  const { data: byCheckpoint } = await supabase
    .from('reply_performance_snapshots')
    .select('minutes_since_post');
  const checkpointCounts: Record<number, number> = { 30: 0, 120: 0, 1440: 0, 4320: 0 };
  for (const r of byCheckpoint || []) {
    const m = (r as any).minutes_since_post;
    if (m != null && checkpointCounts[m] !== undefined) checkpointCounts[m]++;
  }
  p(`3. Snapshots by checkpoint: 30m=${checkpointCounts[30]} 2h=${checkpointCounts[120]} 24h=${checkpointCounts[1440]} 72h=${checkpointCounts[4320]}`);

  // 4. Snapshot counts by scrape_status
  const { data: byStatus } = await supabase
    .from('reply_performance_snapshots')
    .select('scrape_status');
  const statusCounts: Record<string, number> = {};
  for (const r of byStatus || []) {
    const s = (r as any).scrape_status || 'null';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  }
  p(`4. Snapshots by scrape_status: ${JSON.stringify(statusCounts)}`);

  // 5. Count and % with impressions
  const { data: withImpressions } = await supabase
    .from('reply_performance_snapshots')
    .select('id')
    .not('impressions', 'is', null)
    .gt('impressions', 0);
  const countWithImpressions = withImpressions?.length ?? 0;
  const pctImpressions = totalSnapshots ? ((countWithImpressions / totalSnapshots) * 100).toFixed(1) : '0';
  p(`5. With impressions (non-null and >0): ${countWithImpressions} (${pctImpressions}% of snapshots)`);

  // 6. Count and % with likes/replies/reposts/bookmarks (at least one)
  const { data: allSnap } = await supabase
    .from('reply_performance_snapshots')
    .select('likes, replies, reposts, bookmarks');
  let withEngagement = 0;
  for (const r of allSnap || []) {
    const a = r as any;
    if (a.likes != null || a.replies != null || a.reposts != null || a.bookmarks != null) withEngagement++;
  }
  const pctEngagement = totalSnapshots ? ((withEngagement / totalSnapshots) * 100).toFixed(1) : '0';
  p(`6. With at least one of likes/replies/reposts/bookmarks: ${withEngagement} (${pctEngagement}% of snapshots)`);

  // 7. Live replies with at least one usable snapshot (ok or partial, or any metric present)
  const { data: eventsList } = await supabase
    .from('reply_execution_events')
    .select('id')
    .eq('dry_run', false);
  const eventIds = new Set((eventsList || []).map((e: any) => e.id));
  const { data: snapEvents } = await supabase
    .from('reply_performance_snapshots')
    .select('reply_execution_event_id, scrape_status, impressions, likes, replies, reposts');
  const eventsWithUsable = new Set<string>();
  for (const r of snapEvents || []) {
    const a = r as any;
    const usable = a.scrape_status === 'ok' || a.scrape_status === 'partial' ||
      a.impressions != null || a.likes != null || a.replies != null || a.reposts != null;
    if (usable && eventIds.has(a.reply_execution_event_id)) eventsWithUsable.add(a.reply_execution_event_id);
  }
  const countWithUsable = eventsWithUsable.size;
  const pctUsable = totalEvents ? ((countWithUsable / totalEvents) * 100).toFixed(1) : '0';
  p(`7. Live replies with ≥1 usable snapshot: ${countWithUsable} of ${totalEvents} (${pctUsable}%)`);

  // 8. Live replies with a usable 24h snapshot
  const { data: snap24 } = await supabase
    .from('reply_performance_snapshots')
    .select('reply_execution_event_id, scrape_status, impressions, likes, replies, reposts')
    .eq('minutes_since_post', 1440);
  const eventsWith24h = new Set<string>();
  for (const r of snap24 || []) {
    const a = r as any;
    const usable = a.scrape_status === 'ok' || a.scrape_status === 'partial' ||
      a.impressions != null || a.likes != null || a.replies != null || a.reposts != null;
    if (usable && eventIds.has(a.reply_execution_event_id)) eventsWith24h.add(a.reply_execution_event_id);
  }
  const countWith24h = eventsWith24h.size;
  const pct24h = totalEvents ? ((countWith24h / totalEvents) * 100).toFixed(1) : '0';
  p(`8. Live replies with usable 24h snapshot: ${countWith24h} of ${totalEvents} (${pct24h}%)`);

  // 9. Live replies whose tweet_id appears in content_metadata (reply)
  const { data: eventTweetIds } = await supabase
    .from('reply_execution_events')
    .select('our_reply_tweet_id')
    .eq('dry_run', false);
  const tweetIds = [...new Set((eventTweetIds || []).map((e: any) => e.our_reply_tweet_id).filter(Boolean))];
  let inContentMetadata = 0;
  if (tweetIds.length > 0) {
    const { data: cmRows } = await supabase
      .from('content_metadata')
      .select('tweet_id')
      .eq('decision_type', 'reply')
      .in('tweet_id', tweetIds);
    inContentMetadata = new Set((cmRows || []).map((r: any) => r.tweet_id)).size;
  }
  const pctInCm = totalEvents ? ((inContentMetadata / totalEvents) * 100).toFixed(1) : '0';
  p(`9. Live replies whose tweet_id in content_metadata (reply): ${inContentMetadata} of ${totalEvents} (${pctInCm}%)`);

  // 10. Source breakdown (fallback vs non-fallback)
  const { data: sources } = await supabase
    .from('reply_performance_snapshots')
    .select('raw_metrics_json');
  const sourceCounts: Record<string, number> = {};
  for (const r of sources || []) {
    const raw = (r as any).raw_metrics_json;
    const src = raw && typeof raw === 'object' && 'source' in raw ? String((raw as any).source) : 'unknown';
    sourceCounts[src] = (sourceCounts[src] || 0) + 1;
  }
  p(`10. Snapshot source (raw_metrics_json.source): ${JSON.stringify(sourceCounts)}`);
  p('    → Compare scrape_fallback vs content_metadata_or_outcomes to see fallback impact.\n');

  p('=== End of coverage audit ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

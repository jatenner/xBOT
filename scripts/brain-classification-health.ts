#!/usr/bin/env tsx
/**
 * Brain Classification Health — reports backlog, throughput, and catch-up ETA.
 *
 * Unclassified tweet = row in `brain_tweets` without a corresponding row in
 * `brain_classifications` (joined on tweet_id). Stage 2 classifies at ~200/run
 * every 15m = ~19.2K/day theoretical max. If ingest rate exceeds that, the
 * backlog grows unboundedly — we want early warning.
 *
 * Run: `tsx scripts/brain-classification-health.ts`
 * Emits human-readable summary + JSON line for dashboarding.
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function countRows(table: string, filter: (q: any) => any): Promise<number> {
  const { count, error } = await filter(
    supabase.from(table).select('*', { count: 'exact', head: true }),
  );
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function main(): Promise<void> {
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const [
    totalTweets,
    tweetsLast24h,
    tweetsLastHour,
    totalClassified,
    classifiedLast24h,
    classifiedLastHour,
  ] = await Promise.all([
    countRows('brain_tweets', q => q),
    countRows('brain_tweets', q => q.gte('scraped_at', dayAgo)),
    countRows('brain_tweets', q => q.gte('scraped_at', hourAgo)),
    countRows('brain_classifications', q => q),
    countRows('brain_classifications', q => q.gte('classified_at', dayAgo)),
    countRows('brain_classifications', q => q.gte('classified_at', hourAgo)),
  ]);

  const backlog = Math.max(0, totalTweets - totalClassified);
  const coveragePct = totalTweets === 0 ? 0 : (totalClassified / totalTweets) * 100;

  // Classification capacity: current rate vs ingest rate
  const ingestRatePerHour = tweetsLastHour;
  const classifyRatePerHour = classifiedLastHour;
  const netBacklogChangePerHour = ingestRatePerHour - classifyRatePerHour;

  // Catch-up ETA — only meaningful when classify rate > ingest rate
  let catchUpDays: number | null = null;
  if (classifyRatePerHour > ingestRatePerHour && classifyRatePerHour > 0) {
    const netClearedPerHour = classifyRatePerHour - ingestRatePerHour;
    catchUpDays = backlog / (netClearedPerHour * 24);
  }

  // Summary
  console.log('┌─ Brain Classification Health ──────────────────────────');
  console.log(`│ Total tweets:        ${totalTweets.toLocaleString()}`);
  console.log(`│ Total classified:    ${totalClassified.toLocaleString()}`);
  console.log(`│ Backlog:             ${backlog.toLocaleString()} (${(100 - coveragePct).toFixed(1)}% unclassified)`);
  console.log(`│ Coverage:            ${coveragePct.toFixed(1)}%`);
  console.log('├─ Last 24h ────────────────────────────────────────────');
  console.log(`│ Tweets ingested:     ${tweetsLast24h.toLocaleString()}`);
  console.log(`│ Tweets classified:   ${classifiedLast24h.toLocaleString()}`);
  console.log(`│ Net backlog change:  ${(tweetsLast24h - classifiedLast24h >= 0 ? '+' : '')}${(tweetsLast24h - classifiedLast24h).toLocaleString()}`);
  console.log('├─ Last hour ───────────────────────────────────────────');
  console.log(`│ Ingest rate:         ${ingestRatePerHour}/hr`);
  console.log(`│ Classify rate:       ${classifyRatePerHour}/hr`);
  console.log(`│ Net:                 ${netBacklogChangePerHour >= 0 ? '+' : ''}${netBacklogChangePerHour}/hr`);

  if (catchUpDays !== null) {
    console.log(`│ Catch-up ETA:        ${catchUpDays.toFixed(1)} days (at current rates)`);
  } else if (netBacklogChangePerHour > 0) {
    console.log('│ Catch-up ETA:        NEVER — backlog is growing. Raise Stage 2 budget.');
  } else {
    console.log('│ Catch-up ETA:        caught up or idle');
  }

  console.log('└────────────────────────────────────────────────────────');

  // Recommendation
  const capacityPerDay = 200 * (24 * 60 / 15); // 200/run * 96 runs/day = 19200
  const backlogDaysAtCapacity = backlog / capacityPerDay;
  if (backlogDaysAtCapacity > 3) {
    console.log(`\n⚠  Backlog = ${backlogDaysAtCapacity.toFixed(1)} days at theoretical capacity (19.2K/day).`);
    console.log('   Recommendation: raise Stage 2 to 400 tweets/run OR cadence to 10min.');
  } else if (netBacklogChangePerHour > 50) {
    console.log(`\n⚠  Backlog growing +${netBacklogChangePerHour}/hr — ingest outpacing classification.`);
    console.log('   Recommendation: monitor for next hour; raise budget if trend persists.');
  } else {
    console.log('\n✓ Classification throughput is keeping up.');
  }

  // JSON line for dashboards
  const payload = {
    ts: new Date().toISOString(),
    total_tweets: totalTweets,
    total_classified: totalClassified,
    backlog,
    coverage_pct: Number(coveragePct.toFixed(2)),
    tweets_last_24h: tweetsLast24h,
    classified_last_24h: classifiedLast24h,
    ingest_rate_per_hour: ingestRatePerHour,
    classify_rate_per_hour: classifyRatePerHour,
    catch_up_days: catchUpDays,
    backlog_days_at_capacity: Number(backlogDaysAtCapacity.toFixed(2)),
  };
  console.log('\nJSON:', JSON.stringify(payload));
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

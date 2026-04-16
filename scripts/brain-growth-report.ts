#!/usr/bin/env tsx
/**
 * Brain Growth Report — what does the current data say about how accounts grow?
 *
 * Pulls from: brain_accounts, brain_tweets, brain_classifications, brain_growth_events,
 * brain_stage_transitions, brain_growth_playbooks (if populated), external_reply_patterns.
 *
 * Surfaces the actual signal the system has accumulated, stratified by account tier.
 */

import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const c = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();

  const sep = (t: string) => console.log(`\n══ ${t} ${'═'.repeat(Math.max(0, 74 - t.length))}`);

  // ── 1. Universe size & recency ──────────────────────────────────────
  sep('UNIVERSE');
  const univ = await c.query(`
    SELECT
      (SELECT count(*) FROM brain_accounts) AS accounts,
      (SELECT count(*) FROM brain_accounts WHERE growth_status='explosive') AS explosive,
      (SELECT count(*) FROM brain_accounts WHERE growth_status='hot') AS hot,
      (SELECT count(*) FROM brain_accounts WHERE growth_status='interesting') AS interesting,
      (SELECT count(*) FROM brain_tweets) AS tweets,
      (SELECT count(*) FROM brain_tweets WHERE scraped_at >= NOW() - INTERVAL '24 hours') AS tweets_24h,
      (SELECT count(*) FROM brain_classifications) AS classified,
      (SELECT count(*) FROM brain_growth_events) AS growth_events,
      (SELECT count(*) FROM brain_stage_transitions WHERE status='completed') AS transitions_completed,
      (SELECT count(*) FROM brain_stage_transitions WHERE status='in_progress') AS transitions_in_progress,
      (SELECT count(*) FROM external_reply_patterns) AS reply_patterns
  `);
  const u = univ.rows[0];
  console.log(`Accounts tracked: ${u.accounts}  |  Growing (h/e/i): ${u.explosive}E + ${u.hot}H + ${u.interesting}I`);
  console.log(`Tweets: ${u.tweets} total, ${u.tweets_24h} in last 24h  |  Classified: ${u.classified}`);
  console.log(`Growth events recorded: ${u.growth_events}`);
  console.log(`Stage transitions: ${u.transitions_completed} completed, ${u.transitions_in_progress} in progress`);
  console.log(`External reply patterns captured: ${u.reply_patterns}`);

  // ── 2. Follower range distribution ──────────────────────────────────
  sep('FOLLOWER RANGE — WHO ARE WE WATCHING?');
  const ranges = await c.query(`
    SELECT
      CASE
        WHEN followers_count < 100 THEN '1_nano (0-100)'
        WHEN followers_count < 1000 THEN '2_micro (100-1K)'
        WHEN followers_count < 10000 THEN '3_small (1K-10K)'
        WHEN followers_count < 50000 THEN '4_mid (10K-50K)'
        WHEN followers_count < 250000 THEN '5_large (50K-250K)'
        WHEN followers_count < 1000000 THEN '6_mega (250K-1M)'
        ELSE '7_celebrity (1M+)'
      END AS range,
      count(*) AS accts,
      count(*) FILTER (WHERE growth_status IN ('hot','explosive','interesting')) AS growing
    FROM brain_accounts
    WHERE followers_count IS NOT NULL
    GROUP BY 1 ORDER BY 1
  `);
  for (const r of ranges.rows) {
    console.log(`  ${r.range.padEnd(22)} ${String(r.accts).padStart(6)} accounts  |  ${r.growing} growing`);
  }

  // ── 3. Top growing accounts right now ───────────────────────────────
  sep('TOP 12 GROWING ACCOUNTS (by growth_rate_7d)');
  const top = await c.query(`
    SELECT username, followers_count, growth_rate_7d, growth_status, niche_cached
    FROM brain_accounts
    WHERE growth_status IN ('hot','explosive','interesting')
      AND growth_rate_7d IS NOT NULL
    ORDER BY growth_rate_7d DESC NULLS LAST
    LIMIT 12
  `);
  for (const r of top.rows) {
    const rate = r.growth_rate_7d ? (Number(r.growth_rate_7d) * 100).toFixed(1) + '%' : '-';
    console.log(
      `  @${(r.username || '').padEnd(24)} ${String(r.followers_count).padStart(8)} followers  ` +
        `+${rate.padStart(7)}/7d  [${r.growth_status}]  ${r.niche_cached ?? ''}`,
    );
  }

  // ── 4. Top hooks / tones / formats (stratified by tier) ─────────────
  sep('TOP HOOKS by account tier (classified tweets, avg engagement rate)');
  const hooks = await c.query(`
    SELECT bt.author_tier, bc.hook_type,
      count(*) AS n,
      round(avg(bt.engagement_rate)::numeric, 4) AS avg_er,
      round(avg(bt.likes)::numeric, 1) AS avg_likes
    FROM brain_classifications bc
    JOIN brain_tweets bt ON bt.tweet_id = bc.tweet_id
    WHERE bc.hook_type IS NOT NULL
      AND bc.hook_type <> 'other'
      AND bt.author_tier IS NOT NULL
      AND bt.likes > 0
    GROUP BY bt.author_tier, bc.hook_type
    HAVING count(*) >= 10
    ORDER BY bt.author_tier, avg_er DESC
  `);
  let currentTier = '';
  for (const r of hooks.rows) {
    if (r.author_tier !== currentTier) {
      currentTier = r.author_tier;
      console.log(`\n  Tier ${currentTier}:`);
    }
    console.log(
      `    ${r.hook_type.padEnd(20)} n=${String(r.n).padStart(4)}  avg_er=${r.avg_er}  avg_likes=${r.avg_likes}`,
    );
  }

  // ── 5. Top tones ────────────────────────────────────────────────────
  sep('TOP TONES (S/A tier only — aspirational signal)');
  const tones = await c.query(`
    SELECT bc.tone,
      count(*) AS n,
      round(avg(bt.engagement_rate)::numeric, 4) AS avg_er
    FROM brain_classifications bc
    JOIN brain_tweets bt ON bt.tweet_id = bc.tweet_id
    WHERE bc.tone IS NOT NULL AND bc.tone <> 'other'
      AND bt.author_tier IN ('S','A')
      AND bt.likes > 0
    GROUP BY bc.tone
    HAVING count(*) >= 10
    ORDER BY avg_er DESC LIMIT 8
  `);
  for (const r of tones.rows) {
    console.log(`  ${r.tone.padEnd(20)} n=${String(r.n).padStart(4)}  avg_er=${r.avg_er}`);
  }

  // ── 6. Reply vs original behavior ───────────────────────────────────
  sep('REPLY-VS-ORIGINAL MIX by growth_status');
  const mix = await c.query(`
    SELECT ba.growth_status,
      count(*) FILTER (WHERE bt.tweet_type='reply') AS replies,
      count(*) FILTER (WHERE bt.tweet_type='original' OR bt.tweet_type IS NULL) AS originals,
      round(count(*) FILTER (WHERE bt.tweet_type='reply')::numeric / NULLIF(count(*), 0), 3) AS reply_ratio
    FROM brain_tweets bt
    JOIN brain_accounts ba ON ba.username = bt.author_username
    WHERE bt.posted_at >= NOW() - INTERVAL '14 days'
      AND ba.growth_status IS NOT NULL
    GROUP BY ba.growth_status
    ORDER BY CASE ba.growth_status WHEN 'explosive' THEN 1 WHEN 'hot' THEN 2 WHEN 'interesting' THEN 3 ELSE 4 END
  `);
  for (const r of mix.rows) {
    console.log(
      `  ${(r.growth_status ?? '-').padEnd(12)} replies=${String(r.replies).padStart(5)}  originals=${String(r.originals).padStart(5)}  reply_ratio=${r.reply_ratio}`,
    );
  }

  // ── 7. Stage transitions (what actually crossed a threshold?) ───────
  sep('COMPLETED STAGE TRANSITIONS');
  const trans = await c.query(`
    SELECT username, from_stage, to_stage, duration_days, followers_at_start, followers_at_end,
      reply_ratio, avg_posts_per_day, avg_replies_per_day
    FROM brain_stage_transitions
    WHERE status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 15
  `);
  if (trans.rows.length === 0) {
    console.log('  (none yet — detector needs to run against accounts with ≥2 snapshots)');
  } else {
    for (const r of trans.rows) {
      console.log(
        `  @${(r.username || '').padEnd(22)} ${r.from_stage}→${r.to_stage}  ` +
          `${String(r.followers_at_start).padStart(5)}→${r.followers_at_end}  in ${Number(r.duration_days ?? 0).toFixed(1)}d  ` +
          `reply_ratio=${r.reply_ratio ?? '-'}  posts/d=${r.avg_posts_per_day ?? '-'}  replies/d=${r.avg_replies_per_day ?? '-'}`,
      );
    }
  }

  // ── 8. Growth events detected ───────────────────────────────────────
  sep('RECENT GROWTH EVENTS (last 30 days)');
  const events = await c.query(`
    SELECT username, growth_phase_at_detection, followers_at_detection,
      growth_rate_before, growth_rate_after, acceleration_factor, detected_at
    FROM brain_growth_events
    WHERE detected_at >= NOW() - INTERVAL '30 days'
    ORDER BY acceleration_factor DESC NULLS LAST
    LIMIT 10
  `);
  if (events.rows.length === 0) {
    console.log('  (none in last 30 days)');
  } else {
    for (const r of events.rows) {
      console.log(
        `  @${(r.username || '').padEnd(22)} ${r.followers_at_detection ?? '-'} followers  ` +
          `acceleration=${r.acceleration_factor ? Number(r.acceleration_factor).toFixed(2) : '-'}x  ` +
          `phase=${r.growth_phase_at_detection ?? '-'}  ${new Date(r.detected_at).toISOString().slice(0, 10)}`,
      );
    }
  }

  // ── 9. Growth playbooks ─────────────────────────────────────────────
  sep('GROWTH PLAYBOOKS (brain_strategy_library)');
  const { rows: pbs } = await c.query(`
    SELECT stage, strategy_name, win_rate, sample_size, confidence, strategy_category
    FROM brain_strategy_library
    WHERE sample_size > 0
    ORDER BY stage,
      CASE confidence WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      win_rate DESC NULLS LAST
    LIMIT 20
  `).catch(() => ({ rows: [] as any[] }));
  if (pbs.length === 0) {
    console.log('  (empty — requires runStrategyLibraryBuilder to have populated it)');
  } else {
    let curr = '';
    for (const r of pbs) {
      if (r.stage !== curr) { curr = r.stage; console.log(`\n  ${curr}:`); }
      console.log(
        `    ${(r.strategy_name || '-').padEnd(34).slice(0, 34)}  ` +
          `win=${r.win_rate ?? '-'}  n=${r.sample_size}  conf=${r.confidence}  cat=${r.strategy_category ?? '-'}`,
      );
    }
  }

  // ── 10. External patterns (tickAdvisor source) ──────────────────────
  sep('TOP EXTERNAL PATTERNS (do_more, medium/high confidence)');
  const { rows: pat } = await c.query(`
    SELECT pattern_type, angle, tone, format, hour_bucket,
      ext_sample_count, combined_score, confidence, direction
    FROM external_patterns
    WHERE direction = 'do_more' AND confidence IN ('medium','high')
    ORDER BY combined_score DESC LIMIT 15
  `).catch(() => ({ rows: [] as any[] }));
  if (pat.length === 0) {
    console.log('  (none actionable yet — aggregator needs more samples or higher recency)');
  } else {
    for (const r of pat) {
      console.log(
        `  ${r.pattern_type.padEnd(16)} angle=${(r.angle ?? '-').padEnd(14).slice(0,14)} tone=${(r.tone ?? '-').padEnd(14).slice(0,14)} ` +
          `hour=${r.hour_bucket ?? '-'}  n=${r.ext_sample_count}  score=${Number(r.combined_score ?? 0).toFixed(3)}  ${r.confidence}`,
      );
    }
  }

  // ── 11. Best posting hours we've observed ───────────────────────────
  sep('BEST POSTING HOURS (among 1K-50K follower accounts, classified tweets)');
  const hrs = await c.query(`
    SELECT bt.posted_hour_utc,
      count(*) AS n,
      round(avg(bt.engagement_rate)::numeric, 4) AS avg_er,
      round(avg(bt.likes)::numeric, 1) AS avg_likes
    FROM brain_tweets bt
    JOIN brain_accounts ba ON ba.username = bt.author_username
    WHERE bt.posted_hour_utc IS NOT NULL
      AND bt.likes > 0
      AND ba.followers_count BETWEEN 1000 AND 50000
    GROUP BY bt.posted_hour_utc
    HAVING count(*) >= 20
    ORDER BY avg_er DESC LIMIT 8
  `);
  for (const r of hrs.rows) {
    console.log(`  ${String(r.posted_hour_utc).padStart(2, '0')}:00 UTC  n=${r.n}  avg_er=${r.avg_er}  avg_likes=${r.avg_likes}`);
  }

  await c.end();
}

main().catch(e => {
  console.error('ERR:', e.message);
  process.exit(1);
});

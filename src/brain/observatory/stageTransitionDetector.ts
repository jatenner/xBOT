/**
 * Stage Transition Detector
 *
 * Scans brain_account_snapshots to detect when accounts cross follower thresholds:
 *   0→100, 100→500, 500→1K, 1K→5K, 5K→10K
 *
 * For each detected transition:
 *   1. Records start/end dates and duration
 *   2. Extracts behavior DURING the transition window from brain_tweets
 *   3. Pulls classification data (hooks, tones, formats) for that window
 *   4. Marks transitions as completed, in_progress, or stalled
 *
 * Runs every 2 hours via jobManager.
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/stage-transitions]';

// ── Stage definitions ──
// Each stage is defined by a follower threshold.
// A transition is from one threshold to the next.
const STAGE_THRESHOLDS = [0, 100, 500, 1000, 5000, 10000] as const;

interface StageTransition {
  from_stage: string;
  to_stage: string;
  from_threshold: number;
  to_threshold: number;
}

const STAGE_TRANSITIONS: StageTransition[] = [];
for (let i = 0; i < STAGE_THRESHOLDS.length - 1; i++) {
  STAGE_TRANSITIONS.push({
    from_stage: String(STAGE_THRESHOLDS[i]),
    to_stage: String(STAGE_THRESHOLDS[i + 1]),
    from_threshold: STAGE_THRESHOLDS[i],
    to_threshold: STAGE_THRESHOLDS[i + 1],
  });
}

// Stall threshold: if an account has been in a stage for this many days
// without crossing the next threshold, mark it as stalled.
const STALL_THRESHOLD_DAYS = 60;

// Backfill buffer: how far back before the transition started to scrape.
// E.g. if the account crossed 100 followers on 2026-03-01, backfill down
// to 2026-01-30 — gives us the lead-up behavior that caused the growth.
const BACKFILL_LEAD_DAYS = 30;

export async function runStageTransitionDetector(): Promise<{
  transitions_detected: number;
  transitions_completed: number;
  transitions_stalled: number;
  behaviors_computed: number;
}> {
  const supabase = getSupabaseClient();
  let detected = 0;
  let completed = 0;
  let stalled = 0;
  let behaviorsComputed = 0;

  // Get all accounts with 2+ snapshots
  const { data: accounts } = await supabase
    .from('brain_accounts')
    .select('username, followers_count, niche_cached, account_type_cached')
    .eq('is_active', true)
    .gte('snapshot_count', 2)
    .limit(2000);

  if (!accounts || accounts.length === 0) {
    return { transitions_detected: 0, transitions_completed: 0, transitions_stalled: 0, behaviors_computed: 0 };
  }

  // Get existing transitions to avoid re-detecting
  const { data: existingTransitions } = await supabase
    .from('brain_stage_transitions')
    .select('username, from_stage, to_stage, status');

  const existingSet = new Set(
    (existingTransitions ?? []).map(t => `${t.username}:${t.from_stage}:${t.to_stage}`)
  );
  const existingMap = new Map(
    (existingTransitions ?? []).map(t => [`${t.username}:${t.from_stage}:${t.to_stage}`, t.status])
  );

  // Process each account
  for (const account of accounts) {
    try {
      // Get all snapshots for this account, ordered chronologically
      const { data: snapshots } = await supabase
        .from('brain_account_snapshots')
        .select('followers_count, checked_at')
        .eq('username', account.username)
        .order('checked_at', { ascending: true })
        .limit(500);

      if (!snapshots || snapshots.length < 2) continue;

      // For each stage transition, check if this account crossed it
      for (const transition of STAGE_TRANSITIONS) {
        const key = `${account.username}:${transition.from_stage}:${transition.to_stage}`;

        // Skip if already completed
        if (existingMap.get(key) === 'completed') continue;

        // Find the first snapshot at or above from_threshold
        const startIdx = snapshots.findIndex(s => s.followers_count >= transition.from_threshold);
        if (startIdx < 0) continue; // Never reached from_threshold

        const startSnapshot = snapshots[startIdx];
        const startDate = startSnapshot.checked_at;

        // Find the first snapshot at or above to_threshold AFTER the start
        const endIdx = snapshots.findIndex((s, i) => i > startIdx && s.followers_count >= transition.to_threshold);

        const isNew = !existingSet.has(key);
        const currentFollowers = account.followers_count ?? 0;

        if (endIdx >= 0) {
          // ── COMPLETED transition ──
          const endSnapshot = snapshots[endIdx];
          const startMs = new Date(startDate).getTime();
          const endMs = new Date(endSnapshot.checked_at).getTime();
          const durationDays = (endMs - startMs) / (24 * 60 * 60 * 1000);

          const growthRate = startSnapshot.followers_count > 0
            ? ((endSnapshot.followers_count - startSnapshot.followers_count) / startSnapshot.followers_count) * 100
            : 0;

          // Compute behavior during transition window
          const behavior = await computeTransitionBehavior(
            supabase, account.username, startDate, endSnapshot.checked_at
          );

          const record = {
            username: account.username,
            from_stage: transition.from_stage,
            to_stage: transition.to_stage,
            status: 'completed',
            started_at: startDate,
            completed_at: endSnapshot.checked_at,
            duration_days: Math.round(durationDays * 10) / 10,
            followers_at_start: startSnapshot.followers_count,
            followers_at_end: endSnapshot.followers_count,
            growth_rate_pct: Math.round(growthRate * 10) / 10,
            niche: account.niche_cached,
            account_type: account.account_type_cached,
            updated_at: new Date().toISOString(),
            ...behavior,
          };

          await supabase
            .from('brain_stage_transitions')
            .upsert(record, { onConflict: 'username,from_stage,to_stage' });

          // Enqueue a historical backfill so we capture tweets from BEFORE
          // and during the growth window — our scraper's default 100-tweet
          // pull is current-state only and misses the actual growth period.
          if (isNew) {
            await enqueueBackfill(supabase, {
              username: account.username,
              from_stage: transition.from_stage,
              to_stage: transition.to_stage,
              transition_started_at: startDate,
            });
          }

          if (isNew) detected++;
          completed++;
          if (behavior.avg_posts_per_day !== null) behaviorsComputed++;

        } else if (currentFollowers >= transition.from_threshold && currentFollowers < transition.to_threshold) {
          // ── IN-PROGRESS or STALLED transition ──
          const startMs = new Date(startDate).getTime();
          const daysSinceStart = (Date.now() - startMs) / (24 * 60 * 60 * 1000);
          const status = daysSinceStart > STALL_THRESHOLD_DAYS ? 'stalled' : 'in_progress';

          // Compute behavior for in-progress/stalled transitions too
          const behavior = await computeTransitionBehavior(
            supabase, account.username, startDate, new Date().toISOString()
          );

          const record = {
            username: account.username,
            from_stage: transition.from_stage,
            to_stage: transition.to_stage,
            status,
            started_at: startDate,
            completed_at: null,
            duration_days: Math.round(daysSinceStart * 10) / 10,
            followers_at_start: startSnapshot.followers_count,
            followers_at_end: currentFollowers,
            growth_rate_pct: startSnapshot.followers_count > 0
              ? Math.round(((currentFollowers - startSnapshot.followers_count) / startSnapshot.followers_count) * 1000) / 10
              : 0,
            niche: account.niche_cached,
            account_type: account.account_type_cached,
            updated_at: new Date().toISOString(),
            ...behavior,
          };

          await supabase
            .from('brain_stage_transitions')
            .upsert(record, { onConflict: 'username,from_stage,to_stage' });

          // For in-progress early-stage transitions (nano/micro), enqueue a
          // backfill too. Early-growth accounts change fast and we want their
          // history immediately, not after the transition completes.
          if (isNew && transition.from_threshold < 1000) {
            await enqueueBackfill(supabase, {
              username: account.username,
              from_stage: transition.from_stage,
              to_stage: transition.to_stage,
              transition_started_at: startDate,
            });
          }

          if (isNew) detected++;
          if (status === 'stalled') stalled++;
          if (behavior.avg_posts_per_day !== null) behaviorsComputed++;
        }
      }
    } catch (err: any) {
      console.error(`${LOG_PREFIX} Error processing @${account.username}: ${err.message}`);
    }
  }

  console.log(
    `${LOG_PREFIX} Detected ${detected} new transitions, ` +
    `${completed} completed, ${stalled} stalled, ` +
    `${behaviorsComputed} behaviors computed`
  );

  return { transitions_detected: detected, transitions_completed: completed, transitions_stalled: stalled, behaviors_computed: behaviorsComputed };
}

// =============================================================================
// Behavior extraction DURING a transition window
// =============================================================================

interface TransitionBehavior {
  avg_posts_per_day: number | null;
  avg_replies_per_day: number | null;
  reply_ratio: number | null;
  avg_likes: number | null;
  avg_views: number | null;
  avg_engagement_rate: number | null;
  avg_word_count: number | null;
  avg_reply_target_followers: number | null;
  avg_reply_delay_minutes: number | null;
  hook_distribution: Record<string, number> | null;
  tone_distribution: Record<string, number> | null;
  format_distribution: Record<string, number> | null;
}

async function computeTransitionBehavior(
  supabase: any,
  username: string,
  startDate: string,
  endDate: string,
): Promise<TransitionBehavior> {
  const empty: TransitionBehavior = {
    avg_posts_per_day: null, avg_replies_per_day: null, reply_ratio: null,
    avg_likes: null, avg_views: null, avg_engagement_rate: null, avg_word_count: null,
    avg_reply_target_followers: null, avg_reply_delay_minutes: null,
    hook_distribution: null, tone_distribution: null, format_distribution: null,
  };

  // Get tweets by this account during the transition window
  const { data: tweets } = await supabase
    .from('brain_tweets')
    .select('tweet_id, tweet_type, likes, views, engagement_rate, reply_to_username, reply_target_followers, reply_delay_minutes, content_features, posted_at')
    .eq('author_username', username)
    .gte('posted_at', startDate)
    .lte('posted_at', endDate)
    .order('posted_at', { ascending: true })
    .limit(1000);

  if (!tweets || tweets.length === 0) return empty;

  const durationDays = Math.max(1, (new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000));

  const originals = tweets.filter((t: any) => t.tweet_type !== 'reply');
  const replies = tweets.filter((t: any) => t.tweet_type === 'reply');

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

  const wordCounts = tweets.map((t: any) => {
    const features = t.content_features;
    if (features && typeof features === 'object' && features.word_count) return features.word_count;
    return null;
  }).filter((w: any) => w !== null) as number[];

  const replyTargetFollowers = replies
    .map((t: any) => t.reply_target_followers)
    .filter((f: any) => f != null && f > 0) as number[];

  const replyDelays = replies
    .map((t: any) => t.reply_delay_minutes)
    .filter((d: any) => d != null && d >= 0) as number[];

  // Get classifications for these tweets
  const tweetIds = tweets.map((t: any) => t.tweet_id);
  let hookDist: Record<string, number> | null = null;
  let toneDist: Record<string, number> | null = null;
  let formatDist: Record<string, number> | null = null;

  if (tweetIds.length > 0) {
    // Batch query in chunks of 100 to avoid URL length limits
    const allClassifications: any[] = [];
    for (let i = 0; i < tweetIds.length; i += 100) {
      const chunk = tweetIds.slice(i, i + 100);
      const { data: classifications } = await supabase
        .from('brain_classifications')
        .select('hook_type, tone, format')
        .in('tweet_id', chunk);
      if (classifications) allClassifications.push(...classifications);
    }

    if (allClassifications.length > 0) {
      hookDist = buildDistribution(allClassifications, 'hook_type');
      toneDist = buildDistribution(allClassifications, 'tone');
      formatDist = buildDistribution(allClassifications, 'format');
    }
  }

  return {
    avg_posts_per_day: Math.round((originals.length / durationDays) * 100) / 100,
    avg_replies_per_day: Math.round((replies.length / durationDays) * 100) / 100,
    reply_ratio: tweets.length > 0 ? Math.round((replies.length / tweets.length) * 100) / 100 : null,
    avg_likes: Math.round(avg(tweets.map((t: any) => t.likes ?? 0)) * 10) / 10,
    avg_views: Math.round(avg(tweets.map((t: any) => t.views ?? 0))),
    avg_engagement_rate: Math.round(avg(tweets.map((t: any) => t.engagement_rate ?? 0).filter((e: number) => e > 0)) * 10000) / 10000,
    avg_word_count: wordCounts.length > 0 ? Math.round(avg(wordCounts)) : null,
    avg_reply_target_followers: replyTargetFollowers.length > 0 ? Math.round(avg(replyTargetFollowers)) : null,
    avg_reply_delay_minutes: replyDelays.length > 0 ? Math.round(avg(replyDelays) * 10) / 10 : null,
    hook_distribution: hookDist,
    tone_distribution: toneDist,
    format_distribution: formatDist,
  };
}

async function enqueueBackfill(
  supabase: any,
  args: {
    username: string;
    from_stage: string;
    to_stage: string;
    transition_started_at: string;
  },
): Promise<void> {
  const cutoff = new Date(
    new Date(args.transition_started_at).getTime() - BACKFILL_LEAD_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { error } = await supabase.from('brain_backfill_queue').upsert(
    {
      username: args.username,
      from_stage: args.from_stage,
      to_stage: args.to_stage,
      transition_detected_at: new Date().toISOString(),
      transition_started_at: args.transition_started_at,
      target_date_cutoff: cutoff,
      status: 'pending',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'username,from_stage,to_stage', ignoreDuplicates: true },
  );

  if (error) {
    console.warn(
      `${LOG_PREFIX} enqueueBackfill failed for @${args.username} ${args.from_stage}→${args.to_stage}: ${error.message}`,
    );
  }
}

function buildDistribution(rows: any[], field: string): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const val = row[field];
    if (val && val !== 'other' && val !== 'none') {
      counts[val] = (counts[val] || 0) + 1;
      total++;
    }
  }
  // Normalize to fractions
  const dist: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    dist[key] = Math.round((count / Math.max(total, 1)) * 100) / 100;
  }
  return dist;
}

/**
 * STRATEGY LEARNER JOB
 *
 * Analyzes the last 7 days of growth_ledger outcomes and incrementally
 * updates strategy_state to optimize volume, timing, and content mix.
 *
 * This is the data-driven complement to strategyLearner.ts (which uses
 * breakout detection and GrowthIntelligence). This job works directly
 * from raw outcome aggregates: avg views by action type, hour, pacing.
 *
 * Safety:
 * - Minimum 10 outcomes required to update
 * - Max 20% change per update cycle
 * - Targets clamped to [1, 30] per day
 * - Pacing never below 10 minutes
 * - All changes logged with before/after and reasoning
 */

import { getSupabaseClient } from '../db/index';

// ─── Constants ───

const LOOKBACK_DAYS = 7;
const MIN_OUTCOMES = 10;
const MAX_CHANGE_RATIO = 0.2;   // 20% max change per cycle
const MIN_TARGET = 1;
const MAX_TARGET = 30;
const MIN_PACING_MINUTES = 10;
const TOP_PEAK_HOURS = 5;

const TAG = '[STRATEGY_LEARNER_JOB]';

// ─── Helpers ───

/** Clamp a value to [min, max]. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Adjust old toward desired by at most MAX_CHANGE_RATIO, then clamp to [min, max]. */
function incrementalAdjust(
  current: number,
  desired: number,
  min: number,
  max: number,
): number {
  const maxDelta = Math.max(1, Math.abs(current) * MAX_CHANGE_RATIO);
  const delta = clamp(desired - current, -maxDelta, maxDelta);
  return clamp(Math.round((current + delta) * 100) / 100, min, max);
}

// ─── Types ───

interface HourBucket {
  hour: number;
  avgViews: number;
  count: number;
}

interface ActionBucket {
  actionType: string;
  avgViews: number;
  count: number;
}

interface PacingBucket {
  bucket: string;       // e.g. '<10min', '10-30min', '>30min'
  avgViews: number;
  count: number;
}

// ─── Main ───

export async function runStrategyLearner(): Promise<{ updated: boolean; changes: string[] }> {
  const changes: string[] = [];

  try {
    const supabase = getSupabaseClient();
    // Use RAMP_START_DATE to exclude legacy TheHealthNote99 data — only learn from @Neurix5
    const since = process.env.RAMP_START_DATE
      ? new Date(process.env.RAMP_START_DATE).toISOString()
      : '2026-03-23T00:00:00Z';

    // ── 1. Fetch recent outcomes from growth_ledger ──

    const { data: rows, error: fetchErr } = await supabase
      .from('growth_ledger')
      .select('action_type, views, likes, replies, retweets, posted_at, posted_hour_utc, reply_delay_minutes, reward')
      .not('views', 'is', null)
      .gte('posted_at', since)
      .order('posted_at', { ascending: false })
      .limit(500);

    if (fetchErr) {
      console.error(`${TAG} Failed to fetch growth_ledger: ${fetchErr.message}`);
      return { updated: false, changes: [`fetch_error: ${fetchErr.message}`] };
    }

    if (!rows || rows.length < MIN_OUTCOMES) {
      console.log(`${TAG} Insufficient data: ${rows?.length ?? 0} outcomes (need ${MIN_OUTCOMES}), skipping`);
      return { updated: false, changes: [`insufficient_data: ${rows?.length ?? 0}/${MIN_OUTCOMES}`] };
    }

    // Guardrail: if average views across all rows < 5, data is too thin to learn from
    const overallAvgViews = rows.reduce((s, r) => s + (Number(r.views) || 0), 0) / rows.length;
    if (overallAvgViews < 5) {
      console.log(`${TAG} Average views too low (${overallAvgViews.toFixed(1)} < 5), skipping strategy update to avoid learning from noise`);
      return { updated: false, changes: [`avg_views_too_low: ${overallAvgViews.toFixed(1)}`] };
    }

    console.log(`${TAG} Analyzing ${rows.length} outcomes from last ${LOOKBACK_DAYS} days`);

    // ── 2. Read current strategy_state ──

    const { data: current, error: stateErr } = await supabase
      .from('strategy_state')
      .select('*')
      .eq('id', 1)
      .single();

    if (stateErr || !current) {
      console.error(`${TAG} No strategy_state found: ${stateErr?.message ?? 'no row'}`);
      return { updated: false, changes: ['no_strategy_state'] };
    }

    // ── 3. Aggregate by action type ──

    const actionMap = new Map<string, { totalViews: number; count: number }>();
    for (const r of rows) {
      const at = r.action_type ?? 'unknown';
      const entry = actionMap.get(at) ?? { totalViews: 0, count: 0 };
      entry.totalViews += Number(r.views) || 0;
      entry.count++;
      actionMap.set(at, entry);
    }

    const actionBuckets: ActionBucket[] = [];
    for (const [actionType, agg] of Array.from(actionMap.entries())) {
      actionBuckets.push({ actionType, avgViews: agg.count > 0 ? agg.totalViews / agg.count : 0, count: agg.count });
    }

    const globalAvgViews = rows.reduce((s, r) => s + (Number(r.views) || 0), 0) / rows.length;
    console.log(`${TAG} Global avg views: ${globalAvgViews.toFixed(1)}`);
    for (const b of actionBuckets) {
      console.log(`${TAG}   ${b.actionType}: avg_views=${b.avgViews.toFixed(1)} n=${b.count}`);
    }

    // ── 4. Volume targets ──

    for (const b of actionBuckets) {
      if (b.count < 3) continue; // need some minimum per action type

      const fieldMap: Record<string, string> = {
        reply: 'target_replies_per_day',
        single: 'target_singles_per_day',
        thread: 'target_threads_per_day',
      };

      const field = fieldMap[b.actionType];
      if (!field) continue;

      const currentTarget = Number(current[field]) || 1;

      let desiredTarget: number;
      if (b.avgViews < 1) {
        // Zero/near-zero views — decrease
        desiredTarget = currentTarget - 2;
      } else if (b.avgViews > globalAvgViews * 1.2) {
        // Above average — increase
        desiredTarget = currentTarget + 2;
      } else if (b.avgViews < globalAvgViews * 0.5) {
        // Well below average — decrease
        desiredTarget = currentTarget - 1;
      } else {
        // In range — no change
        desiredTarget = currentTarget;
      }

      const newTarget = incrementalAdjust(currentTarget, desiredTarget, MIN_TARGET, MAX_TARGET);
      if (newTarget !== currentTarget) {
        changes.push(`${field}: ${currentTarget} -> ${newTarget} (avg_views=${b.avgViews.toFixed(1)} vs global=${globalAvgViews.toFixed(1)})`);
        current[field] = newTarget;
      }
    }

    // ── 5. Reply pacing ──

    const replyRows = rows.filter(r => r.action_type === 'reply' && r.reply_delay_minutes != null);
    if (replyRows.length >= 5) {
      const pacingBuckets: PacingBucket[] = [];

      const under10 = replyRows.filter(r => Number(r.reply_delay_minutes) < 10);
      const mid = replyRows.filter(r => Number(r.reply_delay_minutes) >= 10 && Number(r.reply_delay_minutes) <= 30);
      const over30 = replyRows.filter(r => Number(r.reply_delay_minutes) > 30);

      if (under10.length > 0) {
        pacingBuckets.push({
          bucket: '<10min',
          avgViews: under10.reduce((s, r) => s + (Number(r.views) || 0), 0) / under10.length,
          count: under10.length,
        });
      }
      if (mid.length > 0) {
        pacingBuckets.push({
          bucket: '10-30min',
          avgViews: mid.reduce((s, r) => s + (Number(r.views) || 0), 0) / mid.length,
          count: mid.length,
        });
      }
      if (over30.length > 0) {
        pacingBuckets.push({
          bucket: '>30min',
          avgViews: over30.reduce((s, r) => s + (Number(r.views) || 0), 0) / over30.length,
          count: over30.length,
        });
      }

      for (const pb of pacingBuckets) {
        console.log(`${TAG}   pacing ${pb.bucket}: avg_views=${pb.avgViews.toFixed(1)} n=${pb.count}`);
      }

      // If slow replies outperform fast replies, increase pacing
      const fastAvg = pacingBuckets.find(p => p.bucket === '<10min')?.avgViews ?? 0;
      const slowAvg = pacingBuckets.find(p => p.bucket === '>30min')?.avgViews ?? 0;
      const currentPacing = Number(current.reply_pacing_minutes) || 30;

      if (slowAvg > fastAvg * 1.3 && over30.length >= 3) {
        // Slow is clearly better — increase pacing
        const desiredPacing = Math.min(60, currentPacing + 5);
        const newPacing = incrementalAdjust(currentPacing, desiredPacing, MIN_PACING_MINUTES, 120);
        if (newPacing !== currentPacing) {
          changes.push(`reply_pacing_minutes: ${currentPacing} -> ${newPacing} (slow=${slowAvg.toFixed(1)} > fast=${fastAvg.toFixed(1)})`);
          current.reply_pacing_minutes = newPacing;
        }
      } else if (fastAvg > slowAvg * 1.3 && under10.length >= 3) {
        // Fast is clearly better — decrease pacing (but not below MIN)
        const desiredPacing = Math.max(MIN_PACING_MINUTES, currentPacing - 5);
        const newPacing = incrementalAdjust(currentPacing, desiredPacing, MIN_PACING_MINUTES, 120);
        if (newPacing !== currentPacing) {
          changes.push(`reply_pacing_minutes: ${currentPacing} -> ${newPacing} (fast=${fastAvg.toFixed(1)} > slow=${slowAvg.toFixed(1)})`);
          current.reply_pacing_minutes = newPacing;
        }
      }
    }

    // ── 6. Peak hours ──

    const hourMap = new Map<number, { totalViews: number; count: number }>();
    for (const r of rows) {
      const h = r.posted_hour_utc != null ? Number(r.posted_hour_utc) : new Date(r.posted_at).getUTCHours();
      const entry = hourMap.get(h) ?? { totalViews: 0, count: 0 };
      entry.totalViews += Number(r.views) || 0;
      entry.count++;
      hourMap.set(h, entry);
    }

    const hourBuckets: HourBucket[] = [];
    for (const [hour, agg] of Array.from(hourMap.entries())) {
      hourBuckets.push({ hour, avgViews: agg.count > 0 ? agg.totalViews / agg.count : 0, count: agg.count });
    }

    // Sort by avg views descending, take top 5 as peak_hours
    hourBuckets.sort((a, b) => b.avgViews - a.avgViews);
    const newPeakHours = hourBuckets
      .filter(b => b.count >= 2)  // need at least 2 data points per hour
      .slice(0, TOP_PEAK_HOURS)
      .map(b => b.hour)
      .sort((a, b) => a - b);

    if (newPeakHours.length > 0) {
      const oldPeak = (Array.isArray(current.peak_hours) ? current.peak_hours : []).sort((a: number, b: number) => a - b);
      if (JSON.stringify(newPeakHours) !== JSON.stringify(oldPeak)) {
        // Guardrail: never shrink peak_hours below 3 — too few peak hours starves engagement
        if (newPeakHours.length < 3) {
          console.log(`${TAG} Keeping existing peak_hours: new list has only ${newPeakHours.length} hours (min 3 required)`);
        } else {
          changes.push(`peak_hours: [${oldPeak}] -> [${newPeakHours}] (top ${TOP_PEAK_HOURS} by avg views)`);
          current.peak_hours = newPeakHours;
        }
      }
    }

    // ── 7. Active hours ──

    const viewsThreshold = globalAvgViews * 0.5;
    const newActiveHours = hourBuckets
      .filter(b => b.avgViews >= viewsThreshold && b.count >= 1)
      .map(b => b.hour)
      .sort((a, b) => a - b);

    if (newActiveHours.length > 0) {
      const oldActive = (Array.isArray(current.active_hours) ? current.active_hours : []).sort((a: number, b: number) => a - b);
      if (JSON.stringify(newActiveHours) !== JSON.stringify(oldActive)) {
        // Guardrail: never shrink active_hours below 8 — too few hours kills volume
        if (newActiveHours.length < 8) {
          console.log(`${TAG} Keeping existing active_hours: new list has only ${newActiveHours.length} hours (min 8 required)`);
        } else {
          changes.push(`active_hours: [${oldActive}] -> [${newActiveHours}] (hours with avg views >= ${viewsThreshold.toFixed(0)})`);
          current.active_hours = newActiveHours;
        }
      }
    }

    // ── 8. Mix weights ──

    const replyBucket = actionBuckets.find(b => b.actionType === 'reply');
    const singleBucket = actionBuckets.find(b => b.actionType === 'single');
    const threadBucket = actionBuckets.find(b => b.actionType === 'thread');

    // Compute relative weights based on avg views; normalize so they sum to a reasonable total
    const buckets = [
      { key: 'reply_weight', bucket: replyBucket },
      { key: 'single_weight', bucket: singleBucket },
      { key: 'thread_weight', bucket: threadBucket },
    ].filter(b => b.bucket && b.bucket.count >= 3);

    if (buckets.length >= 2) {
      const totalAvgViews = buckets.reduce((s, b) => s + b.bucket!.avgViews, 0);
      if (totalAvgViews > 0) {
        // Target weights proportional to avg views, scaled so the max is ~3.0
        const maxAvg = Math.max(...buckets.map(b => b.bucket!.avgViews));
        for (const { key, bucket } of buckets) {
          const desiredWeight = Math.min(5.0, (bucket!.avgViews / maxAvg) * 3.0);
          const currentWeight = Number(current[key]) || 1.0;
          const newWeight = Math.min(5.0, incrementalAdjust(currentWeight, desiredWeight, 0.2, 5.0));
          if (Math.abs(newWeight - currentWeight) >= 0.05) {
            changes.push(`${key}: ${currentWeight.toFixed(2)} -> ${newWeight.toFixed(2)} (avg_views=${bucket!.avgViews.toFixed(1)})`);
            current[key] = newWeight;
          }
        }
      }
    }

    // ── 8b. Hard clamp — never exceed 5.0 regardless of input data ──
    if (current.reply_weight > 5.0) current.reply_weight = 5.0;
    if (current.single_weight > 5.0) current.single_weight = 5.0;
    if (current.thread_weight > 5.0) current.thread_weight = 5.0;

    // ── 9. Generation bump ──

    const newGeneration = (Number(current.generation) || 0) + 1;

    // ── 10. Write if changed ──

    if (changes.length === 0) {
      console.log(`${TAG} No changes needed (strategy is stable)`);
      return { updated: false, changes: ['no_changes'] };
    }

    console.log(`${TAG} gen=${newGeneration} Applying ${changes.length} changes:`);
    for (const c of changes) {
      console.log(`${TAG}   ${c}`);
    }

    const { error: writeErr } = await supabase
      .from('strategy_state')
      .update({
        target_replies_per_day: current.target_replies_per_day,
        target_singles_per_day: current.target_singles_per_day,
        target_threads_per_day: current.target_threads_per_day,
        reply_pacing_minutes: current.reply_pacing_minutes,
        post_pacing_minutes: current.post_pacing_minutes,
        active_hours: current.active_hours,
        peak_hours: current.peak_hours,
        reply_weight: current.reply_weight,
        single_weight: current.single_weight,
        thread_weight: current.thread_weight,
        generation: newGeneration,
        total_outcomes: rows.length,
        last_updated_at: new Date().toISOString(),
        update_summary: changes.join(' | '),
      })
      .eq('id', 1);

    if (writeErr) {
      console.error(`${TAG} Failed to write strategy_state: ${writeErr.message}`);
      return { updated: false, changes: [`write_error: ${writeErr.message}`] };
    }

    console.log(`${TAG} gen=${newGeneration} Strategy updated successfully (${changes.length} changes)`);
    return { updated: true, changes };

  } catch (err: any) {
    console.error(`${TAG} Unexpected error: ${err.message}`);
    return { updated: false, changes: [`error: ${err.message}`] };
  }
}

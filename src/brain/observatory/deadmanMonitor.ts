/**
 * Dead-Man's-Switch Monitor (Level 1: in-process)
 *
 * Runs every 10 minutes. Checks three critical write streams and raises a loud
 * alarm if any have stopped. Writes critical rows to system_events so downstream
 * ops tooling can pick them up, and prints loud console errors so they show up
 * in Docker logs.
 *
 * Why this exists: the census_worker silently failed for months on Railway —
 * reporting "Completed successfully" every 2 minutes while writing zero rows to
 * brain_account_snapshots. Nothing detected it because no one was looking at
 * write counts vs time. This job is that watcher.
 *
 * Level 2 (external uptime monitor pinging /healthz/deep) is a separate concern;
 * this file only implements the in-process check.
 *
 * Checks:
 *   1. brain_tweets — rows in last 30 min (expected: hundreds from brain_timelines)
 *   2. brain_account_snapshots — rows in last 30 min (expected: dozens from census_worker)
 *   3. brain_daily_context — row for today after 14:00 UTC (dailyContextCapture
 *      should have populated it by early afternoon)
 *
 * If any check fails, writes:
 *   system_events { event_type: 'deadman_alarm', severity: 'critical',
 *                   event_data: { check, expected, actual, ... } }
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/deadman]';
const WINDOW_MINUTES = 30;
const DAILY_CONTEXT_DEADLINE_UTC_HOUR = 14;

interface AlarmDetails {
  check: string;
  severity: 'critical' | 'warning';
  message: string;
  data: Record<string, any>;
}

async function raiseAlarm(supabase: any, alarm: AlarmDetails): Promise<void> {
  console.error(`${LOG_PREFIX} 🚨 DEADMAN ALARM — ${alarm.check}: ${alarm.message}`);
  try {
    await supabase.from('system_events').insert({
      event_type: 'deadman_alarm',
      severity: alarm.severity,
      event_data: { check: alarm.check, message: alarm.message, ...alarm.data },
      created_at: new Date().toISOString(),
    });
  } catch (err: any) {
    // If system_events write ALSO fails, we're in deep trouble — console is all we have
    console.error(`${LOG_PREFIX} Failed to write alarm to system_events: ${err.message}`);
  }
}

export async function runDeadmanMonitor(): Promise<{
  checks_run: number;
  alarms_raised: number;
}> {
  const supabase = getSupabaseClient();
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000).toISOString();
  let alarmsRaised = 0;
  const checksRun = 3;

  // Check 1: brain_tweets write rate
  try {
    const { count: tweetCount, error: tweetErr } = await supabase
      .from('brain_tweets')
      .select('*', { count: 'exact', head: true })
      .gte('scraped_at', windowCutoff);
    if (tweetErr) {
      console.warn(`${LOG_PREFIX} brain_tweets count query failed: ${tweetErr.message}`);
    } else if ((tweetCount ?? 0) === 0) {
      await raiseAlarm(supabase, {
        check: 'brain_tweets_writes',
        severity: 'critical',
        message: `No brain_tweets rows written in last ${WINDOW_MINUTES} min. brain_timelines may have stalled.`,
        data: { window_minutes: WINDOW_MINUTES, actual_count: 0 },
      });
      alarmsRaised++;
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Check 1 failed: ${err.message}`);
  }

  // Check 2: brain_account_snapshots write rate
  try {
    const { count: snapCount, error: snapErr } = await supabase
      .from('brain_account_snapshots')
      .select('*', { count: 'exact', head: true })
      .gte('checked_at', windowCutoff);
    if (snapErr) {
      console.warn(`${LOG_PREFIX} brain_account_snapshots count query failed: ${snapErr.message}`);
    } else if ((snapCount ?? 0) === 0) {
      await raiseAlarm(supabase, {
        check: 'brain_account_snapshots_writes',
        severity: 'critical',
        message: `No brain_account_snapshots rows written in last ${WINDOW_MINUTES} min. census_worker may have stalled.`,
        data: { window_minutes: WINDOW_MINUTES, actual_count: 0 },
      });
      alarmsRaised++;
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Check 2 failed: ${err.message}`);
  }

  // Check 3: brain_daily_context presence for today (after 14:00 UTC deadline)
  try {
    if (now.getUTCHours() >= DAILY_CONTEXT_DEADLINE_UTC_HOUR) {
      const today = now.toISOString().substring(0, 10);
      const { data: ctx, error: ctxErr } = await supabase
        .from('brain_daily_context')
        .select('context_date, source, trending_topics, notes')
        .eq('context_date', today)
        .maybeSingle();

      if (ctxErr) {
        console.warn(`${LOG_PREFIX} brain_daily_context query failed: ${ctxErr.message}`);
      } else if (!ctx) {
        await raiseAlarm(supabase, {
          check: 'brain_daily_context_missing',
          severity: 'critical',
          message: `No brain_daily_context row for ${today} after ${DAILY_CONTEXT_DEADLINE_UTC_HOUR}:00 UTC. dailyContextCapture may have stalled.`,
          data: { context_date: today, deadline_utc_hour: DAILY_CONTEXT_DEADLINE_UTC_HOUR },
        });
        alarmsRaised++;
      } else if (ctx.notes === 'sources_unavailable' || (ctx.trending_topics ?? []).length === 0) {
        await raiseAlarm(supabase, {
          check: 'brain_daily_context_empty',
          severity: 'warning',
          message: `brain_daily_context for ${today} exists but has no topics (notes=${ctx.notes ?? 'null'}).`,
          data: { context_date: today, source: ctx.source, notes: ctx.notes },
        });
        alarmsRaised++;
      }
    }
  } catch (err: any) {
    console.error(`${LOG_PREFIX} Check 3 failed: ${err.message}`);
  }

  if (alarmsRaised === 0) {
    console.log(`${LOG_PREFIX} All ${checksRun} checks green`);
  } else {
    console.warn(`${LOG_PREFIX} ${alarmsRaised}/${checksRun} checks raised alarms`);
  }

  return { checks_run: checksRun, alarms_raised: alarmsRaised };
}

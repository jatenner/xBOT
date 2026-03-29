#!/usr/bin/env tsx
/**
 * LIVE STATUS DASHBOARD
 *
 * Comprehensive terminal dashboard showing current xBOT state.
 * Usage: npx tsx scripts/ops/live-status.ts
 */

import './load-env';
import { getSupabaseClient } from '../../src/db/index';

// ── helpers ──────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) return 'in the future';
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ${min % 60}m ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ${hr % 24}h ago`;
}

function truncate(s: string | null | undefined, max: number): string {
  if (!s) return '(empty)';
  const clean = s.replace(/\n/g, ' ').trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1) + '\u2026';
}

function header(title: string) {
  const bar = '\u2500'.repeat(62);
  console.log(`\n\u250C${bar}\u2510`);
  console.log(`\u2502  ${title.padEnd(60)}\u2502`);
  console.log(`\u2514${bar}\u2518`);
}

function pad(label: string, width = 24): string {
  return ('  ' + label + ':').padEnd(width);
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  const s = getSupabaseClient();
  const now = Date.now();

  console.log();
  console.log('  ====  xBOT LIVE STATUS  ====  ' + new Date().toISOString());

  // ── ACCOUNT STATUS ─────────────────────────────────────────────────

  header('ACCOUNT STATUS');

  const username = process.env.TWITTER_USERNAME || '(not set)';
  console.log(`${pad('Username')}@${username}`);

  const rampStartEnv = process.env.RAMP_START_DATE;
  if (rampStartEnv) {
    const rampStart = new Date(rampStartEnv);
    const dayNumber = Math.max(1, Math.ceil((now - rampStart.getTime()) / (24 * 60 * 60 * 1000)));
    console.log(`${pad('Ramp start')}${rampStartEnv}`);
    console.log(`${pad('Ramp day')}${dayNumber}`);

    // Count actions today
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: actionsToday } = await s
      .from('content_generation_metadata_comprehensive')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'posted')
      .gte('posted_at', todayStart.toISOString());

    const RAMP_SCHEDULE: Record<number, number> = { 1: 2, 2: 4, 3: 6, 4: 10, 5: 15 };
    const maxActions = RAMP_SCHEDULE[dayNumber] ?? null;
    const limitStr = maxActions !== null ? `${actionsToday ?? 0}/${maxActions}` : `${actionsToday ?? 0} (no ramp limit)`;
    console.log(`${pad('Actions today')}${limitStr}`);
  } else {
    console.log(`${pad('Ramp start')}(RAMP_START_DATE not set)`);
  }

  // ── LAST 5 ACTIONS ────────────────────────────────────────────────

  header('LAST 5 ACTIONS');

  const { data: lastActions } = await s
    .from('content_generation_metadata_comprehensive')
    .select('posted_at, decision_type, content, tweet_id')
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(5);

  if (lastActions && lastActions.length > 0) {
    for (const a of lastActions) {
      const when = a.posted_at ? relativeTime(a.posted_at) : '??';
      const type = (a.decision_type || '??').padEnd(8);
      const text = truncate(a.content, 80);
      const tid = a.tweet_id ? a.tweet_id : 'no-id';
      console.log(`  ${when.padEnd(14)} ${type} ${tid}`);
      console.log(`${''.padEnd(25)}${text}`);
    }
  } else {
    console.log('  (no posted actions found)');
  }

  // ── QUEUE STATUS ──────────────────────────────────────────────────

  header('QUEUE STATUS');

  const { count: qReplies } = await s
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .eq('decision_type', 'reply');

  const { count: qSingles } = await s
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .eq('decision_type', 'single');

  const { count: qThreads } = await s
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .eq('decision_type', 'thread');

  console.log(`${pad('Queued replies')}${qReplies ?? 0}`);
  console.log(`${pad('Queued singles')}${qSingles ?? 0}`);
  console.log(`${pad('Queued threads')}${qThreads ?? 0}`);

  const { data: nextQueued } = await s
    .from('content_generation_metadata_comprehensive')
    .select('scheduled_at')
    .eq('status', 'queued')
    .not('scheduled_at', 'is', null)
    .order('scheduled_at', { ascending: true })
    .limit(1);

  if (nextQueued && nextQueued.length > 0 && nextQueued[0].scheduled_at) {
    const scheduledAt = new Date(nextQueued[0].scheduled_at);
    const diff = scheduledAt.getTime() - now;
    const label = diff > 0 ? `in ${Math.round(diff / 60000)}m` : relativeTime(nextQueued[0].scheduled_at);
    console.log(`${pad('Next scheduled')}${nextQueued[0].scheduled_at} (${label})`);
  } else {
    console.log(`${pad('Next scheduled')}(none)`);
  }

  // ── REPLY DISCOVERY ───────────────────────────────────────────────

  header('REPLY DISCOVERY');

  const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();

  const { count: replyOpps } = await s
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);

  const { count: candEvals } = await s
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);

  console.log(`${pad('Opportunities (1h)')}${replyOpps ?? 0}`);
  console.log(`${pad('Evaluations (1h)')}${candEvals ?? 0}`);

  // ── METRICS HEALTH ────────────────────────────────────────────────

  header('METRICS HEALTH');

  const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const thirtyMinAgo = new Date(now - 30 * 60 * 1000).toISOString();

  const { count: withViews } = await s
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .not('views', 'is', null)
    .gte('updated_at', twoHoursAgo);

  const { count: missingViews } = await s
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .is('views', null)
    .lte('posted_at', thirtyMinAgo);

  console.log(`${pad('Views updated (2h)')}${withViews ?? 0}`);
  console.log(`${pad('Missing views (>30m)')}${missingViews ?? 0}`);

  // ── SYSTEM EVENTS ─────────────────────────────────────────────────

  header('SYSTEM EVENTS (last 3)');

  const { data: events } = await s
    .from('system_events')
    .select('event_type, severity, message, created_at')
    .order('created_at', { ascending: false })
    .limit(3);

  if (events && events.length > 0) {
    for (const ev of events) {
      const when = ev.created_at ? relativeTime(ev.created_at) : '??';
      const sev = (ev.severity || 'info').toUpperCase().padEnd(5);
      const msg = truncate(ev.message, 50);
      console.log(`  ${when.padEnd(14)} [${sev}] ${ev.event_type || '??'}`);
      if (ev.message) {
        console.log(`${''.padEnd(25)}${msg}`);
      }
    }
  } else {
    console.log('  (no events found)');
  }

  // ── ENV FLAGS ─────────────────────────────────────────────────────

  header('ENV FLAGS');

  const flags = [
    'X_ACTIONS_ENABLED',
    'SHADOW_MODE',
    'POSTING_ENABLED',
    'ENABLE_REPLIES',
    'RUNNER_MODE',
  ];

  for (const flag of flags) {
    const val = process.env[flag];
    console.log(`${pad(flag)}${val ?? '(not set)'}`);
  }

  console.log();
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});

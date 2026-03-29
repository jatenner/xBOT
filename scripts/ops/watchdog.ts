#!/usr/bin/env tsx
/**
 * WATCHDOG — Continuous background monitor for xBOT health
 *
 * Runs every 5 minutes, checking for:
 *   1. Stale posts (posted but no views scraped)
 *   2. Session auth freshness
 *   3. Crash loop danger
 *   4. Queue starvation
 *   5. Ramp budget usage
 *
 * Usage: npx tsx scripts/ops/watchdog.ts
 */

import './load-env';
import { getSupabaseClient } from '../../src/db/index';
import fs from 'fs';
import path from 'path';

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const ROOT = process.cwd();

let running = true;

function ts(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function ageMinutes(dateStr: string | Date): number {
  return Math.round((Date.now() - new Date(dateStr).getTime()) / 60_000);
}

// ─── 1. Stale Posts ──────────────────────────────────────────────────────────
async function checkStalePosts(s: ReturnType<typeof getSupabaseClient>, warnings: string[]) {
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();

  // Posts older than 30 min that are still posted
  const { data: stalePosts, error } = await s
    .from('content_generation_metadata_comprehensive')
    .select('id, posted_at, tweet_id')
    .eq('status', 'posted')
    .lt('posted_at', thirtyMinAgo)
    .order('posted_at', { ascending: false })
    .limit(20);

  if (error) {
    warnings.push(`STALE CHECK DB ERROR: ${error.message}`);
    return;
  }

  if (!stalePosts || stalePosts.length === 0) return;

  // For each stale post, check if outcomes have views
  for (const post of stalePosts) {
    const tweetId = post.tweet_id;
    if (!tweetId) continue;

    const { data: outcome } = await s
      .from('content_outcomes')
      .select('views')
      .eq('tweet_id', tweetId)
      .maybeSingle();

    if (!outcome || outcome.views === null || outcome.views === undefined) {
      const ago = ageMinutes(post.posted_at);
      warnings.push(`STALE: tweet ${tweetId} posted ${ago} min ago but views still null — possible shadowban or scraper failure`);
    }
  }
}

// ─── 2. Session Health ───────────────────────────────────────────────────────
function checkSessionHealth(warnings: string[]) {
  const authPath = path.join(ROOT, '.runner-profile', 'AUTH_OK.json');
  if (!fs.existsSync(authPath)) {
    warnings.push('AUTH: AUTH_OK.json does not exist — session may not be bootstrapped');
    return;
  }

  const stat = fs.statSync(authPath);
  const ageMins = Math.round((Date.now() - stat.mtimeMs) / 60_000);

  if (ageMins > 30) {
    warnings.push(`AUTH: AUTH_OK.json is stale (${ageMins} min old)`);
  }
}

// ─── 3. Crash Loop ──────────────────────────────────────────────────────────
function checkCrashLoop(warnings: string[]) {
  const restartPath = path.join(ROOT, '.xbot-restarts.json');
  if (!fs.existsSync(restartPath)) return;

  try {
    const data = JSON.parse(fs.readFileSync(restartPath, 'utf-8'));

    // Check cooldown
    if (data.cooldownUntil && new Date(data.cooldownUntil) > new Date()) {
      const remaining = Math.round((new Date(data.cooldownUntil).getTime() - Date.now()) / 60_000);
      warnings.push(`CRASH LOOP: Cooldown active (${remaining} min remaining) — rm .xbot-restarts.json to clear`);
      return;
    }

    // Check recent restart density: ≥2 restarts in last 15 min
    if (Array.isArray(data.timestamps)) {
      const fifteenMinAgo = Date.now() - 15 * 60_000;
      const recent = data.timestamps.filter((t: string | number) => new Date(t).getTime() > fifteenMinAgo);
      if (recent.length >= 2) {
        warnings.push(`CRASH LOOP: ${recent.length} restarts in last 15 min — approaching danger threshold`);
      }
    } else if (typeof data.count === 'number' && data.count >= 2) {
      // Simpler format: just a count field
      warnings.push(`CRASH LOOP: restart count=${data.count} — approaching danger threshold`);
    }
  } catch {
    // Malformed file, not critical
  }
}

// ─── 4. Queue Starvation ─────────────────────────────────────────────────────
async function checkQueueStarvation(s: ReturnType<typeof getSupabaseClient>, warnings: string[]) {
  const { count, error } = await s
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued');

  if (error) {
    warnings.push(`QUEUE CHECK DB ERROR: ${error.message}`);
    return;
  }

  if ((count ?? 0) === 0) {
    warnings.push('QUEUE: Empty queue — plan job may not be generating content');
  }
}

// ─── 5. Ramp Budget ─────────────────────────────────────────────────────────
async function checkRampBudget(s: ReturnType<typeof getSupabaseClient>, warnings: string[]) {
  const RAMP_SCHEDULE = [
    { day: 1, maxActions: 2 },
    { day: 2, maxActions: 4 },
    { day: 3, maxActions: 6 },
    { day: 4, maxActions: 10 },
    { day: 5, maxActions: 15 },
  ];

  const rampStartEnv = process.env.RAMP_START_DATE;
  let dayNumber: number;

  if (rampStartEnv) {
    const parsed = new Date(rampStartEnv);
    if (isNaN(parsed.getTime())) {
      warnings.push('RAMP: RAMP_START_DATE env is set but not a valid date');
      return;
    }
    dayNumber = Math.max(1, Math.ceil((Date.now() - parsed.getTime()) / (24 * 60 * 60 * 1000)));
  } else {
    dayNumber = 1; // No ramp date set — assume day 1
  }

  const rampEntry = RAMP_SCHEDULE.find(r => r.day === dayNumber);
  const maxActions = rampEntry ? rampEntry.maxActions : null; // null = no ramp limit

  // Count posted today
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count: actionsToday, error } = await s
    .from('content_generation_metadata_comprehensive')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'posted')
    .gte('posted_at', todayStart.toISOString());

  if (error) {
    warnings.push(`RAMP CHECK DB ERROR: ${error.message}`);
    return;
  }

  const used = actionsToday ?? 0;
  const limit = maxActions !== null ? String(maxActions) : 'unlimited';

  // This is informational, always print it (not a warning)
  console.log(`  RAMP: Day ${dayNumber}, ${used}/${limit} actions used`);

  if (maxActions !== null && used >= maxActions) {
    warnings.push(`RAMP: Day ${dayNumber} budget exhausted (${used}/${maxActions})`);
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
async function runCycle() {
  const s = getSupabaseClient();
  const warnings: string[] = [];

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  WATCHDOG  ${ts()}`);
  console.log('═'.repeat(60));

  try { await checkStalePosts(s, warnings); } catch (e: any) { warnings.push(`STALE CHECK ERROR: ${e.message}`); }
  try { checkSessionHealth(warnings); } catch (e: any) { warnings.push(`SESSION CHECK ERROR: ${e.message}`); }
  try { checkCrashLoop(warnings); } catch (e: any) { warnings.push(`CRASH CHECK ERROR: ${e.message}`); }
  try { await checkQueueStarvation(s, warnings); } catch (e: any) { warnings.push(`QUEUE CHECK ERROR: ${e.message}`); }
  try { await checkRampBudget(s, warnings); } catch (e: any) { warnings.push(`RAMP CHECK ERROR: ${e.message}`); }

  if (warnings.length === 0) {
    console.log('  All clear');
  } else {
    for (const w of warnings) {
      console.log(`  ${w}`);
    }
  }

  console.log('─'.repeat(60));
}

async function main() {
  console.log(`[watchdog] Starting continuous monitor (interval=${INTERVAL_MS / 1000}s)`);
  console.log('[watchdog] Press Ctrl+C to stop\n');

  // Run immediately, then on interval
  await runCycle();

  while (running) {
    await new Promise(resolve => setTimeout(resolve, INTERVAL_MS));
    if (!running) break;
    await runCycle();
  }
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`\n[watchdog] Received ${signal} — shutting down gracefully`);
  running = false;
  // Force exit after 3s if something is stuck
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch(e => {
  console.error('[watchdog] Fatal:', e.message);
  process.exit(1);
});

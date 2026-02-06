/**
 * 🛡️ ACTION GATE - X Safety System
 *
 * Prevents bot-like retry/reply patterns that cause X suspension.
 * Enforces: read-only mode, crash-loop kill switch, pacing caps, 72h warmup.
 *
 * NON-NEGOTIABLES:
 * - X_ACTIONS_ENABLED=false → no reply, compose, like, repost, follow, submit
 * - Crash-loop (≥2 restarts in 15 min) → 6h cooldown (env cannot override)
 * - X_WARMUP_UNTIL_ISO → force actions off until timestamp
 * - Caps: X_MAX_ACTIONS_PER_HOUR, X_MAX_ACTIONS_PER_DAY, jitter
 */

import * as fs from 'fs';
import * as path from 'path';

// Env-configurable (defaults per spec)
const X_ACTIONS_ENABLED = process.env.X_ACTIONS_ENABLED === 'true';
const X_MAX_ACTIONS_PER_HOUR = parseInt(process.env.X_MAX_ACTIONS_PER_HOUR || '1', 10);
const X_MAX_ACTIONS_PER_DAY = parseInt(process.env.X_MAX_ACTIONS_PER_DAY || '3', 10);
const X_ACTION_JITTER_SECONDS_MIN = parseInt(process.env.X_ACTION_JITTER_SECONDS_MIN || '30', 10);
const X_ACTION_JITTER_SECONDS_MAX = parseInt(process.env.X_ACTION_JITTER_SECONDS_MAX || '180', 10);
const X_WARMUP_UNTIL_ISO = process.env.X_WARMUP_UNTIL_ISO || null; // Optional: ISO timestamp

// Crash-loop detection: file path for boot timestamps (survives restarts)
const RESTART_TRACK_PATH = process.env.X_SAFETY_RESTART_TRACK_PATH || path.join(process.cwd(), '.xbot-restarts.json');

interface RestartTrack {
  boots: string[]; // ISO timestamps
  cooldownUntil: string | null; // ISO timestamp
}

function readRestartTrack(): RestartTrack {
  try {
    if (fs.existsSync(RESTART_TRACK_PATH)) {
      const raw = fs.readFileSync(RESTART_TRACK_PATH, 'utf-8');
      const parsed = JSON.parse(raw) as RestartTrack;
      return {
        boots: Array.isArray(parsed.boots) ? parsed.boots : [],
        cooldownUntil: parsed.cooldownUntil || null,
      };
    }
  } catch {
    // Ignore
  }
  return { boots: [], cooldownUntil: null };
}

function writeRestartTrack(track: RestartTrack): void {
  try {
    fs.writeFileSync(RESTART_TRACK_PATH, JSON.stringify(track, null, 0), 'utf-8');
  } catch {
    // Best-effort; don't throw
  }
}

const FIFTEEN_MIN_MS = 15 * 60 * 1000;
const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/** In-memory action counters (per process) */
const actionTimestamps: number[] = [];
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Initialize crash-loop tracking on module load */
function initCrashLoopTracking(): void {
  const track = readRestartTrack();
  const now = Date.now();
  const nowIso = new Date().toISOString();

  // Check if cooldown is still active
  if (track.cooldownUntil) {
    const cooldownUntilMs = new Date(track.cooldownUntil).getTime();
    if (now < cooldownUntilMs) {
      console.log(`[X_SAFETY] cooldown engaged — actions disabled until ${track.cooldownUntil}`);
      return;
    }
    // Cooldown expired; clear it
    track.cooldownUntil = null;
  }

  // Add current boot
  track.boots.push(nowIso);

  // Prune boots older than 15 minutes
  const cutoff = now - FIFTEEN_MIN_MS;
  track.boots = track.boots.filter((iso) => new Date(iso).getTime() >= cutoff);

  // If ≥3 boots in 15 min (= 2 restarts), engage cooldown
  if (track.boots.length >= 3) {
    const cooldownUntil = new Date(now + SIX_HOURS_MS).toISOString();
    track.cooldownUntil = cooldownUntil;
    track.boots = []; // Reset
    writeRestartTrack(track);
    console.log(`[X_SAFETY] cooldown engaged — actions disabled until ${cooldownUntil}`);
    return;
  }

  writeRestartTrack(track);
}

initCrashLoopTracking();

export interface ActionGateResult {
  allowed: boolean;
  reason?: string;
  jitterMs?: number;
}

/** Check if X actions (reply, compose, like, repost, follow, submit) are allowed */
export function checkActionGate(actionName: string): ActionGateResult {
  // 1. Warmup: X_WARMUP_UNTIL_ISO
  if (X_WARMUP_UNTIL_ISO) {
    const warmupUntil = new Date(X_WARMUP_UNTIL_ISO).getTime();
    if (Date.now() < warmupUntil) {
      console.log(`[X_ACTIONS] disabled — skipping ${actionName} (warmup until ${X_WARMUP_UNTIL_ISO})`);
      return { allowed: false, reason: `warmup until ${X_WARMUP_UNTIL_ISO}` };
    }
  }

  // 2. Cooldown (crash-loop kill switch)
  const track = readRestartTrack();
  if (track.cooldownUntil) {
    const cooldownUntilMs = new Date(track.cooldownUntil).getTime();
    if (Date.now() < cooldownUntilMs) {
      console.log(`[X_ACTIONS] disabled — skipping ${actionName} (cooldown until ${track.cooldownUntil})`);
      return { allowed: false, reason: `cooldown until ${track.cooldownUntil}` };
    }
  }

  // 3. X_ACTIONS_ENABLED env
  if (!X_ACTIONS_ENABLED) {
    console.log(`[X_ACTIONS] disabled — skipping ${actionName}`);
    return { allowed: false, reason: 'X_ACTIONS_ENABLED=false' };
  }

  // 4. Pacing: hourly cap
  const now = Date.now();
  const hourAgo = now - HOUR_MS;
  const actionsLastHour = actionTimestamps.filter((t) => t >= hourAgo).length;
  if (actionsLastHour >= X_MAX_ACTIONS_PER_HOUR) {
    console.log(`[X_ACTIONS] cap hit — skipping ${actionName} (hourly: ${actionsLastHour}/${X_MAX_ACTIONS_PER_HOUR})`);
    return { allowed: false, reason: `hourly cap: ${actionsLastHour}/${X_MAX_ACTIONS_PER_HOUR}` };
  }

  // 5. Pacing: daily cap
  const dayAgo = now - DAY_MS;
  const actionsLastDay = actionTimestamps.filter((t) => t >= dayAgo).length;
  if (actionsLastDay >= X_MAX_ACTIONS_PER_DAY) {
    console.log(`[X_ACTIONS] cap hit — skipping ${actionName} (daily: ${actionsLastDay}/${X_MAX_ACTIONS_PER_DAY})`);
    return { allowed: false, reason: `daily cap: ${actionsLastDay}/${X_MAX_ACTIONS_PER_DAY}` };
  }

  // 6. Jitter: random delay before action
  const jitterMin = Math.max(0, X_ACTION_JITTER_SECONDS_MIN) * 1000;
  const jitterMax = Math.max(jitterMin, X_ACTION_JITTER_SECONDS_MAX) * 1000;
  const jitterMs = Math.floor(jitterMin + Math.random() * (jitterMax - jitterMin));

  return { allowed: true, jitterMs };
}

/** Record that an X action was performed (call after successful action) */
export function recordAction(): void {
  actionTimestamps.push(Date.now());
}

/** Whether X actions are effectively enabled (for /status) */
export function isXActionsEnabled(): boolean {
  if (X_WARMUP_UNTIL_ISO) {
    const warmupUntil = new Date(X_WARMUP_UNTIL_ISO).getTime();
    if (Date.now() < warmupUntil) return false;
  }
  const track = readRestartTrack();
  if (track.cooldownUntil) {
    const cooldownUntilMs = new Date(track.cooldownUntil).getTime();
    if (Date.now() < cooldownUntilMs) return false;
  }
  return X_ACTIONS_ENABLED;
}

/** Whether migrations are enabled (for /status) */
export function isMigrationsEnabled(): boolean {
  return process.env.RUN_MIGRATIONS_ENABLED === 'true';
}

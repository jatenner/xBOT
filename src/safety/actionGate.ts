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
import { isShadowMode } from './shadowMode';

// Env-configurable (defaults per spec). Read at check time so executor-daemon / shell can set after dotenv.
function getXActionsEnabled(): boolean {
  return process.env.X_ACTIONS_ENABLED === 'true';
}
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

/** Proof logging: source of cooldown truth (file path, values used). */
function logCooldownProof(
  source: 'restart_track_file',
  path: string,
  cooldownUntil: string | null,
  nowIso: string,
  remainingSeconds: number | null,
  action: 'blocked' | 'expired_cleared'
): void {
  if (action === 'blocked') {
    console.log(
      `[X_SAFETY] cooldown proof source=${source} path=${path} cooldown_until=${cooldownUntil ?? 'none'} now_iso=${nowIso} remaining_seconds=${remainingSeconds ?? 0} action=blocked`
    );
  } else {
    console.log(
      `[X_SAFETY] cooldown proof source=${source} path=${path} cooldown_until=${cooldownUntil} now_iso=${nowIso} action=expired_cleared`
    );
  }
}

/**
 * If cooldown is set but expired, clear it and persist so future reads see correct state.
 * Returns true if cooldown is still active, false if no cooldown or expired (and cleared).
 */
function clearExpiredCooldownIfNeeded(track: RestartTrack): boolean {
  if (!track.cooldownUntil) return false;
  const now = Date.now();
  const cooldownUntilMs = new Date(track.cooldownUntil).getTime();
  if (now < cooldownUntilMs) return true; // Still active
  const wasUntil = track.cooldownUntil;
  track.cooldownUntil = null;
  writeRestartTrack(track);
  logCooldownProof(
    'restart_track_file',
    RESTART_TRACK_PATH,
    wasUntil,
    new Date().toISOString(),
    null,
    'expired_cleared'
  );
  console.log(`[X_SAFETY] cooldown expired (was until ${wasUntil}), cleared and persisted`);
  return false;
}

/** In-memory action counters (per process) */
const actionTimestamps: number[] = [];
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** True when running ops proof (Gate 1, etc.) - skip crash-loop tracking and cooldown for local proof runs only */
function isProofMode(): boolean {
  return process.env.PROOF_MODE === 'true';
}

/** Initialize crash-loop tracking on module load */
function initCrashLoopTracking(): void {
  // LOCAL-ONLY: Proof runs must not add boots or be blocked by cooldown (Railway never sets PROOF_MODE)
  if (isProofMode()) {
    return;
  }

  const track = readRestartTrack();
  const now = Date.now();
  const nowIso = new Date().toISOString();

  // Check if cooldown is still active (source: restart_track_file)
  if (track.cooldownUntil) {
    const cooldownUntilMs = new Date(track.cooldownUntil).getTime();
    if (now < cooldownUntilMs) {
      const remainingSeconds = Math.ceil((cooldownUntilMs - now) / 1000);
      console.log(
        `[X_SAFETY] cooldown engaged — actions disabled until ${track.cooldownUntil} source=restart_track_file path=${RESTART_TRACK_PATH} remaining_seconds=${remainingSeconds}`
      );
      return;
    }
    // Cooldown expired; clear it and persist
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
  // 0. Shadow Mode: read-only when enabled (default ON when unset; explicit false/blank = off)
  if (isShadowMode()) {
    console.log(`[X_ACTIONS] disabled — skipping ${actionName} (SHADOW_MODE=read-only)`);
    return { allowed: false, reason: 'SHADOW_MODE=read-only - no posts/replies/likes/follows' };
  }

  // 1. Warmup: X_WARMUP_UNTIL_ISO
  if (X_WARMUP_UNTIL_ISO) {
    const warmupUntil = new Date(X_WARMUP_UNTIL_ISO).getTime();
    if (Date.now() < warmupUntil) {
      console.log(`[X_ACTIONS] disabled — skipping ${actionName} (warmup until ${X_WARMUP_UNTIL_ISO})`);
      return { allowed: false, reason: `warmup until ${X_WARMUP_UNTIL_ISO}` };
    }
  }

  // 2. Cooldown (crash-loop kill switch) — skipped for proof runs (local-only)
  // Source of truth: .xbot-restarts.json (RESTART_TRACK_PATH). Independent of REPLY_QUOTA.
  if (!isProofMode()) {
    const track = readRestartTrack();
    if (track.cooldownUntil) {
      const now = Date.now();
      const cooldownUntilMs = new Date(track.cooldownUntil).getTime();
      const stillActive = clearExpiredCooldownIfNeeded(track);
      if (stillActive) {
        const remainingSeconds = Math.max(0, Math.ceil((cooldownUntilMs - now) / 1000));
        logCooldownProof(
          'restart_track_file',
          RESTART_TRACK_PATH,
          track.cooldownUntil,
          new Date().toISOString(),
          remainingSeconds,
          'blocked'
        );
        console.log(`[X_ACTIONS] disabled — skipping ${actionName} (cooldown until ${track.cooldownUntil})`);
        return { allowed: false, reason: `cooldown until ${track.cooldownUntil}` };
      }
    }
  }

  // 3. X_ACTIONS_ENABLED env (read at check time for controlled-live audit)
  const xActionsEnabled = getXActionsEnabled();
  if (!xActionsEnabled) {
    console.log(`[X_ACTIONS] disabled — skipping ${actionName} (X_ACTIONS_ENABLED=${process.env.X_ACTIONS_ENABLED ?? 'unset'})`);
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
  if (isShadowMode()) return false;
  if (X_WARMUP_UNTIL_ISO) {
    const warmupUntil = new Date(X_WARMUP_UNTIL_ISO).getTime();
    if (Date.now() < warmupUntil) return false;
  }
  if (!isProofMode()) {
    const track = readRestartTrack();
    if (track.cooldownUntil) {
      clearExpiredCooldownIfNeeded(track);
      if (track.cooldownUntil) {
        const cooldownUntilMs = new Date(track.cooldownUntil).getTime();
        if (Date.now() < cooldownUntilMs) return false;
      }
    }
  }
  return getXActionsEnabled();
}

/** Cooldown status for proof/observability (source, path, expiry, remaining). Never expires cooldown. */
export interface CooldownStatus {
  source: 'restart_track_file' | 'none';
  path: string | null;
  cooldown_until: string | null;
  now_iso: string;
  remaining_seconds: number | null;
  active: boolean;
}

/** Get current cooldown status (read-only; does not clear expired). For /status and logs. */
export function getCooldownStatus(): CooldownStatus {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  if (isProofMode()) {
    return { source: 'none', path: null, cooldown_until: null, now_iso: nowIso, remaining_seconds: null, active: false };
  }
  const track = readRestartTrack();
  if (!track.cooldownUntil) {
    return { source: 'restart_track_file', path: RESTART_TRACK_PATH, cooldown_until: null, now_iso: nowIso, remaining_seconds: null, active: false };
  }
  const cooldownUntilMs = new Date(track.cooldownUntil).getTime();
  const active = now < cooldownUntilMs;
  const remainingSeconds = active ? Math.max(0, Math.ceil((cooldownUntilMs - now) / 1000)) : null;
  return {
    source: 'restart_track_file',
    path: RESTART_TRACK_PATH,
    cooldown_until: track.cooldownUntil,
    now_iso: nowIso,
    remaining_seconds: remainingSeconds,
    active,
  };
}

/** Whether migrations are enabled (for /status) */
export function isMigrationsEnabled(): boolean {
  return process.env.RUN_MIGRATIONS_ENABLED === 'true';
}

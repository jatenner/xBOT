/**
 * 🛡️ HARVEST BACKOFF - Persistent Rate Limit Circuit Breaker
 * 
 * Manages persistent backoff state to prevent repeated 429 hits.
 * Uses file-based storage in .runner-profile/harvest-backoff.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { ensureRunnerProfileDir } from '../infra/runnerProfile';

interface BackoffState {
  blocked_until: string | null; // ISO timestamp
  last_429_at: string | null; // ISO timestamp
  consecutive_429s: number;
}

const BACKOFF_FILE = path.join(ensureRunnerProfileDir(), 'harvest-backoff.json');

function readBackoffState(): BackoffState {
  try {
    if (fs.existsSync(BACKOFF_FILE)) {
      const content = fs.readFileSync(BACKOFF_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      return {
        blocked_until: parsed.blocked_until || null,
        last_429_at: parsed.last_429_at || null,
        consecutive_429s: parsed.consecutive_429s || 0,
      };
    }
  } catch (error) {
    console.warn(`[HARVEST_BACKOFF] Failed to read backoff state: ${error}`);
  }
  return {
    blocked_until: null,
    last_429_at: null,
    consecutive_429s: 0,
  };
}

function writeBackoffState(state: BackoffState): void {
  try {
    ensureRunnerProfileDir();
    fs.writeFileSync(BACKOFF_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch (error) {
    console.error(`[HARVEST_BACKOFF] Failed to write backoff state: ${error}`);
  }
}

/**
 * Check if harvest is currently blocked
 */
export function isHarvestBlocked(): { blocked: boolean; blockedUntil: Date | null; minutesRemaining: number } {
  const state = readBackoffState();
  
  if (!state.blocked_until) {
    return { blocked: false, blockedUntil: null, minutesRemaining: 0 };
  }
  
  const blockedUntil = new Date(state.blocked_until);
  const now = new Date();
  
  if (now < blockedUntil) {
    const minutesRemaining = Math.ceil((blockedUntil.getTime() - now.getTime()) / (60 * 1000));
    return { blocked: true, blockedUntil, minutesRemaining };
  }
  
  // Block expired, clear it
  writeBackoffState({
    blocked_until: null,
    last_429_at: state.last_429_at,
    consecutive_429s: 0,
  });
  
  return { blocked: false, blockedUntil: null, minutesRemaining: 0 };
}

/**
 * Record a 429 rate limit hit and set backoff
 */
export function record429Hit(): void {
  const state = readBackoffState();
  const now = new Date();
  const nowISO = now.toISOString();
  
  let blockedUntil: Date;
  let backoffMinutes: number;
  
  // Check if we had a 429 within the last 2 hours
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const hadRecent429 = state.last_429_at && new Date(state.last_429_at) > twoHoursAgo;
  
  if (hadRecent429 || state.consecutive_429s > 0) {
    // Extended backoff: 60 minutes
    backoffMinutes = 60;
    blockedUntil = new Date(now.getTime() + 60 * 60 * 1000);
  } else {
    // Initial backoff: 15 minutes
    backoffMinutes = 15;
    blockedUntil = new Date(now.getTime() + 15 * 60 * 1000);
  }
  
  const newState: BackoffState = {
    blocked_until: blockedUntil.toISOString(),
    last_429_at: nowISO,
    consecutive_429s: state.consecutive_429s + 1,
  };
  
  writeBackoffState(newState);
  
  console.log(`[RATE_LIMIT] detected=true; backing_off_minutes=${backoffMinutes}`);
}

/**
 * Clear backoff (for testing or manual override)
 */
export function clearBackoff(): void {
  writeBackoffState({
    blocked_until: null,
    last_429_at: null,
    consecutive_429s: 0,
  });
}

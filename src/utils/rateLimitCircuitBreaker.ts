/**
 * Global Rate Limit Circuit Breaker
 * 
 * Stores rate limit state in runner profile to prevent executor from thrashing
 * when hitting HTTP 429 errors.
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveRunnerProfileDir } from '../infra/runnerProfile';
import { getSupabaseClient } from '../db/index';

interface RateLimitState {
  rate_limit_until: string | null; // ISO timestamp
  last_rate_limit_http_status: number | null;
  last_rate_limit_endpoint: string | null;
  last_rate_limit_reason: string | null;
}

const RATE_LIMIT_STATE_FILE = path.join(resolveRunnerProfileDir(), 'rate-limit-state.json');
const DEFAULT_BACKOFF_SECONDS = 600; // 10 minutes

/**
 * Get current rate limit state
 */
export function getRateLimitState(): RateLimitState {
  try {
    if (fs.existsSync(RATE_LIMIT_STATE_FILE)) {
      const content = fs.readFileSync(RATE_LIMIT_STATE_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error: any) {
    console.error(`[RATE_LIMIT_CB] Failed to read state: ${error.message}`);
  }
  
  return {
    rate_limit_until: null,
    last_rate_limit_http_status: null,
    last_rate_limit_endpoint: null,
    last_rate_limit_reason: null,
  };
}

/**
 * Set rate limit state (writes synchronously)
 */
export function setRateLimitState(state: Partial<RateLimitState>): void {
  try {
    const current = getRateLimitState();
    const updated = { ...current, ...state };
    fs.writeFileSync(RATE_LIMIT_STATE_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    console.log(`[RATE_LIMIT_CB] Updated state: rate_limit_until=${updated.rate_limit_until}`);
  } catch (error: any) {
    console.error(`[RATE_LIMIT_CB] Failed to write state: ${error.message}`);
  }
}

/**
 * Check if rate limit is currently active
 */
export function isRateLimitActive(): boolean {
  const state = getRateLimitState();
  if (!state.rate_limit_until) {
    return false;
  }
  
  const until = new Date(state.rate_limit_until);
  const now = new Date();
  return now < until;
}

/**
 * Get seconds remaining in rate limit backoff
 */
export function getRateLimitSecondsRemaining(): number {
  const state = getRateLimitState();
  if (!state.rate_limit_until) {
    return 0;
  }
  
  const until = new Date(state.rate_limit_until);
  const now = new Date();
  const remaining = Math.max(0, Math.floor((until.getTime() - now.getTime()) / 1000));
  return remaining;
}

/**
 * Record a 429 rate limit hit
 */
export async function recordRateLimitHit(
  endpoint: string,
  httpStatus: number = 429,
  reason?: string,
  decisionId?: string,
  backoffSeconds: number = DEFAULT_BACKOFF_SECONDS
): Promise<void> {
  const now = new Date();
  const until = new Date(now.getTime() + backoffSeconds * 1000);
  
  setRateLimitState({
    rate_limit_until: until.toISOString(),
    last_rate_limit_http_status: httpStatus,
    last_rate_limit_endpoint: endpoint,
    last_rate_limit_reason: reason || 'HTTP-429',
  });
  
  // Emit system event
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_RATE_LIMITED',
      severity: 'warning',
      message: `Rate limit hit: ${endpoint} (HTTP ${httpStatus})`,
      event_data: {
        until: until.toISOString(),
        http_status: httpStatus,
        endpoint,
        reason: reason || 'HTTP-429',
        decision_id: decisionId,
        backoff_seconds: backoffSeconds,
      },
      created_at: now.toISOString(),
    });
    console.log(`[RATE_LIMIT_CB] ✅ Recorded rate limit hit: ${endpoint} until ${until.toISOString()}`);
  } catch (error: any) {
    console.error(`[RATE_LIMIT_CB] Failed to emit event: ${error.message}`);
  }
}

/**
 * Emit backoff active event (called at start of executor tick)
 */
export async function emitBackoffActiveEvent(): Promise<void> {
  if (!isRateLimitActive()) {
    return;
  }
  
  const state = getRateLimitState();
  const secondsRemaining = getRateLimitSecondsRemaining();
  
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_RATE_LIMIT_BACKOFF_ACTIVE',
      severity: 'info',
      message: `Rate limit backoff active: ${secondsRemaining}s remaining`,
      event_data: {
        until: state.rate_limit_until,
        seconds_remaining: secondsRemaining,
        endpoint: state.last_rate_limit_endpoint,
        http_status: state.last_rate_limit_http_status,
      },
      created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`[RATE_LIMIT_CB] Failed to emit backoff event: ${error.message}`);
  }
}

/**
 * Clear rate limit state (when backoff expires or manually cleared)
 */
export function clearRateLimitState(): void {
  setRateLimitState({
    rate_limit_until: null,
    last_rate_limit_http_status: null,
    last_rate_limit_endpoint: null,
    last_rate_limit_reason: null,
  });
}

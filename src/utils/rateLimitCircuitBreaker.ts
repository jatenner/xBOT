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
  source_tag?: string | null; // Phase 5A.2: Source of rate limit (e.g., 'HTTP-429', 'SIMULATED', 'INFERRED')
  detected_at?: string | null; // Phase 5A.2: When rate limit was detected
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
  backoffSeconds: number = DEFAULT_BACKOFF_SECONDS,
  sourceTag?: string
): Promise<void> {
  const now = new Date();
  const until = new Date(now.getTime() + backoffSeconds * 1000);
  
  setRateLimitState({
    rate_limit_until: until.toISOString(),
    last_rate_limit_http_status: httpStatus,
    last_rate_limit_endpoint: endpoint,
    last_rate_limit_reason: reason || 'HTTP-429',
    source_tag: sourceTag || 'HTTP-429',
    detected_at: now.toISOString(),
  });
  
  // Phase 5A.2: Emit EXECUTOR_RATE_LIMIT_DETECTED event
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_RATE_LIMIT_DETECTED',
      severity: 'warning',
      message: `Rate limit detected: ${endpoint} (HTTP ${httpStatus})`,
      event_data: {
        ts: now.toISOString(),
        source_tag: sourceTag || 'HTTP-429',
        http_status: httpStatus,
        endpoint,
        reason: reason || 'HTTP-429',
        decision_id: decisionId || null,
        backoff_seconds: backoffSeconds,
        seconds_remaining: backoffSeconds,
        rate_limit_until: until.toISOString(),
        proof_mode: process.env.PROOF_MODE === 'true',
      },
      created_at: now.toISOString(),
    });
    console.log(`[RATE_LIMIT_CB] ✅ Rate limit detected: ${endpoint} until ${until.toISOString()}`);
  } catch (error: any) {
    console.error(`[RATE_LIMIT_CB] Failed to emit DETECTED event: ${error.message}`);
  }
}

/**
 * Emit backoff active event (called at start of executor tick)
 * Phase 5A.2: Now emits EXECUTOR_RATE_LIMIT_ACTIVE
 */
export async function emitBackoffActiveEvent(): Promise<void> {
  if (!isRateLimitActive()) {
    return;
  }
  
  const state = getRateLimitState();
  const secondsRemaining = getRateLimitSecondsRemaining();
  
  try {
    const supabase = getSupabaseClient();
    // Phase 5A.2: Emit EXECUTOR_RATE_LIMIT_ACTIVE (periodic heartbeat)
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_RATE_LIMIT_ACTIVE',
      severity: 'info',
      message: `Rate limit active: ${secondsRemaining}s remaining`,
      event_data: {
        ts: new Date().toISOString(),
        source_tag: state.source_tag || state.last_rate_limit_reason || 'UNKNOWN',
        http_status: state.last_rate_limit_http_status,
        endpoint: state.last_rate_limit_endpoint,
        seconds_remaining: secondsRemaining,
        rate_limit_until: state.rate_limit_until,
        detected_at: state.detected_at || null,
        proof_mode: process.env.PROOF_MODE === 'true',
      },
      created_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error(`[RATE_LIMIT_CB] Failed to emit ACTIVE event: ${error.message}`);
  }
}

// Track if CLEARED event was already emitted for current rate limit window (idempotency)
let clearedEventEmittedFor: string | null = null;

/**
 * Clear rate limit state (when backoff expires or manually cleared)
 * Phase 5A.2: Emits EXECUTOR_RATE_LIMIT_CLEARED event (idempotent)
 */
export async function clearRateLimitState(): Promise<void> {
  const state = getRateLimitState();
  const currentWindow = state.rate_limit_until || 'none';
  
  // Phase 5A.2: Check if rate limit was active (had a valid until timestamp)
  // We check BEFORE clearing state, because expired rate limits still have state
  const hadActiveRateLimit = state.rate_limit_until !== null;
  
  // Phase 5A.2: Emit EXECUTOR_RATE_LIMIT_CLEARED if it had an active rate limit and not already emitted for this window
  if (hadActiveRateLimit && clearedEventEmittedFor !== currentWindow) {
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'EXECUTOR_RATE_LIMIT_CLEARED',
        severity: 'info',
        message: 'Rate limit cleared',
        event_data: {
          ts: new Date().toISOString(),
          source_tag: state.source_tag || state.last_rate_limit_reason || 'UNKNOWN',
          http_status: state.last_rate_limit_http_status,
          endpoint: state.last_rate_limit_endpoint,
          detected_at: state.detected_at || null,
          proof_mode: process.env.PROOF_MODE === 'true',
        },
        created_at: new Date().toISOString(),
      });
      clearedEventEmittedFor = currentWindow; // Mark as emitted for this window
      console.log(`[RATE_LIMIT_CB] ✅ Rate limit cleared`);
    } catch (error: any) {
      console.error(`[RATE_LIMIT_CB] Failed to emit CLEARED event: ${error.message}`);
    }
  }
  
  // Clear state
  setRateLimitState({
    rate_limit_until: null,
    last_rate_limit_http_status: null,
    last_rate_limit_endpoint: null,
    last_rate_limit_reason: null,
    source_tag: null,
    detected_at: null,
  });
  
  // Reset cleared event tracking when state is fully cleared
  clearedEventEmittedFor = null;
}

/**
 * Phase 5A.2: Simulate rate limit (for proof scripts)
 */
export async function simulateRateLimit(seconds: number, sourceTag: string = 'SIMULATED'): Promise<void> {
  const now = new Date();
  const until = new Date(now.getTime() + seconds * 1000);
  
  setRateLimitState({
    rate_limit_until: until.toISOString(),
    last_rate_limit_http_status: 429,
    last_rate_limit_endpoint: 'simulated',
    last_rate_limit_reason: 'Simulated rate limit for proof',
    source_tag: sourceTag,
    detected_at: now.toISOString(),
  });
  
  // Emit DETECTED event
  await recordRateLimitHit('simulated', 429, 'Simulated rate limit for proof', undefined, seconds, sourceTag);
}

/**
 * Phase 5A.2: Emit BYPASS event when proof decision proceeds despite rate limit
 */
export async function emitRateLimitBypass(decisionId: string, proofTag?: string): Promise<void> {
  const state = getRateLimitState();
  const secondsRemaining = getRateLimitSecondsRemaining();
  
  try {
    const supabase = getSupabaseClient();
    await supabase.from('system_events').insert({
      event_type: 'EXECUTOR_RATE_LIMIT_BYPASS',
      severity: 'info',
      message: `Rate limit bypassed for proof decision: ${decisionId}`,
      event_data: {
        ts: new Date().toISOString(),
        decision_id: decisionId,
        proof_tag: proofTag || null,
        source_tag: state.source_tag || state.last_rate_limit_reason || 'UNKNOWN',
        http_status: state.last_rate_limit_http_status,
        seconds_remaining: secondsRemaining,
        rate_limit_until: state.rate_limit_until,
        proof_mode: true,
      },
      created_at: new Date().toISOString(),
    });
    console.log(`[RATE_LIMIT_CB] ⚠️ Rate limit bypassed for proof decision: ${decisionId}`);
  } catch (error: any) {
    console.error(`[RATE_LIMIT_CB] Failed to emit BYPASS event: ${error.message}`);
  }
}

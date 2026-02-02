#!/usr/bin/env tsx
/**
 * 📊 HARVEST BACKOFF STATUS
 * 
 * Shows current rate limit backoff status for harvest operations.
 * 
 * Usage:
 *   pnpm run ops:harvest:backoff:status
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveRunnerProfileDir } from '../../src/infra/runnerProfile';

interface BackoffState {
  blocked_until: string | null;
  last_429_at: string | null;
  consecutive_429s: number;
}

function main(): void {
  const profileDir = resolveRunnerProfileDir();
  const backoffFile = path.join(profileDir, 'harvest-backoff.json');

  if (!fs.existsSync(backoffFile)) {
    console.log(`[BACKOFF_STATUS] not_rate_limited=true`);
    console.log(`[BACKOFF_STATUS] No backoff file found at ${backoffFile}`);
    process.exit(0);
  }

  try {
    const content = fs.readFileSync(backoffFile, 'utf-8');
    const state: BackoffState = JSON.parse(content);

    if (!state.blocked_until) {
      console.log(`[BACKOFF_STATUS] not_rate_limited=true`);
      console.log(`[BACKOFF_STATUS] Backoff file exists but blocked_until is null`);
      process.exit(0);
    }

    const blockedUntil = new Date(state.blocked_until);
    const now = new Date();

    if (now >= blockedUntil) {
      console.log(`[BACKOFF_STATUS] not_rate_limited=true`);
      console.log(`[BACKOFF_STATUS] Backoff expired at ${blockedUntil.toISOString()}`);
      process.exit(0);
    }

    const minutesRemaining = Math.ceil((blockedUntil.getTime() - now.getTime()) / (60 * 1000));

    console.log(`[BACKOFF_STATUS] rate_limited=true`);
    console.log(`[BACKOFF_STATUS] blocked_until=${state.blocked_until}`);
    console.log(`[BACKOFF_STATUS] minutes_remaining=${minutesRemaining}`);
    console.log(`[BACKOFF_STATUS] consecutive_429s=${state.consecutive_429s}`);
    console.log(`[BACKOFF_STATUS] last_429_at=${state.last_429_at || 'N/A'}`);
    console.log(`[BACKOFF_STATUS] Retry after: ${blockedUntil.toISOString()}`);

    process.exit(0);
  } catch (error: any) {
    console.error(`[BACKOFF_STATUS] ERROR: Failed to read backoff file: ${error.message}`);
    process.exit(1);
  }
}

main();

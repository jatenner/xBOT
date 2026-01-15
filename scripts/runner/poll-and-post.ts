#!/usr/bin/env tsx
/**
 * 🏃 MAC RUNNER - Poll and Post
 * 
 * Polls Supabase for queued decisions every 60s and posts them using Playwright.
 * Uses persistent profile directory for X login persistence.
 * 
 * Usage:
 *   pnpm exec tsx scripts/runner/poll-and-post.ts
 *   pnpm exec tsx scripts/runner/poll-and-post.ts --once
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';
import { processPostingQueue } from '../../src/jobs/postingQueue';
import path from 'path';
import fs from 'fs';

// Override browser launcher to use persistent profile for runner
process.env.RUNNER_MODE = 'true';

const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
const MAX_DECISIONS_PER_POLL = parseInt(process.env.RUNNER_MAX_DECISIONS || '5', 10);
const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
const BACKOFF_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface BackoffState {
  active: boolean;
  reason: string;
  until: number; // timestamp
  attempts: number;
}

let backoffState: BackoffState = {
  active: false,
  reason: '',
  until: 0,
  attempts: 0,
};

/**
 * Check if we're in backoff period
 */
function isInBackoff(): boolean {
  if (!backoffState.active) return false;
  if (Date.now() >= backoffState.until) {
    console.log(`[RUNNER] ✅ Backoff expired (reason: ${backoffState.reason})`);
    backoffState.active = false;
    return false;
  }
  const remainingMinutes = Math.ceil((backoffState.until - Date.now()) / 60000);
  console.log(`[RUNNER] ⏸️  In backoff (reason: ${backoffState.reason}, ${remainingMinutes}m remaining)`);
  return true;
}

/**
 * Start backoff period
 */
async function startBackoff(reason: string): Promise<void> {
  backoffState = {
    active: true,
    reason,
    until: Date.now() + BACKOFF_DURATION_MS,
    attempts: backoffState.attempts + 1,
  };

  console.log(`[RUNNER] ⏸️  Starting backoff: ${reason} (30 minutes)`);

  // Emit RUNNER_ALERT system event
  const supabase = getSupabaseClient();
  await supabase.from('system_events').insert({
    event_type: 'RUNNER_ALERT',
    severity: 'warning',
    message: `Runner backoff activated: ${reason}`,
    event_data: {
      reason,
      backoff_until: new Date(backoffState.until).toISOString(),
      attempts: backoffState.attempts,
    },
    created_at: new Date().toISOString(),
  });
}

/**
 * Setup Playwright profile directory
 */
function setupProfileDirectory(): void {
  if (!fs.existsSync(RUNNER_PROFILE_DIR)) {
    fs.mkdirSync(RUNNER_PROFILE_DIR, { recursive: true });
    console.log(`[RUNNER] ✅ Created profile directory: ${RUNNER_PROFILE_DIR}`);
  }

  // Set PLAYWRIGHT_PROFILE_DIR env var for Playwright to use
  process.env.PLAYWRIGHT_PROFILE_DIR = RUNNER_PROFILE_DIR;
  process.env.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(process.cwd(), 'ms-playwright');
  
  console.log(`[RUNNER] 📁 Profile directory: ${RUNNER_PROFILE_DIR}`);
}

/**
 * Process one polling cycle
 */
async function pollAndPost(once: boolean): Promise<void> {
  if (isInBackoff()) {
    if (once) {
      console.log(`[RUNNER] ⏸️  Skipping poll (in backoff)`);
      process.exit(0);
    }
    return;
  }

  console.log(`[RUNNER] 🔍 Polling for queued decisions...`);

  try {
    // Use existing processPostingQueue function
    await processPostingQueue({
      certMode: false, // Process all decision types
      maxItems: MAX_DECISIONS_PER_POLL,
    });

    // Check for CONSENT_WALL or login failures in recent system_events
    const supabase = getSupabaseClient();
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: recentFailures } = await supabase
      .from('system_events')
      .select('event_type, message, event_data')
      .in('event_type', ['POST_FAILED', 'RUNNER_ALERT'])
      .gte('created_at', fiveMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentFailures && recentFailures.length > 0) {
      for (const failure of recentFailures) {
        const message = failure.message || '';
        const eventData = typeof failure.event_data === 'string'
          ? JSON.parse(failure.event_data)
          : failure.event_data || {};

        // Check for CONSENT_WALL
        if (message.includes('CONSENT_WALL') || eventData.deny_reason_code === 'CONSENT_WALL') {
          await startBackoff('CONSENT_WALL detected');
          return;
        }

        // Check for login required
        if (message.includes('login') || message.includes('not logged in') || message.includes('authentication')) {
          await startBackoff('Login required');
          return;
        }
      }
    }

    // Reset backoff attempts on success
    if (backoffState.attempts > 0) {
      console.log(`[RUNNER] ✅ Success after backoff, resetting attempts`);
      backoffState.attempts = 0;
    }

  } catch (error: any) {
    console.error(`[RUNNER] ❌ Poll error: ${error.message}`);
    
    // Check if error is CONSENT_WALL or login related
    const errorMsg = error.message.toLowerCase();
    if (errorMsg.includes('consent_wall') || errorMsg.includes('consent')) {
      await startBackoff('CONSENT_WALL error');
      return;
    }
    if (errorMsg.includes('login') || errorMsg.includes('not logged in') || errorMsg.includes('authentication')) {
      await startBackoff('Login error');
      return;
    }

    // For other errors, don't backoff (might be transient)
    console.log(`[RUNNER] ⚠️  Non-fatal error, continuing...`);
  }
}

async function main() {
  const once = process.argv.includes('--once');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🏃 MAC RUNNER - POLL AND POST');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Mode: ${once ? 'once (single poll)' : 'continuous (every 60s)'}`);
  console.log(`Max decisions per poll: ${MAX_DECISIONS_PER_POLL}`);
  console.log(`Profile directory: ${RUNNER_PROFILE_DIR}\n`);

  // Setup profile directory
  setupProfileDirectory();

  // Verify database connection
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('content_metadata').select('decision_id').limit(1);
    if (error) {
      console.error(`❌ Database connection failed: ${error.message}`);
      process.exit(1);
    }
    console.log(`✅ Database connection verified\n`);
  } catch (error: any) {
    console.error(`❌ Database setup failed: ${error.message}`);
    process.exit(1);
  }

  if (once) {
    // Single poll mode
    await pollAndPost(true);
    console.log(`\n✅ Single poll complete`);
    process.exit(0);
  }

  // Continuous polling mode
  console.log(`🚀 Starting continuous polling (every ${POLL_INTERVAL_MS / 1000}s)...\n`);

  while (true) {
    await pollAndPost(false);
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main().catch((error) => {
  console.error('❌ Runner failed:', error);
  process.exit(1);
});

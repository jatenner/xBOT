#!/usr/bin/env tsx
/**
 * 🔄 AUTO SYNC ENV FROM RAILWAY
 * 
 * Automatically syncs environment variables from Railway service "xBOT"
 * to .env.local. Called automatically by runner at startup and periodically.
 * 
 * Usage:
 *   pnpm run runner:autosync
 */

import { execSync } from 'child_process';

const SERVICE_NAME = 'xBOT';

/**
 * Run sync and handle errors
 */
async function main() {
  try {
    // Run sync script internally
    execSync('pnpm exec tsx scripts/runner/sync-env-from-railway.ts', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    console.log('[AUTO-SYNC] ✅ Sync completed successfully');
    process.exit(0);

  } catch (error: any) {
    console.error(`[AUTO-SYNC] ❌ Sync failed: ${error.message}`);

    // Write RUNNER_ALERT system event (lazy import to avoid env validation)
    try {
      // Load env after sync attempt (may have partial env from .env.local)
      const { getSupabaseClient } = await import('../../src/db');
      const supabase = getSupabaseClient();
      await supabase.from('system_events').insert({
        event_type: 'RUNNER_ALERT',
        severity: 'error',
        message: 'Env sync failed - runner may not start',
        event_data: {
          reason: 'ENV_SYNC_FAILED',
          error_message: error.message,
          service: SERVICE_NAME,
        },
        created_at: new Date().toISOString(),
      });
      console.log('[AUTO-SYNC] ✅ Wrote RUNNER_ALERT event to system_events');
    } catch (dbError: any) {
      console.error(`[AUTO-SYNC] ⚠️  Failed to write RUNNER_ALERT: ${dbError.message}`);
      console.error(`[AUTO-SYNC]    (This is expected if env vars are missing)`);
    }

    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Auto-sync script failed:', error);
  process.exit(1);
});

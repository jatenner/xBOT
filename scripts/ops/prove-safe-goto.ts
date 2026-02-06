#!/usr/bin/env tsx
/**
 * PROVE SAFE GOTO
 *
 * Opens https://x.com/home via safeGoto; logs SAFE_GOTO_OK or SAFE_GOTO_FAIL.
 *
 * Usage:
 *   railway run --service xBOT pnpm exec tsx scripts/ops/prove-safe-goto.ts
 */

import 'dotenv/config';
import { UnifiedBrowserPool } from '../../src/browser/UnifiedBrowserPool';
import { safeGoto } from '../../src/utils/safeGoto';

async function main(): Promise<void> {
  console.log('[PROVE_SAFE_GOTO] Starting: navigate to https://x.com/home via safeGoto\n');

  const pool = UnifiedBrowserPool.getInstance();
  let page = null;

  try {
    page = await pool.acquirePage('prove_safe_goto');
    const result = await safeGoto(page, 'https://x.com/home', {
      operation: 'prove_safe_goto',
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    if (result.success && !result.consentWallBlocked) {
      console.log('\n[PROVE_SAFE_GOTO] SAFE_GOTO_OK: Navigation successful, consent wall cleared or not detected');
      process.exit(0);
    }

    if (result.consentWallBlocked) {
      console.log('\n[PROVE_SAFE_GOTO] SAFE_GOTO_FAIL: Consent wall blocked navigation');
      process.exit(1);
    }

    if (!result.success && result.error) {
      console.log('\n[PROVE_SAFE_GOTO] SAFE_GOTO_FAIL: ' + result.error);
      process.exit(1);
    }

    console.log('\n[PROVE_SAFE_GOTO] SAFE_GOTO_OK: Navigation completed');
    process.exit(0);
  } catch (error: any) {
    console.error('\n[PROVE_SAFE_GOTO] SAFE_GOTO_FAIL: ' + error.message);
    process.exit(1);
  } finally {
    if (page) {
      await pool.releasePage(page);
    }
  }
}

main().catch((e) => {
  console.error('[PROVE_SAFE_GOTO] Fatal:', e.message);
  process.exit(1);
});

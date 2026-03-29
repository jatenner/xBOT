#!/usr/bin/env tsx
/**
 * OPS_PROOF - End-to-end proof that xBOT can:
 * 1. Navigate (runNavHeartbeat)
 * 2. Fetch candidates (lightweight feed/queue count)
 * 3. Post exactly ONE controlled tweet (if POST_ONE=true)
 * 4. Scrape metrics for that tweet
 * 5. Write learning rows (outcomes, learning_posts, tweet_metrics)
 *
 * Safe to run once in production. Does NOT increase posting frequency.
 * Use existing browser pool with high priority.
 *
 * Usage:
 *   pnpm tsx scripts/ops/ops-proof.ts
 *   POST_ONE=true pnpm tsx scripts/ops/ops-proof.ts
 */

import 'dotenv/config';
import { runOpsProof } from '../../src/ops/opsProofRunner';

const PREFIX = '[OPS_PROOF]';

async function main(): Promise<number> {
  const mode = process.env.MODE || 'unset';
  const xActionsEnabled = process.env.X_ACTIONS_ENABLED === 'true';
  const shadowMode = process.env.SHADOW_MODE !== 'false';
  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const postingEnabled = process.env.POSTING_ENABLED === 'true';

  console.log(`${PREFIX} ─── Mode flags ───`);
  console.log(`${PREFIX}   MODE=${mode}`);
  console.log(`${PREFIX}   X_ACTIONS_ENABLED=${xActionsEnabled}`);
  console.log(`${PREFIX}   SHADOW_MODE=${shadowMode ? 'true (read-only)' : 'false'}`);
  console.log(`${PREFIX}   DRY_RUN=${dryRun}`);
  console.log(`${PREFIX}   POSTING_ENABLED=${postingEnabled}`);
  console.log(`${PREFIX}   POST_ONE=${process.env.POST_ONE === 'true'}`);

  const { isXActionsEnabled } = await import('../../src/safety/actionGate');
  console.log(`${PREFIX}   effective_x_actions_enabled=${isXActionsEnabled()}`);

  const { results, exitCode } = await runOpsProof({
    postOne: process.env.POST_ONE === 'true',
    skipFetch: process.env.OPS_PROOF_FETCH === 'false',
  });

  for (const r of results) {
    if (r.step === 'mode_flags') continue;
    const icon = r.ok ? '✅' : '❌';
    const data = r.data ? ` ${JSON.stringify(r.data)}` : '';
    console.log(`${PREFIX}   ${icon} ${r.step}${r.message ? `: ${r.message}` : ''}${data}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`${PREFIX} ─── Summary ───`);
  if (failed.length > 0) {
    console.log(`${PREFIX}   FAILED: ${failed.map((f) => f.step).join(', ')}`);
  } else {
    console.log(`${PREFIX}   All steps passed`);
  }

  return exitCode;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });

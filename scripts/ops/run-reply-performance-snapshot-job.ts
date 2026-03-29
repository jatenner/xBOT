#!/usr/bin/env tsx
/**
 * Run Reply Performance Learning V1 snapshot job once.
 * Finds due checkpoints (30m, 2h, 24h, 72h) and fills reply_performance_snapshots from existing metrics.
 *
 * Usage: pnpm exec tsx scripts/ops/run-reply-performance-snapshot-job.ts
 * Optional: MAX_SNAPSHOTS=100 to process more in one run.
 * Optional (runner with browser): REPLY_PERF_SNAPSHOT_SCRAPE_FALLBACK=true RUNNER_MODE=true
 *   to attempt browser scrape for tweets with no metrics in content_metadata/outcomes.
 */

import path from 'path';
import fs from 'fs';
const envPath = path.join(process.cwd(), '.env');
const envLocal = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocal)) require('dotenv').config({ path: envLocal });
else if (fs.existsSync(envPath)) require('dotenv').config({ path: envPath });

async function main() {
  const max = parseInt(process.env.MAX_SNAPSHOTS || '50', 10);
  const { runReplyPerformanceSnapshotJob } = await import('../../src/jobs/replySystemV2/replyPerformanceSnapshotJob');
  const result = await runReplyPerformanceSnapshotJob({ maxSnapshots: max });
  console.log('[RUN] Result:', JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

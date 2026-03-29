/**
 * Safest single controlled live reply attempt.
 *
 * - Exactly one reply attempt only; no daemon, no multiple replies.
 * - SHADOW_MODE off, X_ACTIONS_ENABLED on, posting armed.
 * - All safety gates preserved; uses improved observability logs.
 *
 * Usage:
 *   1. Pick one queued reply decision_id (see runbook).
 *   2. CONTROLLED_DECISION_ID=<uuid> pnpm tsx scripts/ops/controlled-live-reply-once.ts
 *
 * Requires: CONTROLLED_DECISION_ID set to a valid queued reply decision.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { processPostingQueue } from '../../src/jobs/postingQueue';

const PREFIX = '[CONTROLLED_LIVE_REPLY]';

function enforceEnv(): void {
  process.env.SHADOW_MODE = 'false';
  process.env.X_ACTIONS_ENABLED = 'true';
  process.env.POSTING_ENABLED = 'true';
  process.env.REPLIES_ENABLED = 'true';
  process.env.EXECUTION_MODE = 'executor';
  process.env.RUNNER_MODE = 'true';
  process.env.POSTING_QUEUE_MAX = '1';
  process.env.POSTING_QUEUE_CERT_MODE = 'true';
  process.env.RAMP_MODE = 'false'; // ensure single-decision limit is not bypassed
  // Force exactly one decision: CONTROLLED_DECISION_ID is required by this script
  // CONTROLLED_TEST_MODE=true would also limit to 1 but we require explicit decision ID for safety
  if (!process.env.CONTROLLED_DECISION_ID) {
    console.error(`${PREFIX} ❌ CONTROLLED_DECISION_ID is required. Set it to one queued reply decision_id.`);
    process.exit(1);
  }
}

async function validateDecision(decisionId: string): Promise<{ ok: boolean; reason?: string; row?: any }> {
  const supabase = getSupabaseClient();
  let { data, error } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, scheduled_at, features')
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (!data && !error) {
    const fallback = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, decision_type, status, scheduled_at, features')
      .eq('decision_id', decisionId)
      .maybeSingle();
    if (fallback.data) {
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error) {
    return { ok: false, reason: `DB error: ${error.message}` };
  }
  if (!data) {
    return { ok: false, reason: 'Decision not found in content_metadata or content_generation_metadata_comprehensive' };
  }
  if (data.decision_type !== 'reply') {
    return { ok: false, reason: `Not a reply (decision_type=${data.decision_type})` };
  }
  if (data.status !== 'queued') {
    return { ok: false, reason: `Not queued (status=${data.status})` };
  }
  const src = (data.features as any)?.pipeline_source || (data as any).pipeline_source;
  const allowed = ['reply_v2_scheduler', 'reply_v2_planner', 'ops_reply_proof'];
  if (!src || !allowed.includes(src)) {
    return { ok: false, reason: `Pipeline source not allowed for cert mode (pipeline_source=${src || 'missing'})` };
  }
  return { ok: true, row: { ...data, pipeline_source: src } };
}

function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔒 CONTROLLED LIVE REPLY — ONE-SHOT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  enforceEnv();
  const decisionId = process.env.CONTROLLED_DECISION_ID!.trim();

  console.log(`${PREFIX} Environment (enforced for this run):`);
  console.log(`   SHADOW_MODE=${process.env.SHADOW_MODE}`);
  console.log(`   X_ACTIONS_ENABLED=${process.env.X_ACTIONS_ENABLED}`);
  console.log(`   POSTING_ENABLED=${process.env.POSTING_ENABLED}`);
  console.log(`   REPLIES_ENABLED=${process.env.REPLIES_ENABLED}`);
  console.log(`   EXECUTION_MODE=${process.env.EXECUTION_MODE}`);
  console.log(`   RUNNER_MODE=${process.env.RUNNER_MODE}`);
  console.log(`   POSTING_QUEUE_MAX=${process.env.POSTING_QUEUE_MAX}`);
  console.log(`   RAMP_MODE=${process.env.RAMP_MODE}`);
  console.log(`   CONTROLLED_DECISION_ID=${decisionId}`);
  console.log('');
}

async function run(): Promise<void> {
  main();

  const decisionId = process.env.CONTROLLED_DECISION_ID!.trim();

  const supabase = getSupabaseClient();
  const validation = await validateDecision(decisionId);
  if (!validation.ok) {
    console.error(`${PREFIX} ❌ Pre-flight failed: ${validation.reason}`);
    console.error(`${PREFIX}   Fix: ensure decision_id is a queued reply with pipeline_source reply_v2_scheduler or reply_v2_planner.`);
    process.exit(1);
  }
  const row = validation.row!;
  const scheduledAt = row.scheduled_at ? new Date(row.scheduled_at) : null;
  const now = new Date();
  if (scheduledAt && scheduledAt.getTime() > now.getTime()) {
    const minutesUntil = Math.round((scheduledAt.getTime() - now.getTime()) / 60000);
    console.log(`${PREFIX} ⏳ Decision is scheduled ${minutesUntil} min in the future. Queue may defer unless within grace window.`);
  }
  console.log(`${PREFIX} ✅ Pre-flight: decision ${decisionId} is queued reply (pipeline_source=${row.pipeline_source})`);
  console.log('');

  console.log(`${PREFIX} Running posting queue (certMode=true, maxItems=1)...`);
  console.log(`${PREFIX} Look for these log lines: Selected for this run, gate passes, POST_ATTEMPT, success or failure.`);
  console.log('───────────────────────────────────────────────────────────────────────────────');

  const result = await processPostingQueue({ certMode: true, maxItems: 1 });

  console.log('───────────────────────────────────────────────────────────────────────────────');
  console.log(`${PREFIX} Queue run finished: ready=${result.ready_candidates} selected=${result.selected_candidates} attempts_started=${result.attempts_started}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📋 PROOF CHECKS (run these to confirm success or failure):');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('1) Post attempt record (should show attempting then success or failed with error_message):');
  console.log(`   SELECT decision_id, status, tweet_id, error_message, created_at`);
  console.log(`   FROM posting_attempts WHERE decision_id = '${decisionId}' ORDER BY created_at DESC LIMIT 3;`);
  console.log('');
  console.log('2) Decision status and tweet_id (success => status=posted, tweet_id set):');
  console.log(`   SELECT decision_id, status, tweet_id, posted_at, error_message`);
  console.log(`   FROM content_metadata WHERE decision_id = '${decisionId}';`);
  console.log('');
  console.log('3) Log file (last attempt for this decision):');
  console.log(`   grep '${decisionId}' logs/post_attempts.log | tail -5`);
  console.log('');
  console.log('Success: posting_attempts has status=success and content_metadata has status=posted, tweet_id not null.');
  console.log('Failure: posting_attempts has status=failed and error_message explains why; or attempts_started=0 and logs show gate/deferral.');
  console.log('═══════════════════════════════════════════════════════════════════════');

  process.exit(0);
}

run().catch((err) => {
  console.error(`${PREFIX} Fatal:`, err?.message || err);
  process.exit(1);
});

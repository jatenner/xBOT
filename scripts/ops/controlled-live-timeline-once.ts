/**
 * Safest single controlled live timeline (single/thread) post attempt.
 *
 * - Exactly one timeline post attempt only; no daemon, no replies.
 * - SHADOW_MODE off, X_ACTIONS_ENABLED on, posting armed.
 * - All safety gates preserved; reuses existing posting queue and atomic post path.
 *
 * Usage:
 *   1. Pick one queued single or thread decision_id (status=queued, decision_type in ['single','thread']).
 *   2. CONTROLLED_DECISION_ID=<uuid> pnpm tsx scripts/ops/controlled-live-timeline-once.ts
 *
 * Requires: CONTROLLED_DECISION_ID set to a valid queued single or thread decision.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { processPostingQueue } from '../../src/jobs/postingQueue';

const PREFIX = '[CONTROLLED_LIVE_TIMELINE]';

function enforceEnv(): void {
  process.env.SHADOW_MODE = 'false';
  process.env.X_ACTIONS_ENABLED = 'true';
  process.env.POSTING_ENABLED = 'true';
  process.env.EXECUTION_MODE = 'executor';
  process.env.RUNNER_MODE = 'true';
  process.env.POSTING_QUEUE_MAX = '1';
  process.env.POSTING_QUEUE_CERT_MODE = 'false'; // include content (single/thread), not reply-only
  process.env.RAMP_MODE = 'false';
  if (!process.env.CONTROLLED_DECISION_ID) {
    console.error(`${PREFIX} ❌ CONTROLLED_DECISION_ID is required. Set it to one queued single or thread decision_id.`);
    process.exit(1);
  }
}

async function validateDecision(decisionId: string): Promise<{ ok: boolean; reason?: string; row?: any }> {
  const supabase = getSupabaseClient();
  const cols = 'decision_id, decision_type, status, scheduled_at';

  // Try content_metadata first (primary in some envs)
  const { data: cmData, error: cmError } = await supabase
    .from('content_metadata')
    .select(cols)
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (cmError) {
    return { ok: false, reason: `DB error (content_metadata): ${cmError.message}` };
  }
  if (cmData) {
    if (cmData.decision_type !== 'single' && cmData.decision_type !== 'thread') {
      return { ok: false, reason: `Not a timeline post (decision_type=${cmData.decision_type}); use single or thread.` };
    }
    if (cmData.status !== 'queued') {
      return { ok: false, reason: `Not queued (status=${cmData.status})` };
    }
    return { ok: true, row: cmData };
  }

  // Fallback: queued timeline decisions live in content_generation_metadata_comprehensive in this DB layout
  const { data: compData, error: compError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select(cols)
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (compError) {
    return { ok: false, reason: `DB error (content_generation_metadata_comprehensive): ${compError.message}` };
  }
  if (!compData) {
    return { ok: false, reason: 'Decision not found in content_metadata or content_generation_metadata_comprehensive' };
  }
  if (compData.decision_type !== 'single' && compData.decision_type !== 'thread') {
    return { ok: false, reason: `Not a timeline post (decision_type=${compData.decision_type}); use single or thread.` };
  }
  if (compData.status !== 'queued') {
    return { ok: false, reason: `Not queued (status=${compData.status})` };
  }
  return { ok: true, row: compData };
}

function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔒 CONTROLLED LIVE TIMELINE — ONE-SHOT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  enforceEnv();
  const decisionId = process.env.CONTROLLED_DECISION_ID!.trim();

  console.log(`${PREFIX} Environment (enforced for this run):`);
  console.log(`   SHADOW_MODE=${process.env.SHADOW_MODE}`);
  console.log(`   X_ACTIONS_ENABLED=${process.env.X_ACTIONS_ENABLED}`);
  console.log(`   POSTING_ENABLED=${process.env.POSTING_ENABLED}`);
  console.log(`   EXECUTION_MODE=${process.env.EXECUTION_MODE}`);
  console.log(`   RUNNER_MODE=${process.env.RUNNER_MODE}`);
  console.log(`   POSTING_QUEUE_MAX=${process.env.POSTING_QUEUE_MAX}`);
  console.log(`   POSTING_QUEUE_CERT_MODE=${process.env.POSTING_QUEUE_CERT_MODE} (content included)`);
  console.log(`   RAMP_MODE=${process.env.RAMP_MODE}`);
  console.log(`   CONTROLLED_DECISION_ID=${decisionId}`);
  console.log('');
}

async function run(): Promise<void> {
  main();

  const decisionId = process.env.CONTROLLED_DECISION_ID!.trim();

  const validation = await validateDecision(decisionId);
  if (!validation.ok) {
    console.error(`${PREFIX} ❌ Pre-flight failed: ${validation.reason}`);
    console.error(`${PREFIX}   Fix: ensure decision_id is a queued single or thread in content_metadata or content_generation_metadata_comprehensive.`);
    process.exit(1);
  }
  const row = validation.row!;
  const scheduledAt = row.scheduled_at ? new Date(row.scheduled_at) : null;
  const now = new Date();
  if (scheduledAt && scheduledAt.getTime() > now.getTime()) {
    const minutesUntil = Math.round((scheduledAt.getTime() - now.getTime()) / 60000);
    console.log(`${PREFIX} ⏳ Decision scheduled ${minutesUntil} min in future; queue may defer unless within grace window.`);
  }
  console.log(`${PREFIX} ✅ Pre-flight: decision ${decisionId} is queued ${row.decision_type}`);
  console.log('');

  console.log(`${PREFIX} Running posting queue (certMode=false, maxItems=1)...`);
  console.log(`${PREFIX} Look for: Selected for this run, gate passes, ATTEMPT_SUMMARY, success or failure.`);
  console.log('───────────────────────────────────────────────────────────────────────────────');

  const result = await processPostingQueue({ certMode: false, maxItems: 1 });

  console.log('───────────────────────────────────────────────────────────────────────────────');
  console.log(`${PREFIX} Queue run finished: ready=${result.ready_candidates} selected=${result.selected_candidates} attempts_started=${result.attempts_started}`);
  console.log('');

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📋 PROOF CHECKS:');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   SELECT decision_id, status, tweet_id, error_message, created_at FROM posting_attempts WHERE decision_id = '${decisionId}' ORDER BY created_at DESC LIMIT 3;`);
  console.log(`   SELECT decision_id, status, tweet_id, posted_at FROM content_metadata WHERE decision_id = '${decisionId}';`);
  console.log('═══════════════════════════════════════════════════════════════════════');

  process.exit(0);
}

run().catch((err) => {
  console.error(`${PREFIX} Fatal:`, err?.message || err);
  process.exit(1);
});

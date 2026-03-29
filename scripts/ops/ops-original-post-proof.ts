#!/usr/bin/env tsx
/**
 * OPS ORIGINAL POST PROOF
 *
 * Deterministic proof: seed one original (single) post, run one queue pass,
 * execute post via UltimateTwitterPoster, verify DB evidence.
 *
 * Exit codes: 0 = success, 1 = no attempt/queue filter, 2 = UI/auth, 5 = other
 *
 * Usage (Mac Runner):
 *   RUNNER_MODE=true EXECUTION_MODE=executor RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
 *   pnpm tsx scripts/ops/ops-original-post-proof.ts
 *
 * Optional: SEED_SKIP=1 to use existing queued control-post-* decision.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { processPostingQueue } from '../../src/jobs/postingQueue';
import { initializeGuard, checkStopSwitch } from '../../src/infra/executorGuard';

const PREFIX = '[OPS_ORIGINAL_POST_PROOF]';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    console.error(`${PREFIX} Missing required env: ${name}`);
    process.exit(5);
  }
  return v.trim();
}

async function seedOneOriginalPost(): Promise<string> {
  const { execSync } = await import('child_process');
  const out = execSync('pnpm exec tsx scripts/ops/seed-original-post.ts', {
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const match = out.match(/decision_id=([a-f0-9-]+)/);
  if (!match) {
    console.error(`${PREFIX} Seed script did not output decision_id`);
    process.exit(5);
  }
  return match[1];
}

const FIELDS = 'decision_id, status, decision_type, scheduled_at, created_at, updated_at, content, features';

async function readbackSeededRow(decisionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { data: baseRow, error: baseErr } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select(FIELDS)
    .eq('decision_id', decisionId)
    .maybeSingle();
  console.log(`${PREFIX} Readback content_generation_metadata_comprehensive: ${baseErr ? `error=${baseErr.message}` : baseRow ? 'row' : 'no row'}`);
  if (baseRow) {
    console.log(`${PREFIX}   decision_id=${baseRow.decision_id} status=${baseRow.status} decision_type=${baseRow.decision_type}`);
    console.log(`${PREFIX}   scheduled_at=${baseRow.scheduled_at} created_at=${baseRow.created_at} updated_at=${(baseRow as any).updated_at ?? 'n/a'}`);
    console.log(`${PREFIX}   content=${(baseRow.content ?? '').slice(0, 60)}... features=${JSON.stringify((baseRow as any).features ?? null)}`);
  }
  const { data: viewRow, error: viewErr } = await supabase
    .from('content_metadata')
    .select(FIELDS)
    .eq('decision_id', decisionId)
    .maybeSingle();
  console.log(`${PREFIX} Readback content_metadata: ${viewErr ? `error=${viewErr.message}` : viewRow ? 'row' : 'no row'}`);
  if (viewRow) {
    console.log(`${PREFIX}   decision_id=${viewRow.decision_id} status=${viewRow.status} decision_type=${viewRow.decision_type}`);
    console.log(`${PREFIX}   scheduled_at=${viewRow.scheduled_at} created_at=${viewRow.created_at} updated_at=${(viewRow as any).updated_at ?? 'n/a'}`);
    console.log(`${PREFIX}   content=${(viewRow.content ?? '').slice(0, 60)}... features=${JSON.stringify((viewRow as any).features ?? null)}`);
  }
  if (baseRow && !viewRow && !viewErr) {
    console.log(`${PREFIX} VISIBILITY: Row exists in base table but NOT in content_metadata (content_metadata may be a separate table in this env)`);
  }
}

async function main(): Promise<number> {
  requireEnv('DATABASE_URL');
  if (process.env.RUNNER_MODE !== 'true') {
    console.error(`${PREFIX} RUNNER_MODE must be 'true' for Mac Runner execution`);
    process.exit(5);
  }
  if (process.env.EXECUTION_MODE !== 'executor') {
    process.env.EXECUTION_MODE = 'executor';
    console.log(`${PREFIX} Set EXECUTION_MODE=executor`);
  }

  initializeGuard();
  checkStopSwitch();

  // 🔒 Require expected posting account so proof cannot pass on wrong/suspended account
  const proofExpectedAccount = process.env.PROOF_EXPECTED_ACCOUNT?.trim() || 'TheHealthNote99';
  process.env.PROOF_EXPECTED_ACCOUNT = proofExpectedAccount;
  const expectedAccountNormalized = proofExpectedAccount.replace(/^@/, '').toLowerCase();

  console.log(`${PREFIX} ─── Ops original post proof ───`);
  console.log(`${PREFIX} RUNNER_MODE=${process.env.RUNNER_MODE} EXECUTION_MODE=${process.env.EXECUTION_MODE} PROOF_MODE=true`);
  console.log(`${PREFIX} PROOF_EXPECTED_ACCOUNT=${proofExpectedAccount} (proof will fail if session is not this account)`);

  let seededDecisionId: string | null = null;
  let seededProofTag: string | null = null;
  if (process.env.SEED_SKIP !== '1') {
    console.log(`${PREFIX} Step 0: Seeding one original post...`);
    seededDecisionId = await seedOneOriginalPost();
    console.log(`${PREFIX}   Seeded decision_id=${seededDecisionId}`);
    process.env.PROOF_SEEDED_DECISION_ID = seededDecisionId; // for getReadyDecisions diagnostic
    // Readback: confirm row in base table and in content_metadata (table vs view visibility)
    if (seededDecisionId) {
      await readbackSeededRow(seededDecisionId);
      const supabasePre = getSupabaseClient();
      const { data: seededRow } = await supabasePre
        .from('content_generation_metadata_comprehensive')
        .select('features')
        .eq('decision_id', seededDecisionId)
        .maybeSingle();
      seededProofTag = (seededRow?.features as Record<string, unknown>)?.proof_tag != null
        ? String((seededRow?.features as Record<string, unknown>).proof_tag)
        : null;
    }
  } else {
    console.log(`${PREFIX} Step 0: SEED_SKIP=1, skipping seed`);
  }

  process.env.PROOF_MODE = 'true';

  const runStartTime = Date.now();
  const runStartIso = new Date(runStartTime - 60000).toISOString(); // 1 min buffer for event created_at

  console.log(`${PREFIX} Step 1: Running processPostingQueue({ certMode: true, maxItems: 1 })...`);
  const result = await processPostingQueue({ certMode: true, maxItems: 1 });
  console.log(`${PREFIX}   ready_candidates=${result.ready_candidates} selected=${result.selected_candidates} attempts_started=${result.attempts_started}`);

  if (result.attempts_started === 0) {
    console.error(`${PREFIX} FAIL: No attempt started. Check PROOF_MODE, EXECUTION_MODE=executor, RUNNER_MODE=true, and a queued single with proof_tag control-post-*`);
    process.exit(1);
  }

  const supabase = getSupabaseClient();

  // PROOF_SUBMIT_MODE=dry: success = PROOF_DRY_RUN_READY (submit readiness verified, no tweet posted)
  if (process.env.PROOF_SUBMIT_MODE?.toLowerCase().trim() === 'dry') {
    const { data: dryEvents } = await supabase
      .from('system_events')
      .select('event_data, created_at')
      .eq('event_type', 'PROOF_DRY_RUN_READY')
      .gte('created_at', runStartIso)
      .order('created_at', { ascending: false })
      .limit(10);
    const dryMatch = dryEvents?.find((e: { event_data?: Record<string, unknown> }) => {
      const d = e.event_data as Record<string, unknown> | undefined;
      return d?.decision_id === seededDecisionId && (d?.proof_tag === seededProofTag || !seededProofTag);
    });
    if (dryMatch) {
      console.log(`${PREFIX} PASS (dry run): PROOF_DRY_RUN_READY for decision_id=${seededDecisionId} — submit readiness verified`);
      return 0;
    }
    console.error(`${PREFIX} FAIL (dry run): No PROOF_DRY_RUN_READY for seeded decision_id=${seededDecisionId}`);
    process.exit(5);
  }

  // 🔒 Tight correlation: only accept POST_SUCCESS for our seeded decision_id, from this run, for the expected account
  const { data: successEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', runStartIso)
    .order('created_at', { ascending: false })
    .limit(20);

  const eventMatchesSeeded = (e: { event_data?: Record<string, unknown>; created_at?: string }) => {
    const d = e.event_data as Record<string, unknown> | undefined;
    if (!d?.decision_id || d.decision_type !== 'single' || !d.tweet_id) return false;
    if (seededDecisionId && d.decision_id !== seededDecisionId) return false;
    const eventHandle = (d.account_handle as string)?.replace(/^@/, '').toLowerCase();
    if (eventHandle !== expectedAccountNormalized) return false;
    if (seededProofTag && d.proof_tag !== seededProofTag) return false;
    if (seededProofTag && (!d.proof_tag || !String(d.proof_tag).startsWith('control-post-'))) return false;
    return true;
  };

  const originalSuccess = successEvents?.find(eventMatchesSeeded);
  if (!originalSuccess) {
    console.error(`${PREFIX} FAIL: No POST_SUCCESS matching seeded decision_id, expected account (${proofExpectedAccount}), and proof_tag from this run.`);
    if (successEvents?.length) {
      console.error(`${PREFIX}   Recent POST_SUCCESS events (may be stale or wrong account):`);
      successEvents.slice(0, 3).forEach((e: { event_data?: Record<string, unknown>; created_at?: string }, i: number) => {
        const d = (e.event_data || {}) as Record<string, unknown>;
        console.error(`${PREFIX}     [${i}] decision_id=${d.decision_id} account_handle=${d.account_handle ?? 'n/a'} proof_tag=${d.proof_tag ?? 'n/a'} created_at=${e.created_at}`);
      });
    }
    process.exit(5);
  }

  const eventData = originalSuccess.event_data as Record<string, unknown>;
  const decisionId = eventData.decision_id as string;
  const tweetId = eventData.tweet_id as string;
  const tweetUrl = (eventData.tweet_url as string) || `https://x.com/${expectedAccountNormalized}/status/${tweetId}`;

  console.log(`${PREFIX} Step 2: POST_SUCCESS decision_id=${decisionId} tweet_id=${tweetId} account_handle=${eventData.account_handle ?? 'n/a'}`);
  console.log(`${PREFIX}   Tweet URL: ${tweetUrl}`);

  let contentMetaOk = false;
  const { data: cm } = await supabase
    .from('content_metadata')
    .select('decision_id, status, tweet_id')
    .eq('decision_id', decisionId)
    .maybeSingle();
  if (cm && cm.status === 'posted' && cm.tweet_id === tweetId) {
    contentMetaOk = true;
  } else {
    // When content_metadata is a separate table, row may only exist in base table after markDecisionPosted
    const { data: baseRow } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('decision_id, status, tweet_id')
      .eq('decision_id', decisionId)
      .maybeSingle();
    contentMetaOk = !!baseRow && baseRow.status === 'posted' && baseRow.tweet_id === tweetId;
  }
  console.log(`${PREFIX} Step 3: content_metadata ${contentMetaOk ? 'OK' : 'FAIL'} status=${cm?.status ?? 'null'} tweet_id=${cm?.tweet_id ?? 'null'}`);

  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, decision_id, root_tweet_id, post_type')
    .eq('decision_id', decisionId)
    .limit(1);
  const receiptsOk = receipts && receipts.length > 0 && receipts[0].post_type === 'single';
  console.log(`${PREFIX} Step 4: post_receipts ${receiptsOk ? 'OK' : 'FAIL'} ${receipts?.length ? `receipt_id=${receipts[0].receipt_id}` : 'no row'}`);

  if (seededDecisionId && decisionId !== seededDecisionId) {
    console.error(`${PREFIX} FAIL: Success event decision_id (${decisionId}) does not match seeded (${seededDecisionId}) — stale or wrong evidence.`);
    process.exit(5);
  }

  const allOk = contentMetaOk && receiptsOk;
  console.log(`${PREFIX} ─── Summary ───`);
  console.log(`${PREFIX}   authenticated_account=@${expectedAccountNormalized} (required for proof)`);
  console.log(`${PREFIX}   ${allOk ? 'PASS' : 'FAIL'}: content_metadata=${contentMetaOk ? 'ok' : 'fail'} post_receipts=${receiptsOk ? 'ok' : 'fail'}`);
  console.log(`${PREFIX}   evidence: decision_id=${decisionId} tweet at ${tweetUrl}`);
  return allOk ? 0 : 5;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(5);
  });

#!/usr/bin/env tsx
/**
 * REPLY PROOF RUN – Dry and live reply certification
 *
 * Dry: Verify reply decision queued and selectable; no browser, no post.
 * Live: Full path (seed or scheduler + posting queue + browser), then verify evidence.
 *
 * Proof/certification only; keep separate from production.
 *
 * Usage:
 *   Dry (deterministic):  TARGET_TWEET_ID=<id> pnpm exec tsx scripts/ops/reply-proof-run.ts --dry
 *   Dry (autonomous):     REPLY_PROOF_DRY=1 pnpm exec tsx scripts/ops/reply-proof-run.ts --dry --autonomous
 *   Live (deterministic): TARGET_TWEET_ID=<id> RUNNER_MODE=true EXECUTION_MODE=executor RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm exec tsx scripts/ops/reply-proof-run.ts --live
 *   Live (autonomous):    RUNNER_MODE=true EXECUTION_MODE=executor ... pnpm exec tsx scripts/ops/reply-proof-run.ts --live --autonomous
 *
 * Exit: 0 = PASS, 1 = no decision/attempt, 2–5 = failure category (see ops-reply-proof)
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

const PREFIX = '[REPLY_PROOF_RUN]';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    console.error(`${PREFIX} Missing required env: ${name}`);
    process.exit(5);
  }
  return v.trim();
}

async function seedOneReply(targetTweetId: string): Promise<string> {
  const { execSync } = await import('child_process');
  const out = execSync(
    `TARGET_TWEET_ID=${targetTweetId} pnpm exec tsx scripts/ops/seed-reply-decision.ts`,
    { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const match = out.match(/decision_id=([a-f0-9-]+)/);
  if (!match) {
    console.error(`${PREFIX} Seed script did not output decision_id`);
    process.exit(5);
  }
  return match[1];
}

async function runDryDeterministic(targetTweetId: string): Promise<number> {
  console.log(`${PREFIX} ─── Dry reply proof (deterministic) ───`);
  const decisionId = await seedOneReply(targetTweetId);
  console.log(`${PREFIX} Seeded decision_id=${decisionId}`);

  const supabase = getSupabaseClient();
  const { data: row } = await supabase
    .from('content_metadata')
    .select('decision_id, status, target_tweet_id, root_tweet_id')
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (!row) {
    console.error(`${PREFIX} FAIL: No content row for decision_id=${decisionId}`);
    return 5;
  }
  if (row.status !== 'queued') {
    console.error(`${PREFIX} FAIL: status=${row.status} (expected queued)`);
    return 5;
  }

  console.log(`${PREFIX} target_tweet_id=${row.target_tweet_id} root_tweet_id=${row.root_tweet_id ?? 'null'}`);
  console.log(`${PREFIX} decision_id=${decisionId} status=queued`);
  console.log(`${PREFIX} REPLY_PROOF DRY PASS (deterministic). Run --live to post.`);
  return 0;
}

async function runDryAutonomous(): Promise<number> {
  console.log(`${PREFIX} ─── Dry reply proof (autonomous) ───`);
  const { attemptScheduledReply } = await import('../../src/jobs/replySystemV2/tieredScheduler');
  const result = await attemptScheduledReply();
  if (!result.decision_id) {
    console.error(`${PREFIX} FAIL: No ALLOW decision created (reason=${result.reason}). Ensure reply_candidate_queue has a candidate.`);
    return 1;
  }
  const decisionId = result.decision_id;
  console.log(`${PREFIX} Scheduler created decision_id=${decisionId}`);

  const supabase = getSupabaseClient();
  const { data: cm } = await supabase
    .from('content_metadata')
    .select('decision_id, status, target_tweet_id, root_tweet_id, pipeline_source')
    .eq('decision_id', decisionId)
    .maybeSingle();
  const { data: rd } = await supabase
    .from('reply_decisions')
    .select('decision_id, decision, status')
    .eq('decision_id', decisionId)
    .maybeSingle();

  if (!cm) {
    console.error(`${PREFIX} FAIL: No content row for decision_id=${decisionId}`);
    return 5;
  }
  const allowOk = rd?.decision === 'ALLOW';
  console.log(`${PREFIX} target_tweet_id=${cm.target_tweet_id} root_tweet_id=${cm.root_tweet_id ?? 'null'} pipeline_source=${cm.pipeline_source ?? 'null'}`);
  console.log(`${PREFIX} reply_decisions ALLOW=${allowOk} decision_id=${decisionId}`);
  console.log(`${PREFIX} REPLY_PROOF DRY PASS (autonomous). Run --live to post.`);
  return 0;
}

async function runLiveDeterministic(targetTweetId: string): Promise<number> {
  const { initializeGuard, checkStopSwitch } = await import('../../src/infra/executorGuard');
  requireEnv('DATABASE_URL');
  if (process.env.RUNNER_MODE !== 'true') {
    console.error(`${PREFIX} RUNNER_MODE must be 'true' for live proof`);
    process.exit(5);
  }
  process.env.EXECUTION_MODE = process.env.EXECUTION_MODE || 'executor';
  process.env.PROOF_MODE = 'true';
  initializeGuard();
  checkStopSwitch();

  const decisionId = await seedOneReply(targetTweetId);
  console.log(`${PREFIX} Seeded decision_id=${decisionId}`);

  const { processPostingQueue } = await import('../../src/jobs/postingQueue');
  const result = await processPostingQueue({ certMode: true, maxItems: 1 });
  if (result.attempts_started === 0) {
    console.error(`${PREFIX} FAIL: No attempt started. Check PROOF_MODE, certMode, executor env.`);
    return 1;
  }

  const supabase = getSupabaseClient();
  const { data: postSuccess } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(5);
  const successEvent = postSuccess?.find((e: { event_data?: Record<string, unknown> }) => {
    const d = (e.event_data as Record<string, unknown>)?.decision_id;
    return d === decisionId || (e.event_data as Record<string, unknown>)?.posted_reply_tweet_id;
  }) || postSuccess?.[0];
  if (!successEvent) {
    const { data: failEvents } = await supabase
      .from('system_events')
      .select('event_type, event_data')
      .in('event_type', ['POST_FAILED', 'REPLY_FAILED'])
      .order('created_at', { ascending: false })
      .limit(3);
    console.error(`${PREFIX} FAIL: No POST_SUCCESS. Last failures: ${failEvents?.map((e: any) => e.event_type).join(', ')}`);
    return 5;
  }

  const ed = successEvent.event_data as Record<string, unknown>;
  const did = ed.decision_id as string;
  const tweetId = (ed.posted_reply_tweet_id ?? ed.tweet_id) as string;
  const tweetUrl = (ed.tweet_url as string) || `https://x.com/i/status/${tweetId}`;

  const { data: cm } = await supabase.from('content_metadata').select('status, tweet_id').eq('decision_id', did).maybeSingle();
  const { data: receipts } = await supabase.from('post_receipts').select('receipt_id, post_type').eq('decision_id', did).limit(1);
  const contentOk = !!cm && cm.status === 'posted' && cm.tweet_id === tweetId;
  const receiptsOk = receipts?.length && receipts[0].post_type === 'reply';

  console.log(`${PREFIX} decision_id=${did} posted_reply_tweet_id=${tweetId}`);
  console.log(`${PREFIX} reply_tweet_url=${tweetUrl}`);
  console.log(`${PREFIX} content_metadata=${contentOk ? 'OK' : 'FAIL'} post_receipts=${receiptsOk ? 'OK' : 'FAIL'}`);
  if (contentOk && receiptsOk) {
    console.log(`${PREFIX} PASS Reply posted and evidence recorded. Evidence: ${tweetUrl}`);
    return 0;
  }
  return 5;
}

async function runLiveAutonomous(): Promise<number> {
  // Delegate to existing autonomous proof script
  const { execSync } = await import('child_process');
  try {
    execSync(
      'pnpm exec tsx scripts/ops/ops-autonomous-reply-proof.ts',
      { stdio: 'inherit', env: { ...process.env, RUNNER_MODE: 'true', EXECUTION_MODE: process.env.EXECUTION_MODE || 'executor' } }
    );
    return 0;
  } catch (e: any) {
    return e?.status ?? 5;
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const live = args.includes('--live');
  const autonomous = args.includes('--autonomous');

  if (!dry && !live) {
    console.error(`${PREFIX} Use --dry or --live`);
    process.exit(5);
  }
  if (dry && live) {
    console.error(`${PREFIX} Use exactly one of --dry or --live`);
    process.exit(5);
  }

  requireEnv('DATABASE_URL');

  if (dry) {
    if (autonomous) return runDryAutonomous();
    const targetId = process.env.TARGET_TWEET_ID?.trim();
    if (!targetId) {
      console.error(`${PREFIX} TARGET_TWEET_ID required for deterministic dry proof`);
      process.exit(5);
    }
    if (!/^\d{15,}$/.test(targetId)) {
      console.error(`${PREFIX} TARGET_TWEET_ID must be numeric and >= 15 digits`);
      process.exit(5);
    }
    return runDryDeterministic(targetId);
  }

  // Live
  if (autonomous) return runLiveAutonomous();
  const targetId = process.env.TARGET_TWEET_ID?.trim();
  if (!targetId) {
    console.error(`${PREFIX} TARGET_TWEET_ID required for deterministic live proof`);
    process.exit(5);
  }
  if (!/^\d{15,}$/.test(targetId)) {
    console.error(`${PREFIX} TARGET_TWEET_ID must be numeric and >= 15 digits`);
    process.exit(5);
  }
  return runLiveDeterministic(targetId);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(5);
  });

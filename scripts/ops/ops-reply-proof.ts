#!/usr/bin/env tsx
/**
 * OPS REPLY PROOF
 *
 * Deterministic reply-proof path: seed one reply decision, run one queue pass in cert/proof mode,
 * execute postReply via UltimateTwitterPoster, verify DB evidence.
 *
 * Exit codes:
 *   0 - Success (one reply posted, evidence verified)
 *   1 - QUEUE_FILTER (no candidate selected or attempts_started=0 with no ready)
 *   2 - UI / browser (attempt started but no POST_SUCCESS; consent, composer, etc.)
 *   3 - AUTH (session/login failure)
 *   4 - ACCOUNT_STATE (rate limit, duplicate, or other account-level block)
 *   5 - Other/script error
 *
 * Usage (Mac Runner):
 *   RUNNER_MODE=true EXECUTION_MODE=executor RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
 *   TARGET_TWEET_ID=1234567890123456789 pnpm tsx scripts/ops/ops-reply-proof.ts
 *
 * Optional: SEED_SKIP=1 to skip seeding (use existing queued control-reply-* decision).
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { processPostingQueue } from '../../src/jobs/postingQueue';
import { initializeGuard, checkStopSwitch } from '../../src/infra/executorGuard';

const PREFIX = '[OPS_REPLY_PROOF]';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    console.error(`${PREFIX} Missing required env: ${name}`);
    process.exit(5);
  }
  return v.trim();
}

function validateTargetTweetId(id: string): void {
  if (!/^\d+$/.test(id) || id.length < 15) {
    console.error(`${PREFIX} TARGET_TWEET_ID must be numeric and >= 15 digits`);
    process.exit(5);
  }
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

type FailureCategory = 'QUEUE_FILTER' | 'UI' | 'AUTH' | 'ACCOUNT_STATE' | 'OTHER';

function categorizeFailure(
  attemptsStarted: number,
  readyCandidates: number,
  lastEventData?: Record<string, unknown>
): FailureCategory {
  if (attemptsStarted === 0) {
    return readyCandidates === 0 ? 'QUEUE_FILTER' : 'QUEUE_FILTER'; // no attempt = filter or NOT_EXECUTOR
  }
  const msg = String(lastEventData?.pipeline_error_reason || lastEventData?.message || '').toLowerCase();
  if (msg.includes('consent') || msg.includes('login') || msg.includes('challenge') || msg.includes('auth')) return 'AUTH';
  if (msg.includes('rate limit') || msg.includes('429') || msg.includes('duplicate') || msg.includes('already replied')) return 'ACCOUNT_STATE';
  if (msg.includes('composer') || msg.includes('timeout') || msg.includes('navigation') || msg.includes('element')) return 'UI';
  return 'OTHER';
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

  const targetTweetId = requireEnv('TARGET_TWEET_ID');
  validateTargetTweetId(targetTweetId);

  initializeGuard();
  checkStopSwitch();

  console.log(`${PREFIX} ─── Ops reply proof (deterministic one-reply path) ───`);
  console.log(`${PREFIX} RUNNER_MODE=${process.env.RUNNER_MODE} EXECUTION_MODE=${process.env.EXECUTION_MODE} PROOF_MODE=true`);

  let seededDecisionId: string | null = null;
  if (process.env.SEED_SKIP !== '1') {
    console.log(`${PREFIX} Step 0: Seeding one reply decision...`);
    seededDecisionId = await seedOneReply(targetTweetId);
    console.log(`${PREFIX}   Seeded decision_id=${seededDecisionId}`);
  } else {
    console.log(`${PREFIX} Step 0: SEED_SKIP=1, skipping seed`);
  }

  process.env.PROOF_MODE = 'true';

  console.log(`${PREFIX} Step 1: Running processPostingQueue({ certMode: true, maxItems: 1 })...`);
  const result = await processPostingQueue({ certMode: true, maxItems: 1 });
  console.log(`${PREFIX}   ready_candidates=${result.ready_candidates} selected=${result.selected_candidates} attempts_started=${result.attempts_started}`);

  if (result.attempts_started === 0) {
    const category = result.ready_candidates === 0 ? 'QUEUE_FILTER' : 'QUEUE_FILTER';
    console.error(`${PREFIX} FAIL: No attempt started. Category=${category}`);
    console.error(`${PREFIX} Check: PROOF_MODE=true, certMode=true, EXECUTION_MODE=executor, RUNNER_MODE=true, and a queued reply with proof_tag control-reply-*`);
    process.exit(1);
  }

  const supabase = getSupabaseClient();

  // Check POST_SUCCESS first (postingQueue writes this for replies), then REPLY_SUCCESS (atomicPostExecutor fallback)
  const { data: postSuccessEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(10);
  const { data: replySuccessEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'REPLY_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(10);

  const replySuccess = postSuccessEvents?.find((e: { event_data?: Record<string, unknown> }) => (e.event_data as Record<string, unknown>)?.posted_reply_tweet_id)
    || replySuccessEvents?.find((e: { event_data?: Record<string, unknown> }) => (e.event_data as Record<string, unknown>)?.decision_id);
  if (!replySuccess) {
    const { data: failedEvents } = await supabase
      .from('system_events')
      .select('event_data, event_type')
      .in('event_type', ['POST_FAILED', 'REPLY_FAILED'])
      .order('created_at', { ascending: false })
      .limit(5);
    const lastFail = failedEvents?.[0];
    const eventData = (lastFail?.event_data || {}) as Record<string, unknown>;
    const category = categorizeFailure(result.attempts_started, result.ready_candidates, eventData);
    console.error(`${PREFIX} FAIL: No POST_SUCCESS/REPLY_SUCCESS after attempt. Category=${category}`);
    if (lastFail) {
      console.error(`${PREFIX}   Last failure: ${lastFail.event_type} ${eventData.pipeline_error_reason || eventData.message || ''}`);
    }
    const exitCode = category === 'AUTH' ? 3 : category === 'ACCOUNT_STATE' ? 4 : category === 'UI' ? 2 : 5;
    process.exit(exitCode);
  }

  const eventData = replySuccess.event_data as Record<string, unknown>;
  const decisionId = eventData.decision_id as string;
  const postedReplyTweetId = (eventData.posted_reply_tweet_id ?? eventData.tweet_id) as string;
  const tweetUrl = (eventData.tweet_url as string) || `https://x.com/i/status/${postedReplyTweetId}`;

  console.log(`${PREFIX} Step 2: Success event decision_id=${decisionId} posted_reply_tweet_id=${postedReplyTweetId}`);
  console.log(`${PREFIX}   Tweet URL: ${tweetUrl}`);

  // content_metadata (or view): must show status=posted and tweet_id for decision_id
  const { data: cm } = await supabase
    .from('content_metadata')
    .select('decision_id, status, tweet_id')
    .eq('decision_id', decisionId)
    .maybeSingle();
  const contentMetaOk = !!cm && cm.status === 'posted' && !!cm.tweet_id;
  console.log(`${PREFIX} Step 3: content_metadata ${contentMetaOk ? 'OK' : 'FAIL'} status=${cm?.status ?? 'null'} tweet_id=${cm?.tweet_id ?? 'null'}`);

  // reply_decisions optional for deterministic path (ops_reply_proof seeds content only)
  const { data: rd } = await supabase
    .from('reply_decisions')
    .select('decision_id, posted_reply_tweet_id, posting_completed_at')
    .eq('decision_id', decisionId)
    .maybeSingle();
  const replyDecisionsOk = !rd ? null : (rd.posted_reply_tweet_id === postedReplyTweetId && !!rd.posting_completed_at);
  console.log(`${PREFIX} Step 4: reply_decisions ${replyDecisionsOk === true ? 'OK' : replyDecisionsOk === false ? 'FAIL' : 'N/A (deterministic path)'} posted_reply_tweet_id=${rd?.posted_reply_tweet_id ?? 'null'}`);

  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, decision_id, root_tweet_id, post_type')
    .eq('decision_id', decisionId)
    .limit(1);

  const receiptsOk = receipts && receipts.length > 0 && receipts[0].post_type === 'reply';
  console.log(`${PREFIX} Step 5: post_receipts ${receiptsOk ? 'OK' : 'FAIL'} ${receipts?.length ? `receipt_id=${receipts[0].receipt_id}` : 'no row'}`);

  // Pass: content_metadata + post_receipts required; reply_decisions optional for seeded reply
  const allOk = contentMetaOk && receiptsOk && (replyDecisionsOk !== false);
  console.log(`${PREFIX} ─── Summary ───`);
  console.log(`${PREFIX}   ${allOk ? 'PASS' : 'FAIL'}: content_metadata=${contentMetaOk ? 'ok' : 'fail'} post_receipts=${receiptsOk ? 'ok' : 'fail'} reply_decisions=${replyDecisionsOk === true ? 'ok' : replyDecisionsOk === false ? 'fail' : 'n/a'}`);
  console.log(`${PREFIX}   Evidence: tweet at ${tweetUrl}`);
  return allOk ? 0 : 5;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(5);
  });

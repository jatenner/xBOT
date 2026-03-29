#!/usr/bin/env tsx
/**
 * OPS AUTONOMOUS REPLY PROOF
 *
 * E2E proof: run reply V2 scheduler once (discovery → one queued reply), then
 * run posting queue once to publish it, then verify DB evidence.
 *
 * Prerequisite: reply_candidate_queue has at least one valid queued candidate
 * (e.g. from curatedCandidateFetcher or manual seed). Otherwise scheduler may
 * create no decision and proof will exit with NO_DECISION.
 *
 * Exit codes: 0 = success, 1 = no decision/attempt, 5 = other
 *
 * Usage (Mac Runner):
 *   RUNNER_MODE=true EXECUTION_MODE=executor RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp \
 *   pnpm tsx scripts/ops/ops-autonomous-reply-proof.ts
 */

// Must load env before any module that reads config (import order: this first)
import './load-env';
import { getSupabaseClient } from '../../src/db/index';
import { processPostingQueue } from '../../src/jobs/postingQueue';
import { attemptScheduledReply } from '../../src/jobs/replySystemV2/tieredScheduler';
import { initializeGuard, checkStopSwitch } from '../../src/infra/executorGuard';

const PREFIX = '[OPS_AUTONOMOUS_REPLY_PROOF]';

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v?.trim()) {
    console.error(`${PREFIX} Missing required env: ${name}`);
    process.exit(5);
  }
  return v.trim();
}

/** CDP endpoint used by pool/runner (must match UnifiedBrowserPool and chrome-cdp). */
function getCdpEndpoint(): string {
  const port = process.env.RUNNER_CDP_PORT || process.env.CDP_PORT || '9222';
  const host = process.env.RUNNER_CDP_HOST || '127.0.0.1';
  return `http://${host}:${port}`;
}

/** Verify CDP is reachable when RUNNER_BROWSER=cdp; exit with instructions if not. */
async function ensureCdpReachable(): Promise<void> {
  if ((process.env.RUNNER_BROWSER || '').toLowerCase() !== 'cdp') return;
  const endpoint = getCdpEndpoint();
  const url = `${endpoint}/json/version`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      console.log(`${PREFIX} CDP preflight OK: endpoint=${endpoint} (browser exists before proof)`);
      return;
    }
  } catch (e: any) {
    console.error(`${PREFIX} CDP preflight FAIL: endpoint=${endpoint} unreachable: ${e?.message || e}`);
    console.error(`${PREFIX} Start headless Chrome first: RUNNER_HEADLESS=true pnpm run runner:chrome-cdp`);
    console.error(`${PREFIX} Or in another terminal: RUNNER_HEADLESS=true RUNNER_PROFILE_DIR=./.runner-profile pnpm tsx scripts/runner/chrome-cdp.ts`);
    process.exit(5);
  }
  console.error(`${PREFIX} CDP preflight FAIL: ${url} returned non-OK`);
  process.exit(5);
}

async function main(): Promise<number> {
  requireEnv('DATABASE_URL');
  requireEnv('OPENAI_API_KEY');
  if (process.env.RUNNER_MODE !== 'true') {
    console.error(`${PREFIX} RUNNER_MODE must be 'true' for Mac Runner execution`);
    process.exit(5);
  }
  if (process.env.EXECUTION_MODE !== 'executor') {
    process.env.EXECUTION_MODE = 'executor';
    console.log(`${PREFIX} Set EXECUTION_MODE=executor`);
  }

  await ensureCdpReachable();

  initializeGuard();
  checkStopSwitch();

  console.log(`${PREFIX} ─── Autonomous reply proof (discovery → publish) ───`);

  // Step 1: Run scheduler once to create one reply decision from queue (if candidate exists)
  console.log(`${PREFIX} Step 1: Running attemptScheduledReply()...`);
  const schedulerResult = await attemptScheduledReply();
  console.log(`${PREFIX}   posted=${schedulerResult.posted} reason=${schedulerResult.reason} decision_id=${schedulerResult.decision_id ?? 'null'}`);

  // Step 2: Run posting queue once to post any queued reply (including the one just created)
  console.log(`${PREFIX} Step 2: Running processPostingQueue({ maxItems: 1 })...`);
  const queueResult = await processPostingQueue({ maxItems: 1 });
  console.log(`${PREFIX}   ready_candidates=${queueResult.ready_candidates} attempts_started=${queueResult.attempts_started}`);

  if (queueResult.attempts_started === 0) {
    console.error(`${PREFIX} FAIL: No post attempt. Ensure reply_candidate_queue has a candidate and scheduler created a queued reply.`);
    process.exit(1);
  }

  const supabase = getSupabaseClient();
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();

  const { data: postSuccessEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', twoMinAgo)
    .order('created_at', { ascending: false })
    .limit(5);
  const { data: replySuccessEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'REPLY_SUCCESS')
    .gte('created_at', twoMinAgo)
    .order('created_at', { ascending: false })
    .limit(5);

  const replySuccess = postSuccessEvents?.find((e: { event_data?: Record<string, unknown> }) => (e.event_data as Record<string, unknown>)?.posted_reply_tweet_id)
    || replySuccessEvents?.[0];
  if (!replySuccess) {
    console.error(`${PREFIX} FAIL: No POST_SUCCESS/REPLY_SUCCESS in last 2 minutes.`);
    process.exit(5);
  }

  const eventData = replySuccess.event_data as Record<string, unknown>;
  const decisionId = eventData.decision_id as string;
  const postedReplyTweetId = (eventData.posted_reply_tweet_id ?? eventData.tweet_id) as string;
  const tweetUrl = (eventData.tweet_url as string) || `https://x.com/i/status/${postedReplyTweetId}`;

  console.log(`${PREFIX} Step 3: Success event decision_id=${decisionId} posted_reply_tweet_id=${postedReplyTweetId}`);
  console.log(`${PREFIX}   Tweet URL: ${tweetUrl}`);

  const { data: cm } = await supabase
    .from('content_metadata')
    .select('decision_id, status, tweet_id, pipeline_source')
    .eq('decision_id', decisionId)
    .maybeSingle();
  const contentMetaOk = !!cm && cm.status === 'posted' && !!cm.tweet_id;
  const isAutonomous = !!(cm?.pipeline_source && (cm.pipeline_source === 'reply_v2_scheduler' || cm.pipeline_source === 'reply_v2_planner'));
  console.log(`${PREFIX} Step 4: content_metadata ${contentMetaOk ? 'OK' : 'FAIL'} pipeline_source=${cm?.pipeline_source ?? 'null'} autonomous=${isAutonomous}`);

  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, decision_id, post_type')
    .eq('decision_id', decisionId)
    .limit(1);
  const receiptsOk = receipts && receipts.length > 0 && receipts[0].post_type === 'reply';
  console.log(`${PREFIX} Step 5: post_receipts ${receiptsOk ? 'OK' : 'FAIL'}`);

  const allOk = contentMetaOk && receiptsOk;
  console.log(`${PREFIX} ─── Summary ───`);
  console.log(`${PREFIX}   ${allOk ? 'PASS' : 'FAIL'}: content_metadata=${contentMetaOk ? 'ok' : 'fail'} post_receipts=${receiptsOk ? 'ok' : 'fail'} autonomous=${isAutonomous}`);
  console.log(`${PREFIX}   Evidence: tweet at ${tweetUrl}`);
  return allOk ? 0 : 5;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(5);
  });

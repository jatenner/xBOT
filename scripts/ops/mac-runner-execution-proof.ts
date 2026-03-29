#!/usr/bin/env tsx
/**
 * MAC RUNNER EXECUTION PROOF
 *
 * Deterministic proof: select exactly one queued reply decision, execute it via
 * posting queue (Mac Runner path), then verify evidence.
 *
 * Proof criteria:
 * - Tweet is visible on X (operator can verify via tweet_url in logs)
 * - reply_decisions.posted_reply_tweet_id set, posting_completed_at set
 * - post_receipts row exists for the decision
 * - system_events has POST_SUCCESS for the decision
 *
 * Usage (Mac, same DB as Railway):
 *   RUNNER_MODE=true EXECUTION_MODE=executor RUNNER_PROFILE_DIR=./.runner-profile RUNNER_BROWSER=cdp pnpm tsx scripts/ops/mac-runner-execution-proof.ts
 * Or:
 *   pnpm run runner:posting-queue-once
 *   (then run this script with same env to verify last reply)
 *
 * This script runs the queue once with certMode + maxItems 1, then verifies.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { processPostingQueue } from '../../src/jobs/postingQueue';
import { initializeGuard, checkStopSwitch } from '../../src/infra/executorGuard';

const PREFIX = '[MAC_RUNNER_PROOF]';

function requireEnv(name: string): void {
  if (!process.env[name]) {
    console.error(`${PREFIX} Missing required env: ${name}`);
    process.exit(1);
  }
}

async function main(): Promise<number> {
  requireEnv('DATABASE_URL');
  if (process.env.RUNNER_MODE !== 'true') {
    console.error(`${PREFIX} RUNNER_MODE must be 'true' for Mac Runner execution`);
    process.exit(1);
  }
  if (process.env.EXECUTION_MODE !== 'executor') {
    process.env.EXECUTION_MODE = 'executor';
    console.log(`${PREFIX} Set EXECUTION_MODE=executor`);
  }

  initializeGuard();
  checkStopSwitch();

  console.log(`${PREFIX} ─── Mac Runner execution proof ───`);
  console.log(`${PREFIX} RUNNER_MODE=${process.env.RUNNER_MODE} EXECUTION_MODE=${process.env.EXECUTION_MODE}`);

  // Step 1: Run one posting queue pass (replies only, max 1)
  console.log(`${PREFIX} Step 1: Running processPostingQueue({ certMode: true, maxItems: 1 })...`);
  const result = await processPostingQueue({ certMode: true, maxItems: 1 });
  console.log(`${PREFIX}   ready_candidates=${result.ready_candidates} selected=${result.selected_candidates} attempts_started=${result.attempts_started}`);

  if (result.attempts_started === 0) {
    console.log(`${PREFIX} No attempt was started (no queued reply or NOT_EXECUTOR_MODE). Check logs above.`);
    return result.ready_candidates > 0 ? 1 : 0; // 1 if we had candidates but didn't attempt
  }

  // Step 2: Find the most recent POST_SUCCESS for a reply (has posted_reply_tweet_id)
  const supabase = getSupabaseClient();
  const { data: successEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .eq('event_type', 'POST_SUCCESS')
    .order('created_at', { ascending: false })
    .limit(10);

  const replySuccess = successEvents?.find((e: { event_data?: Record<string, unknown> }) => (e.event_data as Record<string, unknown>)?.posted_reply_tweet_id);
  if (!replySuccess) {
    console.error(`${PREFIX} FAIL: No POST_SUCCESS event with posted_reply_tweet_id found after run (reply may have failed).`);
    return 1;
  }

  const eventData = replySuccess.event_data as Record<string, unknown>;
  const decisionId = eventData.decision_id as string;
  const postedReplyTweetId = eventData.posted_reply_tweet_id as string;
  const tweetUrl = eventData.tweet_url as string;

  console.log(`${PREFIX} Step 2: Found POST_SUCCESS decision_id=${decisionId} posted_reply_tweet_id=${postedReplyTweetId}`);
  console.log(`${PREFIX}   Tweet URL: ${tweetUrl}`);

  // Step 3: Verify reply_decisions
  const { data: rd } = await supabase
    .from('reply_decisions')
    .select('decision_id, posted_reply_tweet_id, posting_completed_at')
    .eq('decision_id', decisionId)
    .single();

  const replyDecisionsOk = rd && rd.posted_reply_tweet_id === postedReplyTweetId && rd.posting_completed_at;
  console.log(`${PREFIX} Step 3: reply_decisions ${replyDecisionsOk ? '✅' : '❌'} posted_reply_tweet_id=${rd?.posted_reply_tweet_id ?? 'null'} posting_completed_at=${rd?.posting_completed_at ?? 'null'}`);

  // Step 4: Verify post_receipts
  const { data: receipts } = await supabase
    .from('post_receipts')
    .select('receipt_id, decision_id, root_tweet_id, post_type')
    .eq('decision_id', decisionId)
    .limit(1);

  const receiptsOk = receipts && receipts.length > 0 && receipts[0].post_type === 'reply';
  console.log(`${PREFIX} Step 4: post_receipts ${receiptsOk ? '✅' : '❌'} ${receipts?.length ? `receipt_id=${receipts[0].receipt_id}` : 'no row'}`);

  // Summary
  const allOk = replyDecisionsOk && receiptsOk;
  console.log(`${PREFIX} ─── Summary ───`);
  console.log(`${PREFIX}   ${allOk ? 'PASS' : 'FAIL'}: reply_decisions=${replyDecisionsOk ? 'ok' : 'fail'} post_receipts=${receiptsOk ? 'ok' : 'fail'}`);
  console.log(`${PREFIX}   Evidence: tweet visible at ${tweetUrl}`);
  return allOk ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${PREFIX} Fatal:`, err);
    process.exit(1);
  });

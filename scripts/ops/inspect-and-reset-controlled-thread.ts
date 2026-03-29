/**
 * Inspect one controlled thread decision and safely reset to queued for controlled proof if NOT posted.
 *
 * Usage:
 *   DECISION_ID=549695d6-747c-444e-937f-715ae47879a4 pnpm tsx scripts/ops/inspect-and-reset-controlled-thread.ts
 *
 * Does NOT reset if the decision was actually posted (posted_decisions or tweet_id set + status=posted).
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

const DECISION_ID = process.env.DECISION_ID || '549695d6-747c-444e-937f-715ae47879a4';

async function main() {
  const supabase = getSupabaseClient();

  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`[INSPECT] decision_id = ${DECISION_ID}`);
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  // 1) content_metadata (view)
  const { data: cm, error: cmErr } = await supabase
    .from('content_metadata')
    .select('decision_id, decision_type, status, tweet_id, posted_at, created_at, updated_at, error_message, skip_reason, features')
    .eq('decision_id', DECISION_ID)
    .maybeSingle();

  if (cmErr) {
    console.log('content_metadata (view): ERROR', cmErr.message);
  } else {
    console.log('1. content_metadata (view):');
    console.log(JSON.stringify(cm ?? null, null, 2));
  }

  // 2) content_generation_metadata_comprehensive (base table)
  const { data: comp, error: compErr } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, tweet_id, thread_tweet_ids, posted_at, created_at, updated_at, error_message, skip_reason, features')
    .eq('decision_id', DECISION_ID)
    .maybeSingle();

  if (compErr) {
    console.log('\ncontent_generation_metadata_comprehensive: ERROR', compErr.message);
  } else {
    console.log('\n2. content_generation_metadata_comprehensive (base table):');
    console.log(JSON.stringify(comp ?? null, null, 2));
  }

  // 3) posting_attempts
  const { data: attempts, error: attemptsErr } = await supabase
    .from('posting_attempts')
    .select('id, decision_id, status, error_message, created_at')
    .eq('decision_id', DECISION_ID)
    .order('created_at', { ascending: false })
    .limit(5);

  if (attemptsErr) {
    console.log('\nposting_attempts: ERROR', attemptsErr.message);
  } else {
    console.log('\n3. posting_attempts (recent):');
    console.log(JSON.stringify(attempts ?? [], null, 2));
  }

  // 4) posted_decisions
  const { data: posted, error: postedErr } = await supabase
    .from('posted_decisions')
    .select('id, decision_id, decision_type, tweet_id, posted_at')
    .eq('decision_id', DECISION_ID)
    .maybeSingle();

  if (postedErr) {
    console.log('\nposted_decisions: ERROR', postedErr.message);
  } else {
    console.log('\n4. posted_decisions:');
    console.log(JSON.stringify(posted ?? null, null, 2));
  }

  const row = comp ?? cm;
  if (!row) {
    console.log('\n[INSPECT] No row found for this decision_id. Exiting.');
    process.exit(1);
  }

  const status = row.status;
  const tweetId = row.tweet_id ?? (row as any).thread_tweet_ids?.[0];
  const hasPostedDecision = !!posted && !!posted.tweet_id;
  const actuallyPosted = hasPostedDecision || (status === 'posted' && (row.tweet_id || tweetId));

  console.log('\n--- Summary ---');
  console.log(`   status (source of truth): ${status}`);
  console.log(`   tweet_id / thread_tweet_ids: ${row.tweet_id ?? (row as any).thread_tweet_ids ?? 'null'}`);
  console.log(`   posted_decisions row: ${hasPostedDecision ? 'yes' : 'no'}`);
  console.log(`   Actually posted: ${actuallyPosted ? 'YES' : 'NO'}`);

  if (status === 'posting') {
    console.log('\n   Why preflight says status=posting: getReadyDecisions() only selects status=queued. This decision is stuck in "posting" (claimed but never completed).');
  }

  const features = (row.features as Record<string, unknown>) ?? {};
  const retryCount = features.retry_count != null ? Number(features.retry_count) : null;
  if (retryCount != null) {
    console.log(`   retry_count (in features): ${retryCount}`);
  }

  if (actuallyPosted) {
    console.log('\n[INSPECT] Decision was actually posted. NOT resetting.');
    printVerificationAndRerun(false);
    process.exit(0);
  }

  if (status === 'queued') {
    console.log('\n[INSPECT] Decision is already queued. No reset needed.');
    printVerificationAndRerun(false);
    process.exit(0);
  }

  console.log('\n[INSPECT] Decision was NOT posted and status is not queued. Resetting to queued for controlled rerun...');

  const { error: updateErr } = await supabase
    .from('content_generation_metadata_comprehensive')
    .update({
      status: 'queued',
      updated_at: new Date().toISOString(),
      error_message: null,
      skip_reason: null,
    })
    .eq('decision_id', DECISION_ID);

  if (updateErr) {
    console.error('[INSPECT] Reset failed:', updateErr.message);
    process.exit(1);
  }

  console.log('[INSPECT] Reset applied: status=queued, error_message/skip_reason cleared.');
  if (retryCount != null) {
    console.log(`[INSPECT] Note: features.retry_count is still ${retryCount}. If proof should cap retries, adjust in DB or leave as-is for rerun.`);
  }
  printVerificationAndRerun(true);
}

function printVerificationAndRerun(wasReset: boolean) {
  console.log('\n--- Verification query (decision should be queued) ---');
  console.log(`
SELECT decision_id, decision_type, status, tweet_id, posted_at, updated_at
FROM content_generation_metadata_comprehensive
WHERE decision_id = '${DECISION_ID}';
`);
  console.log('--- Rerun command (controlled thread proof with CDP) ---');
  console.log(`
CONTROLLED_DECISION_ID=${DECISION_ID} RUNNER_BROWSER=cdp pnpm tsx scripts/ops/controlled-live-timeline-once.ts
`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

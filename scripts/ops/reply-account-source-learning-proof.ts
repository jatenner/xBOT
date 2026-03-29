#!/usr/bin/env tsx
/**
 * Proof script for ReplySystemV2 account + source learning layer.
 *
 * 1. Run outcome aggregation (recompute reply_account_performance, reply_source_performance from reply_decisions).
 * 2. Print sample account and source stats.
 * 3. Optionally show score breakdown for recent candidates (with history adjustments).
 *
 * Usage:
 *   pnpm exec tsx scripts/ops/reply-account-source-learning-proof.ts
 *   pnpm exec tsx scripts/ops/reply-account-source-learning-proof.ts --aggregate-only
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';
import { aggregateReplyOutcomes } from '../../src/jobs/replySystemV2/outcomeAggregation';
import { getAccountPerformance } from '../../src/jobs/replySystemV2/accountPerformanceMemory';
import { getSourcePerformance } from '../../src/jobs/replySystemV2/sourcePerformanceMemory';
import { evaluatePool, logPoolEvaluation, type QueueCandidateWithOpp } from '../../src/jobs/replySystemV2/opportunityIntelligence';

async function runAggregation() {
  console.log('[REPLY_LEARNING_PROOF] Running outcome aggregation...');
  const result = await aggregateReplyOutcomes();
  console.log(
    `[REPLY_LEARNING_PROOF] Aggregation: decisions=${result.decisions_processed} accounts=${result.accounts_updated} sources=${result.sources_updated} errors=${result.errors.length}`
  );
  if (result.errors.length) {
    result.errors.forEach((e) => console.warn('[REPLY_LEARNING_PROOF]', e));
  }
  return result;
}

async function printAccountAndSourceStats() {
  const supabase = getSupabaseClient();
  const { data: accounts } = await supabase
    .from('reply_account_performance')
    .select('target_username, replies_attempted, replies_posted, avg_reward_24h, last_interaction_at')
    .order('replies_posted', { ascending: false })
    .limit(15);
  const { data: sources } = await supabase
    .from('reply_source_performance')
    .select('discovery_source, replies_attempted, replies_posted, avg_reward_24h, last_interaction_at')
    .order('replies_posted', { ascending: false })
    .limit(15);

  console.log('\n--- Sample account performance (top 15 by replies_posted) ---');
  if (!accounts?.length) {
    const { count: ac } = await supabase.from('reply_account_performance').select('*', { count: 'exact', head: true });
    console.log(ac !== undefined && ac > 0 ? `(${ac} rows total, none in top 15)` : '(none)');
  } else {
    for (const row of accounts) {
      console.log(
        `  @${row.target_username} attempted=${row.replies_attempted} posted=${row.replies_posted} avg_reward_24h=${row.avg_reward_24h ?? 'null'} last=${row.last_interaction_at ?? 'null'}`
      );
    }
  }

  console.log('\n--- Sample source performance (top 15 by replies_posted) ---');
  if (!sources?.length) {
    const { count: sc } = await supabase.from('reply_source_performance').select('*', { count: 'exact', head: true });
    console.log(sc !== undefined && sc > 0 ? `(${sc} rows total, none in top 15)` : '(none)');
  } else {
    for (const row of sources) {
      console.log(
        `  ${row.discovery_source} attempted=${row.replies_attempted} posted=${row.replies_posted} avg_reward_24h=${row.avg_reward_24h ?? 'null'} last=${row.last_interaction_at ?? 'null'}`
      );
    }
  }
}

async function showScoreBreakdownWithHistory() {
  const supabase = getSupabaseClient();
  const { data: queueRows } = await supabase
    .from('reply_candidate_queue')
    .select('id, candidate_tweet_id, overall_score, predicted_tier, evaluation_id')
    .in('status', ['queued', 'leased'])
    .limit(5);
  if (!queueRows?.length) {
    console.log('\n--- Score breakdown (history) --- No queued candidates.');
    return;
  }
  const candidateTweetIds = queueRows.map((r: any) => r.candidate_tweet_id);
  const { data: opps } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, target_username, tweet_posted_at, created_at, discovery_source, like_count, reply_count, is_root_tweet, target_in_reply_to_tweet_id')
    .in('target_tweet_id', candidateTweetIds);
  const oppMap = new Map((opps || []).map((o: any) => [o.target_tweet_id, o]));
  const now = Date.now();
  const candidatesWithOpp: QueueCandidateWithOpp[] = queueRows.map((r: any) => {
    const opp = oppMap.get(r.candidate_tweet_id);
    const ageMinutes = opp?.tweet_posted_at || opp?.created_at
      ? (now - new Date(opp.tweet_posted_at || opp.created_at).getTime()) / (60 * 1000)
      : null;
    return {
      candidate_tweet_id: r.candidate_tweet_id,
      evaluation_id: r.evaluation_id,
      predicted_tier: r.predicted_tier ?? 2,
      overall_score: r.overall_score ?? 50,
      age_minutes: ageMinutes,
      opp: opp ? { ...opp, target_username: opp.target_username ?? undefined } : null,
    };
  });
  console.log('\n--- Pool evaluation with history (sample from queue) ---');
  const result = await evaluatePool(candidatesWithOpp);
  logPoolEvaluation(result);
  if (result.topCandidate?.breakdown) {
    const b = result.topCandidate.breakdown;
    console.log(
      `  History: account_adj=${b.account_adj ?? 0} source_adj=${b.source_adj ?? 0} (can change selection vs base score)`
    );
  }
}

async function main() {
  const aggregateOnly = process.argv.includes('--aggregate-only');
  await runAggregation();
  await printAccountAndSourceStats();
  if (!aggregateOnly) {
    await showScoreBreakdownWithHistory();
  }
  console.log('\n[REPLY_LEARNING_PROOF] Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

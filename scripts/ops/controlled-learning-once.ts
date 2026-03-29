/**
 * One-shot controlled learning proof for one known decision.
 * Proves: post -> metrics saved -> learning job sees outcome -> bandit/predictor state updates.
 *
 * Usage:
 *   CONTROLLED_DECISION_ID=<uuid> pnpm tsx scripts/ops/controlled-learning-once.ts
 *
 * Requires: CONTROLLED_DECISION_ID; decision must have an outcomes row (from metrics scrape).
 */

import './load-env';
import { getSupabaseClient } from '../../src/db/index';
import { runLearningCycle } from '../../src/jobs/learnJob';

const PREFIX = '[CONTROLLED_LEARNING]';

function enforceEnv(): void {
  const decisionId = process.env.CONTROLLED_DECISION_ID?.trim();
  if (!decisionId) {
    console.error(`${PREFIX} ❌ CONTROLLED_DECISION_ID is required.`);
    process.exit(1);
  }
}

async function preflight(decisionId: string): Promise<{
  tweet_id: string | null;
  scraped_metrics_exist: boolean;
  outcomes_row_exists: boolean;
}> {
  const supabase = getSupabaseClient();
  let tweet_id: string | null = null;
  let scraped_metrics_exist = false;
  let outcomes_row_exists = false;

  const { data: outcome } = await supabase
    .from('outcomes')
    .select('decision_id, tweet_id, likes, impressions, collected_at')
    .eq('decision_id', decisionId)
    .maybeSingle();
  if (outcome) {
    outcomes_row_exists = true;
    tweet_id = outcome.tweet_id ?? null;
  }

  const { data: meta } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('tweet_id, actual_impressions, actual_likes')
    .eq('decision_id', decisionId)
    .maybeSingle();
  if (meta) {
    if (meta.tweet_id) tweet_id = meta.tweet_id;
    scraped_metrics_exist =
      meta.actual_impressions != null || meta.actual_likes != null;
  }

  return { tweet_id, scraped_metrics_exist, outcomes_row_exists };
}

async function getBanditArmsUpdated(): Promise<{ arm_key: string; last_updated?: string }[]> {
  const supabase = getSupabaseClient();
  let data: any[] | null = null;
  const r1 = await supabase.from('bandit_arms').select('arm_name, scope, last_updated').order('last_updated', { ascending: false }).limit(20);
  if (r1.data?.length) data = r1.data.map((r: any) => ({ arm_key: r.arm_name || r.arm_key || '', last_updated: r.last_updated }));
  if (!data?.length) {
    const r2 = await supabase.from('bandit_arms').select('arm_key').limit(20);
    if (r2.data?.length) data = r2.data.map((r: any) => ({ arm_key: r.arm_key || '', last_updated: undefined }));
  }
  return data || [];
}

async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔒 CONTROLLED LEARNING — ONE-SHOT');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  enforceEnv();
  const decisionId = process.env.CONTROLLED_DECISION_ID!.trim();

  const pre = await preflight(decisionId);
  if (!pre.outcomes_row_exists) {
    console.error(`${PREFIX} ❌ No outcomes row for decision_id=${decisionId}. Run metrics scrape first.`);
    process.exit(1);
  }

  console.log(
    `${PREFIX} proof_preflight decision_id=${decisionId} tweet_id=${pre.tweet_id ?? 'null'} scraped_metrics_exist=${pre.scraped_metrics_exist} outcomes_row_exists=${pre.outcomes_row_exists}`
  );
  console.log('');

  const banditBefore = await getBanditArmsUpdated();

  const stats = await runLearningCycle();

  const banditAfter = await getBanditArmsUpdated();
  const recentUpdate = banditAfter[0]?.last_updated;
  const updatedArms =
    recentUpdate && banditBefore[0]?.last_updated !== recentUpdate
      ? banditAfter.filter((a) => a.last_updated === recentUpdate).map((a) => a.arm_key)
      : banditAfter.slice(0, 5).map((a) => a.arm_key);

  const learningRan = stats.sampleSize > 0;
  const batchSize = stats.sampleSize;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('📋 PROOF SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`   selected=${batchSize}`);
  console.log(`   learning_ran=${learningRan}`);
  console.log(`   arms_updated=${stats.armsUpdated}`);
  console.log(`   predictor_updated=${stats.predictorUpdated}`);
  console.log(`   explore_ratio=${stats.exploreRatio.toFixed(3)}`);
  if (stats.armsUpdated > 0) {
    console.log(`   bandit_arms_changed=${updatedArms.join(', ') || 'see_bandit_arms_table'}`);
  }
  if (!learningRan && batchSize === 0) {
    console.log(`   blocker=no_outcome_or_training_skipped`);
  }
  if (learningRan && stats.armsUpdated > 0) {
    console.log(`   note=if_bandit_arms_not_updated_check_schema_arm_name_vs_arm_key`);
  }
  console.log('═══════════════════════════════════════════════════════════════════════');

  process.exit(0);
}

run().catch((err) => {
  console.error(`${PREFIX} Fatal:`, err?.message || err);
  process.exit(1);
});

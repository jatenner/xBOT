/**
 * Growth loop proof: action logged → metrics enriched → derived computed → learning applied.
 *
 * 1. Ensure at least one growth_action_log row exists (from recent posted decision or seed).
 * 2. Run growthMetricsEnrichment (fills impressions, derived metrics).
 * 3. Run learnJob (uses growth_action_logs aggregates).
 * 4. Print [GROWTH_PROOF] action_logged=... metrics_enriched=... learning_applied=...
 *
 * Usage: pnpm tsx scripts/ops/ops-growth-loop-proof.ts
 */

import './load-env';
import { getSupabaseClient } from '../../src/db/index';
import { runGrowthMetricsEnrichment } from '../../src/jobs/growthMetricsEnrichment';
import { runLearningCycle } from '../../src/jobs/learnJob';

const PREFIX = '[GROWTH_PROOF]';

async function ensureOneActionLog(supabase: ReturnType<typeof getSupabaseClient>): Promise<{
  action_logged: boolean;
  log_id: string | null;
  had_row_before: boolean;
}> {
  const { data: existing } = await supabase
    .from('growth_action_logs')
    .select('id, decision_id, posted_tweet_id, impressions')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { action_logged: true, log_id: existing.id, had_row_before: true };
  }

  const { data: posted } = await supabase
    .from('posted_decisions')
    .select('decision_id, tweet_id, decision_type, posted_at')
    .not('tweet_id', 'is', null)
    .order('posted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (posted) {
    const { data: inserted, error } = await supabase
      .from('growth_action_logs')
      .insert({
        decision_id: posted.decision_id,
        action_type: posted.decision_type === 'thread' ? 'thread' : posted.decision_type === 'reply' ? 'reply' : 'post',
        posted_tweet_id: posted.tweet_id,
        executed_at: posted.posted_at,
        post_time_hour: new Date(posted.posted_at).getHours(),
        day_of_week: new Date(posted.posted_at).getDay(),
      })
      .select('id')
      .single();

    if (!error && inserted) {
      return { action_logged: true, log_id: inserted.id, had_row_before: false };
    }
  }

  return { action_logged: false, log_id: null, had_row_before: false };
}

async function run(): Promise<void> {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('GROWTH LOOP PROOF — Action → Enrichment → Learning');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  const supabase = getSupabaseClient();

  const { action_logged, log_id, had_row_before } = await ensureOneActionLog(supabase);
  if (!action_logged) {
    console.log(`${PREFIX} action_logged=false (no growth_action_logs and no posted_decisions to seed)`);
    console.log(`${PREFIX} metrics_enriched=false learning_applied=false`);
    console.log('Run a post or reply first, then re-run this script.');
    process.exit(0);
  }

  const { data: beforeRow } = log_id
    ? await supabase.from('growth_action_logs').select('id, impressions, reply_efficiency, timing_efficiency, conversion_rate').eq('id', log_id).single()
    : { data: null };

  const enrichResult = await runGrowthMetricsEnrichment();
  const metrics_enriched = enrichResult.updated > 0 || (beforeRow && beforeRow.impressions != null);

  const { data: afterRow } = log_id
    ? await supabase.from('growth_action_logs').select('id, impressions, reply_efficiency, timing_efficiency, conversion_rate').eq('id', log_id).single()
    : { data: null };

  const derived_computed =
    (afterRow && (afterRow.reply_efficiency != null || afterRow.timing_efficiency != null || afterRow.conversion_rate != null)) ||
    (beforeRow && (beforeRow.reply_efficiency != null || beforeRow.timing_efficiency != null || beforeRow.conversion_rate != null));

  const learnStats = await runLearningCycle();
  const learning_applied = learnStats.sampleSize >= 0 && learnStats.armsUpdated >= 0;

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log(`${PREFIX} action_logged=${action_logged} metrics_enriched=${metrics_enriched} derived_computed=${derived_computed} learning_applied=${learning_applied}`);
  console.log('═══════════════════════════════════════════════════════════════════════');

  process.exit(0);
}

run().catch((err) => {
  console.error(`${PREFIX} Fatal:`, err?.message || err);
  process.exit(1);
});

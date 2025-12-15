/**
 * xBOT Learning Health Report
 * 
 * Read-only script that reports on learning system health for the last 7 days.
 * Does not mutate any data - queries only.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

interface HealthMetrics {
  v2Outcomes: {
    total: number;
    withV2: number;
    percentage: string;
  };
  contentSlots: {
    total: number;
    withSlot: number;
    percentage: string;
    bySlot: Record<string, number>;
  };
  vwLearning: {
    rowCount: number;
  };
  weightMaps: {
    rowCount: number;
  };
  replyPriorities: {
    total: number;
    nonZero: number;
    percentage: string;
  };
  experiments: {
    total: number;
    byGroup: Record<string, number>;
    byVariant: Record<string, number>;
  };
  phase4Routing: {
    coreVsExpert: string;
  };
}

async function generateHealthReport(): Promise<HealthMetrics> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. V2 Outcomes Coverage
  const { data: outcomes, error: outcomesError } = await supabase
    .from('outcomes')
    .select('followers_gained_weighted, primary_objective_score, collected_at')
    .gte('collected_at', sevenDaysAgo);

  const totalOutcomes = outcomes?.length || 0;
  const withV2 = outcomes?.filter((o: any) =>
    o.followers_gained_weighted !== null &&
    o.primary_objective_score !== null
  ).length || 0;
  const v2Percentage = totalOutcomes > 0 ? ((withV2 / totalOutcomes) * 100).toFixed(1) : '0.0';

  // 2. Content Slot Coverage
  const { data: content, error: contentError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('content_slot, created_at')
    .gte('created_at', sevenDaysAgo);

  const totalContent = content?.length || 0;
  const withSlot = content?.filter((c: any) => c.content_slot !== null && c.content_slot !== undefined).length || 0;
  const slotPercentage = totalContent > 0 ? ((withSlot / totalContent) * 100).toFixed(1) : '0.0';

  // Group by slot
  const slotCounts: Record<string, number> = {};
  content?.forEach((c: any) => {
    if (c.content_slot) {
      slotCounts[c.content_slot] = (slotCounts[c.content_slot] || 0) + 1;
    }
  });

  // 3. vw_learning Activity
  let vwLearningCount = 0;
  try {
    const { data: vwData, error: vwError } = await supabase
      .from('vw_learning')
      .select('decision_id')
      .gte('posted_at', sevenDaysAgo);

    if (!vwError) {
      vwLearningCount = vwData?.length || 0;
    }
  } catch (err: any) {
    // View may not exist
  }

  // 4. Weight Maps
  const { data: weights, error: weightsError } = await supabase
    .from('learning_model_weights')
    .select('id, created_at')
    .gte('created_at', sevenDaysAgo);

  const weightMapCount = weights?.length || 0;

  // 5. Reply Priorities
  const { data: accounts, error: accountsError } = await supabase
    .from('discovered_accounts')
    .select('priority_score');

  const totalAccounts = accounts?.length || 0;
  const nonZeroPriority = accounts?.filter((a: any) => (a.priority_score || 0) > 0).length || 0;
  const priorityPercentage = totalAccounts > 0 ? ((nonZeroPriority / totalAccounts) * 100).toFixed(1) : '0.0';

  // 6. Experiments
  const { data: experiments, error: expError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('experiment_group, hook_variant, created_at')
    .gte('created_at', sevenDaysAgo)
    .not('experiment_group', 'is', null);

  const experimentCount = experiments?.length || 0;
  const byGroup: Record<string, number> = {};
  const byVariant: Record<string, number> = {};

  experiments?.forEach((e: any) => {
    if (e.experiment_group) {
      byGroup[e.experiment_group] = (byGroup[e.experiment_group] || 0) + 1;
    }
    if (e.hook_variant) {
      byVariant[e.hook_variant] = (byVariant[e.hook_variant] || 0) + 1;
    }
  });

  return {
    v2Outcomes: {
      total: totalOutcomes,
      withV2,
      percentage: v2Percentage
    },
    contentSlots: {
      total: totalContent,
      withSlot,
      percentage: slotPercentage,
      bySlot: slotCounts
    },
    vwLearning: {
      rowCount: vwLearningCount
    },
    weightMaps: {
      rowCount: weightMapCount
    },
    replyPriorities: {
      total: totalAccounts,
      nonZero: nonZeroPriority,
      percentage: priorityPercentage
    },
    experiments: {
      total: experimentCount,
      byGroup,
      byVariant
    },
    phase4Routing: {
      coreVsExpert: 'not tracked in DB (log-only)'
    }
  };
}

function printReport(metrics: HealthMetrics) {
  console.log('');
  console.log('='.repeat(70));
  console.log('xBOT LEARNING HEALTH REPORT (LAST 7 DAYS)');
  console.log('='.repeat(70));
  console.log('');

  // V2 Outcomes
  console.log('[V2 OUTCOMES]');
  console.log(`  Total outcomes: ${metrics.v2Outcomes.total}`);
  console.log(`  With v2 fields: ${metrics.v2Outcomes.withV2}`);
  console.log(`  Coverage: ${metrics.v2Outcomes.withV2}/${metrics.v2Outcomes.total} = ${metrics.v2Outcomes.percentage}%`);
  console.log('');

  // Content Slots
  console.log('[CONTENT SLOTS]');
  console.log(`  Total rows: ${metrics.contentSlots.total}`);
  console.log(`  With content_slot: ${metrics.contentSlots.withSlot}`);
  console.log(`  Coverage: ${metrics.contentSlots.withSlot}/${metrics.contentSlots.total} = ${metrics.contentSlots.percentage}%`);
  if (Object.keys(metrics.contentSlots.bySlot).length > 0) {
    console.log('  By slot:');
    Object.entries(metrics.contentSlots.bySlot)
      .sort(([, a], [, b]) => b - a)
      .forEach(([slot, count]) => {
        console.log(`    ${slot}: ${count}`);
      });
  }
  console.log('');

  // vw_learning
  console.log('[VW_LEARNING]');
  console.log(`  Rows (last 7 days): ${metrics.vwLearning.rowCount}`);
  console.log('');

  // Weight Maps
  console.log('[WEIGHT MAPS]');
  console.log(`  Rows (last 7 days): ${metrics.weightMaps.rowCount}`);
  console.log('');

  // Reply Priorities
  console.log('[REPLY PRIORITIES]');
  console.log(`  Total accounts: ${metrics.replyPriorities.total}`);
  console.log(`  Non-zero priority: ${metrics.replyPriorities.nonZero}`);
  console.log(`  Coverage: ${metrics.replyPriorities.nonZero}/${metrics.replyPriorities.total} = ${metrics.replyPriorities.percentage}%`);
  console.log('');

  // Experiments
  console.log('[EXPERIMENTS]');
  if (metrics.experiments.total === 0) {
    console.log('  Status: Experiments currently OFF or no experiment data in last 7 days');
  } else {
    console.log(`  Total rows with experiments: ${metrics.experiments.total}`);
    if (Object.keys(metrics.experiments.byGroup).length > 0) {
      console.log('  By experiment_group:');
      Object.entries(metrics.experiments.byGroup).forEach(([group, count]) => {
        console.log(`    ${group}: ${count}`);
      });
    }
    if (Object.keys(metrics.experiments.byVariant).length > 0) {
      console.log('  By hook_variant:');
      Object.entries(metrics.experiments.byVariant).forEach(([variant, count]) => {
        console.log(`    ${variant}: ${count}`);
      });
    }
  }
  console.log('');

  // Phase 4 Routing
  console.log('[PHASE 4 ROUTING]');
  console.log(`  Core vs Expert usage: ${metrics.phase4Routing.coreVsExpert}`);
  console.log('');

  console.log('='.repeat(70));
  console.log('REPORT COMPLETE');
  console.log('='.repeat(70));
  console.log('');
}

async function main() {
  try {
    console.log('[LEARNING_HEALTH] 🔍 Generating health report...');
    
    const metrics = await generateHealthReport();
    printReport(metrics);
    
    console.log('[LEARNING_HEALTH] ✅ Report generated successfully');
    process.exit(0);
  } catch (error: any) {
    console.error('');
    console.error('[LEARNING_HEALTH] ❌ Failed to generate report:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();


/**
 * Collect Phase 4 Readiness Metrics
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

async function collectMetrics() {
  console.log('='.repeat(60));
  console.log('PHASE 4 METRICS COLLECTION');
  console.log('='.repeat(60));
  console.log('');

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // 1. v2 outcomes
  console.log('1. v2 outcomes coverage (last 3 days):');
  const { data: outcomes, error: outcomesError } = await supabase
    .from('outcomes')
    .select('followers_gained_weighted, primary_objective_score, collected_at')
    .gte('collected_at', threeDaysAgo);

  if (outcomesError) {
    console.log(`   Error: ${outcomesError.message}`);
  } else {
    const total = outcomes?.length || 0;
    const withV2 = outcomes?.filter((o: any) =>
      o.followers_gained_weighted !== null &&
      o.primary_objective_score !== null
    ).length || 0;
    const pct = total > 0 ? ((withV2 / total) * 100).toFixed(1) : '0.0';
    console.log(`   Total: ${total}`);
    console.log(`   With v2 fields: ${withV2} (${pct}%)`);
  }
  console.log('');

  // 2. content_slot coverage
  console.log('2. content_slot coverage (last 3 days):');
  const { data: content, error: contentError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('content_slot, created_at')
    .gte('created_at', threeDaysAgo);

  if (contentError) {
    console.log(`   Error: ${contentError.message}`);
  } else {
    const total = content?.length || 0;
    const withSlot = content?.filter((c: any) => c.content_slot !== null && c.content_slot !== undefined).length || 0;
    const pct = total > 0 ? ((withSlot / total) * 100).toFixed(1) : '0.0';
    console.log(`   Total: ${total}`);
    console.log(`   With slot: ${withSlot} (${pct}%)`);
  }
  console.log('');

  // 3. priority_score coverage
  console.log('3. priority_score coverage:');
  const { data: accounts, error: accountsError } = await supabase
    .from('discovered_accounts')
    .select('priority_score');

  if (accountsError) {
    console.log(`   Error: ${accountsError.message}`);
  } else {
    const total = accounts?.length || 0;
    const nonZero = accounts?.filter((a: any) => (a.priority_score || 0) > 0).length || 0;
    const pct = total > 0 ? ((nonZero / total) * 100).toFixed(1) : '0.0';
    console.log(`   Total accounts: ${total}`);
    console.log(`   Non-zero priority: ${nonZero} (${pct}%)`);
  }
  console.log('');

  // 4. vw_learning rows
  console.log('4. vw_learning rows (last 3 days):');
  try {
    const { data: vwData, error: vwError } = await supabase
      .from('vw_learning')
      .select('decision_id')
      .gte('posted_at', threeDaysAgo);

    if (vwError) {
      console.log(`   Error: ${vwError.message}`);
    } else {
      console.log(`   Rows: ${vwData?.length || 0}`);
    }
  } catch (err: any) {
    console.log(`   Error: ${err.message}`);
  }
  console.log('');

  // 5. weight maps
  console.log('5. weight maps (last 3 days):');
  const { data: weights, error: weightsError } = await supabase
    .from('learning_model_weights')
    .select('id, created_at')
    .gte('created_at', threeDaysAgo);

  if (weightsError) {
    console.log(`   Error: ${weightsError.message}`);
  } else {
    console.log(`   Rows: ${weights?.length || 0}`);
  }
  console.log('');

  console.log('='.repeat(60));
  console.log('METRICS COLLECTION COMPLETE');
  console.log('='.repeat(60));
}

collectMetrics().catch(console.error);


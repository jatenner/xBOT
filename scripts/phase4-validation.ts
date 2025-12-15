/**
 * Phase 4 Validation Script
 * 
 * Validates migrations, schema, and data health for Phase 4 rollout
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('='.repeat(60));
  console.log('PHASE 4 VALIDATION & ROLLOUT PREP');
  console.log('='.repeat(60));
  console.log('');

  // STEP 1: Verify Migrations & Schema
  console.log('STEP 1: VERIFYING MIGRATIONS & SCHEMA');
  console.log('-'.repeat(60));

  // Check if experiment columns exist by trying to query them
  try {
    const { data: testData, error: testError } = await supabase
      .from('content_metadata')
      .select('content_slot, experiment_group, hook_variant')
      .limit(1);

    if (testError) {
      if (testError.message.includes('experiment_group') || testError.message.includes('hook_variant')) {
        console.log('⚠️  Migration 20250116_add_experiment_metadata.sql may not be applied yet');
        console.log(`   Error: ${testError.message}`);
        console.log('   Action: Migration needs to be applied via Supabase CLI');
      } else {
        console.log(`⚠️  Error querying content_metadata: ${testError.message}`);
      }
    } else {
      console.log('✅ content_metadata view accessible');
      console.log('✅ Columns exist: content_slot, experiment_group, hook_variant');
    }
  } catch (err: any) {
    console.log(`⚠️  Error checking schema: ${err.message}`);
  }

  console.log('');

  // STEP 2: Phase 4 Data Health Snapshot
  console.log('STEP 2: PHASE 4 DATA HEALTH SNAPSHOT (LAST 3 DAYS)');
  console.log('-'.repeat(60));

  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  // 1. v2 outcomes coverage
  try {
    const { data: outcomes, error: outcomesError } = await supabase
      .from('outcomes')
      .select('followers_gained_weighted, primary_objective_score, collected_at')
      .gte('collected_at', threeDaysAgo);

    if (outcomesError) {
      console.log(`1. v2 outcomes coverage: Error - ${outcomesError.message}`);
    } else {
      const total = outcomes?.length || 0;
      const withV2 = outcomes?.filter((o: any) =>
        o.followers_gained_weighted !== null &&
        o.primary_objective_score !== null
      ).length || 0;
      const pct = total > 0 ? ((withV2 / total) * 100).toFixed(1) : '0.0';

      console.log('1. v2 outcomes coverage:');
      console.log(`   Total: ${total}`);
      console.log(`   With v2 fields: ${withV2}`);
      console.log(`   Percentage: ${pct}%`);
    }
  } catch (err: any) {
    console.log(`1. v2 outcomes coverage: Error - ${err.message}`);
  }

  console.log('');

  // 2. content_slot coverage
  try {
    const { data: content, error: contentError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('content_slot, created_at')
      .gte('created_at', threeDaysAgo);

    if (contentError) {
      console.log(`2. content_slot coverage: Error - ${contentError.message}`);
    } else {
      const total = content?.length || 0;
      const withSlot = content?.filter((c: any) => c.content_slot !== null && c.content_slot !== undefined).length || 0;
      const pct = total > 0 ? ((withSlot / total) * 100).toFixed(1) : '0.0';

      console.log('2. content_slot coverage:');
      console.log(`   Total: ${total}`);
      console.log(`   With slot: ${withSlot}`);
      console.log(`   Percentage: ${pct}%`);
    }
  } catch (err: any) {
    console.log(`2. content_slot coverage: Error - ${err.message}`);
  }

  console.log('');

  // 3. priority_score coverage
  try {
    const { data: accounts, error: accountsError } = await supabase
      .from('discovered_accounts')
      .select('priority_score');

    if (accountsError) {
      console.log(`3. priority_score coverage: Error - ${accountsError.message}`);
    } else {
      const total = accounts?.length || 0;
      const nonZero = accounts?.filter((a: any) => (a.priority_score || 0) > 0).length || 0;
      const pct = total > 0 ? ((nonZero / total) * 100).toFixed(1) : '0.0';

      console.log('3. priority_score coverage:');
      console.log(`   Total accounts: ${total}`);
      console.log(`   Non-zero priority: ${nonZero}`);
      console.log(`   Percentage: ${pct}%`);
    }
  } catch (err: any) {
    console.log(`3. priority_score coverage: Error - ${err.message}`);
  }

  console.log('');

  // 4. experiment metadata
  try {
    const { data: experiments, error: expError } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('experiment_group, hook_variant, created_at')
      .gte('created_at', threeDaysAgo)
      .not('experiment_group', 'is', null);

    if (expError) {
      if (expError.message.includes('experiment_group') || expError.message.includes('hook_variant')) {
        console.log('4. experiment metadata:');
        console.log(`   ⚠️  Migration not applied yet: ${expError.message}`);
        console.log('   (Columns will be available after migration is applied)');
      } else {
        console.log(`4. experiment metadata: Error - ${expError.message}`);
      }
    } else {
      const total = experiments?.length || 0;
      const variantA = experiments?.filter((e: any) => e.hook_variant === 'A').length || 0;
      const variantB = experiments?.filter((e: any) => e.hook_variant === 'B').length || 0;

      console.log('4. experiment metadata:');
      console.log(`   Total with experiment_group: ${total}`);
      console.log(`   Variant A: ${variantA}`);
      console.log(`   Variant B: ${variantB}`);
    }
  } catch (err: any) {
    console.log(`4. experiment metadata: Error - ${err.message}`);
  }

  console.log('');

  // 5. slot performance
  console.log('5. slot performance (sample slots):');
  const slots = ['deep_dive', 'framework', 'research', 'practical_tip', 'myth_busting'];

  for (const slot of slots) {
    try {
      const { data: slotData, error: slotError } = await supabase
        .from('vw_learning')
        .select('primary_objective_score')
        .eq('content_slot', slot)
        .gte('posted_at', threeDaysAgo)
        .not('primary_objective_score', 'is', null)
        .limit(100);

      if (slotError) {
        console.log(`   ${slot}: Error - ${slotError.message}`);
      } else if (!slotData || slotData.length === 0) {
        console.log(`   ${slot}: No data yet`);
      } else {
        const scores = slotData.map((r: any) => r.primary_objective_score).filter((s: any) => s !== null);
        const avg = scores.reduce((sum: number, s: number) => sum + s, 0) / scores.length;
        const status = avg < 0.5 ? 'LOW' : avg >= 0.7 ? 'HIGH' : 'MEDIUM';
        console.log(`   ${slot}: ${avg.toFixed(3)} (${status}, n=${scores.length})`);
      }
    } catch (err: any) {
      console.log(`   ${slot}: Error - ${err.message}`);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('VALIDATION COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);


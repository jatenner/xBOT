#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function runFinalAssessment() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  console.log('PHASE 4 READINESS ASSESSMENT - FINAL');
  console.log('='.repeat(60));
  console.log('Time: ' + new Date().toISOString());
  console.log('');
  
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  
  // Query 1: v2 outcomes
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('followers_gained_weighted, primary_objective_score, collected_at')
    .gte('collected_at', threeDaysAgo)
    .order('collected_at', { ascending: false });
  
  const totalOutcomes = outcomes?.length || 0;
  const withV2 = outcomes?.filter(o => 
    o.followers_gained_weighted !== null && 
    o.followers_gained_weighted !== undefined &&
    o.primary_objective_score !== null &&
    o.primary_objective_score !== undefined
  ).length || 0;
  const pct1 = totalOutcomes > 0 ? ((withV2 / totalOutcomes) * 100).toFixed(1) : '0.0';
  
  console.log('1) v2 outcomes (last 3 days):');
  console.log(`   Total: ${totalOutcomes}`);
  console.log(`   With v2: ${withV2}`);
  console.log(`   Percentage: ${pct1}%`);
  console.log('');
  
  // Query 2: content_slot - query base table directly
  const { data: content } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('content_slot, created_at')
    .gte('created_at', threeDaysAgo)
    .order('created_at', { ascending: false });
  
  const totalContent = content?.length || 0;
  const withSlot = content?.filter(c => c.content_slot !== null && c.content_slot !== undefined).length || 0;
  const pct2 = totalContent > 0 ? ((withSlot / totalContent) * 100).toFixed(1) : '0.0';
  
  console.log('2) content_slot (last 3 days):');
  console.log(`   Total: ${totalContent}`);
  console.log(`   With slot: ${withSlot}`);
  console.log(`   Percentage: ${pct2}%`);
  console.log('');
  
  // Query 3: vw_learning
  const { data: vwLearning } = await supabase
    .from('vw_learning')
    .select('decision_id')
    .gte('posted_at', threeDaysAgo);
  
  const vwCount = vwLearning?.length || 0;
  console.log('3) vw_learning rows (last 3 days):');
  console.log(`   Rows: ${vwCount}`);
  console.log('');
  
  // Query 4: weight maps
  const { data: weights } = await supabase
    .from('learning_model_weights')
    .select('id, created_at')
    .gte('created_at', threeDaysAgo)
    .order('created_at', { ascending: false });
  
  const weightCount = weights?.length || 0;
  console.log('4) Weight maps (last 3 days):');
  console.log(`   Count: ${weightCount}`);
  console.log('');
  
  // Query 5: reply priorities
  const { data: accounts } = await supabase
    .from('discovered_accounts')
    .select('priority_score');
  
  const totalAccounts = accounts?.length || 0;
  const nonZero = accounts?.filter(a => (a.priority_score || 0) > 0).length || 0;
  const pct5 = totalAccounts > 0 ? ((nonZero / totalAccounts) * 100).toFixed(1) : '0.0';
  
  console.log('5) Reply priorities:');
  console.log(`   Total accounts: ${totalAccounts}`);
  console.log(`   Non-zero priority: ${nonZero}`);
  console.log(`   Percentage: ${pct5}%`);
  console.log('');
  console.log('='.repeat(60));
  
  // Final verdict
  console.log('FINAL VERDICT:');
  console.log('='.repeat(60));
  
  const issues = [];
  
  if (totalOutcomes === 0) {
    issues.push('No outcomes collected in last 3 days');
  } else if (withV2 === 0) {
    issues.push('v2 outcomes fields 0% populated');
  }
  
  if (totalContent === 0) {
    issues.push('No content created in last 3 days');
  } else if (withSlot === 0) {
    issues.push('content_slot 0% populated');
  }
  
  if (vwCount === 0) {
    issues.push('vw_learning has no recent rows');
  }
  
  if (weightCount === 0) {
    issues.push('No weight maps generated in last 3 days');
  }
  
  if (nonZero === 0) {
    issues.push('All priority_score values are zero');
  }
  
  if (issues.length === 0) {
    console.log('✅ READY FOR PHASE 4');
    console.log('');
    console.log('All systems operational:');
    console.log('  - v2 outcomes are being populated');
    console.log('  - content_slot is being stored');
    console.log('  - vw_learning has recent data');
    console.log('  - Weight maps are being generated');
    console.log('  - Priority scores are being updated');
  } else {
    console.log('❌ NOT READY FOR PHASE 4');
    console.log('');
    console.log('Remaining blockers:');
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }
}

runFinalAssessment()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  });


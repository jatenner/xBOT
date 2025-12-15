/**
 * Phase 4 Smoke Test Script
 * 
 * Tests Phase 4 routing with ENABLE_PHASE4_ROUTING=true in a safe way
 * Run this locally or in dev environment, NOT in production
 */

import 'dotenv/config';

// Temporarily enable Phase 4 routing for this test
process.env.ENABLE_PHASE4_ROUTING = 'true';
process.env.ENABLE_PHASE4_EXPERIMENTS = 'true';

console.log('='.repeat(60));
console.log('PHASE 4 SMOKE TEST');
console.log('='.repeat(60));
console.log('');
console.log('⚠️  This test enables Phase 4 routing temporarily');
console.log('⚠️  Make sure you are NOT running this in production');
console.log('');
console.log('Configuration:');
console.log(`  ENABLE_PHASE4_ROUTING: ${process.env.ENABLE_PHASE4_ROUTING}`);
console.log(`  ENABLE_PHASE4_EXPERIMENTS: ${process.env.ENABLE_PHASE4_EXPERIMENTS}`);
console.log('');

async function testPlanJob() {
  console.log('TEST 1: planJob with Phase 4 routing');
  console.log('-'.repeat(60));
  
  try {
    // Import and run planJob
    const { planContent } = await import('../src/jobs/planJob');
    await planContent();
    console.log('✅ planJob completed successfully');
  } catch (error: any) {
    console.error('❌ planJob failed:', error.message);
    console.error(error.stack);
    throw error;
  }
  
  console.log('');
}

async function testReplyJob() {
  console.log('TEST 2: replyJob with Phase 4 routing');
  console.log('-'.repeat(60));
  
  try {
    // Import and run replyJob
    const { generateReplies } = await import('../src/jobs/replyJob');
    await generateReplies();
    console.log('✅ replyJob completed successfully');
  } catch (error: any) {
    console.error('❌ replyJob failed:', error.message);
    console.error(error.stack);
    throw error;
  }
  
  console.log('');
}

async function verifyResults() {
  console.log('VERIFICATION: Check for Phase 4 logs and new content');
  console.log('-'.repeat(60));
  
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  // Check recent content for Phase 4 indicators
  const { data: recentContent, error } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, content_slot, experiment_group, hook_variant, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.log(`⚠️  Error querying content: ${error.message}`);
  } else {
    console.log('Recent content (last 5 rows):');
    recentContent?.forEach((row: any, i: number) => {
      console.log(`  ${i + 1}. decision_id=${row.decision_id}`);
      console.log(`     content_slot=${row.content_slot || 'NULL'}`);
      console.log(`     experiment_group=${row.experiment_group || 'NULL'}`);
      console.log(`     hook_variant=${row.hook_variant || 'NULL'}`);
      console.log(`     created_at=${row.created_at}`);
      console.log('');
    });
  }
}

async function main() {
  try {
    await testPlanJob();
    await testReplyJob();
    await verifyResults();
    
    console.log('='.repeat(60));
    console.log('SMOKE TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('');
    console.log('✅ All tests passed');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Review logs above for [PHASE4] entries');
    console.log('  2. Verify ExpertOrchestrator was used for high-value content');
    console.log('  3. Verify BudgetController logs show budget checks');
    console.log('  4. Verify experiment metadata was assigned');
    console.log('  5. Check that new content has content_slot populated');
  } catch (error: any) {
    console.error('');
    console.error('='.repeat(60));
    console.error('SMOKE TEST FAILED');
    console.error('='.repeat(60));
    console.error(error.message);
    process.exit(1);
  }
}

main().catch(console.error);


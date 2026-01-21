#!/usr/bin/env tsx
/**
 * Test Growth Controller Recording (Idempotency)
 */

import 'dotenv/config';

async function testRecording() {
  console.log('🧪 Testing Growth Controller Recording & Idempotency\n');
  
  process.env.GROWTH_CONTROLLER_ENABLED = 'true';
  
  const { getActiveGrowthPlan, recordPost, canPost } = await import('../src/jobs/growthController');
  
  const plan = await getActiveGrowthPlan();
  if (!plan) {
    console.error('❌ No active plan');
    process.exit(1);
  }
  
  console.log(`📋 Plan: ${plan.plan_id}`);
  console.log(`   Targets: ${plan.target_posts} posts, ${plan.target_replies} replies\n`);
  
  // Check initial state
  console.log('1️⃣ Initial check:');
  const check1 = await canPost('reply');
  console.log(`   Reply allowed: ${check1.allowed}`);
  if (check1.execution) {
    console.log(`   Counters: ${check1.execution.replies_done} replies, ${check1.execution.posts_done} posts\n`);
  }
  
  // Record a reply
  console.log('2️⃣ Recording reply...');
  await recordPost(plan.plan_id, 'reply');
  console.log('   ✅ Recorded\n');
  
  // Check state after recording
  console.log('3️⃣ Check after recording:');
  const check2 = await canPost('reply');
  console.log(`   Reply allowed: ${check2.allowed}`);
  console.log(`   Reason: ${check2.reason}`);
  if (check2.execution) {
    console.log(`   Counters: ${check2.execution.replies_done} replies, ${check2.execution.posts_done} posts\n`);
  }
  
  // Record again (test idempotency)
  console.log('4️⃣ Recording reply again (idempotency test)...');
  await recordPost(plan.plan_id, 'reply');
  console.log('   ✅ Recorded\n');
  
  // Check state after second recording
  console.log('5️⃣ Check after second recording:');
  const check3 = await canPost('reply');
  console.log(`   Reply allowed: ${check3.allowed}`);
  console.log(`   Reason: ${check3.reason}`);
  if (check3.execution) {
    console.log(`   Counters: ${check3.execution.replies_done} replies, ${check3.execution.posts_done} posts\n`);
  }
  
  // Summary
  console.log('📊 Summary:');
  console.log(`   Initial: ${check1.execution?.replies_done || 0} replies`);
  console.log(`   After 1st record: ${check2.execution?.replies_done || 0} replies`);
  console.log(`   After 2nd record: ${check3.execution?.replies_done || 0} replies`);
  console.log(`   Idempotent: ${check2.execution?.replies_done === check3.execution?.replies_done ? '✅' : '❌'} (should be same)`);
  console.log(`   Blocked correctly: ${!check3.allowed ? '✅' : '❌'} (should be blocked after limit)`);
  
  process.exit(0);
}

testRecording().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

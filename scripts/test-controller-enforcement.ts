#!/usr/bin/env tsx
/**
 * Test Growth Controller Enforcement
 */

import 'dotenv/config';

async function testEnforcement() {
  console.log('🧪 Testing Growth Controller Enforcement\n');
  
  // Enable controller
  process.env.GROWTH_CONTROLLER_ENABLED = 'true';
  
  const { getActiveGrowthPlan, canPost, getGrowthExecution } = await import('../src/jobs/growthController');
  
  // Get active plan
  const plan = await getActiveGrowthPlan();
  if (!plan) {
    console.error('❌ No active plan found');
    process.exit(1);
  }
  
  console.log(`📋 Active Plan:`);
  console.log(`   plan_id: ${plan.plan_id}`);
  console.log(`   target_posts: ${plan.target_posts}`);
  console.log(`   target_replies: ${plan.target_replies}`);
  console.log(`   window: ${plan.window_start} → ${plan.window_end}\n`);
  
  // Get execution
  const execution = await getGrowthExecution(plan.plan_id);
  if (!execution) {
    console.log('⚠️  No execution record yet (will be created on first post)');
  } else {
    console.log(`📊 Current Execution:`);
    console.log(`   posts_done: ${execution.posts_done}`);
    console.log(`   replies_done: ${execution.replies_done}\n`);
  }
  
  // Test canPost for reply
  console.log('🧪 Testing canPost("reply"):');
  const replyCheck = await canPost('reply');
  console.log(`   allowed: ${replyCheck.allowed}`);
  console.log(`   reason: ${replyCheck.reason}`);
  
  if (replyCheck.execution) {
    console.log(`   execution.replies_done: ${replyCheck.execution.replies_done}/${plan.target_replies}`);
  }
  console.log('');
  
  // Test canPost for single
  console.log('🧪 Testing canPost("single"):');
  const singleCheck = await canPost('single');
  console.log(`   allowed: ${singleCheck.allowed}`);
  console.log(`   reason: ${singleCheck.reason}`);
  
  if (singleCheck.execution) {
    console.log(`   execution.posts_done: ${singleCheck.execution.posts_done}/${plan.target_posts}`);
  }
  console.log('');
  
  // Summary
  console.log('📊 Summary:');
  console.log(`   Reply allowed: ${replyCheck.allowed ? '✅' : '❌'} (expected: ${plan.target_replies > (execution?.replies_done || 0) ? '✅' : '❌'})`);
  console.log(`   Post allowed: ${singleCheck.allowed ? '✅' : '❌'} (expected: ${plan.target_posts > (execution?.posts_done || 0) ? '✅' : '❌'})`);
  
  process.exit(0);
}

testEnforcement().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

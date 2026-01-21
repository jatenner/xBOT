#!/usr/bin/env tsx
/**
 * Test Growth Controller Disable (Fallback)
 */

import 'dotenv/config';

async function testDisable() {
  console.log('🧪 Testing Growth Controller Disable (Fallback)\n');
  
  // Disable controller
  process.env.GROWTH_CONTROLLER_ENABLED = 'false';
  
  const { getActiveGrowthPlan, canPost } = await import('../src/jobs/growthController');
  
  // Try to get plan (should return null when disabled)
  const plan = await getActiveGrowthPlan();
  
  console.log('1️⃣ Controller disabled check:');
  console.log(`   GROWTH_CONTROLLER_ENABLED: ${process.env.GROWTH_CONTROLLER_ENABLED}`);
  console.log(`   getActiveGrowthPlan(): ${plan ? 'found plan' : 'null (expected)'}\n`);
  
  // Test canPost (should allow when controller disabled)
  console.log('2️⃣ Testing canPost() when disabled:');
  const check = await canPost('reply');
  console.log(`   allowed: ${check.allowed}`);
  console.log(`   reason: ${check.reason}`);
  console.log(`   plan: ${check.plan ? 'found' : 'null (expected)'}\n`);
  
  // Summary
  console.log('📊 Summary:');
  console.log(`   Plan returned: ${plan ? '❌ (should be null)' : '✅ (null as expected)'}`);
  console.log(`   canPost allowed: ${check.allowed ? '✅' : '❌'} (should be true when disabled)`);
  console.log(`   Reason: ${check.reason}`);
  console.log(`   Fallback working: ${check.allowed && !check.plan ? '✅' : '❌'}`);
  
  process.exit(0);
}

testDisable().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

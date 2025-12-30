#!/usr/bin/env tsx
/**
 * 🔍 X AUTOMATION VERIFICATION
 * 
 * Verifies that X.com automation is not blocked by Cloudflare/human verification.
 * Checks /ready endpoint for xAutomationOk status.
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

interface ReadyResponse {
  ready: boolean;
  xAutomationOk: boolean;
  xAutomationBlocked: boolean;
  xAutomationLastError: string | null;
  envOk: boolean;
  dbOk: boolean;
  jobsOk: boolean;
}

async function main() {
  console.log('🔍 X AUTOMATION VERIFICATION');
  console.log(`   Target: ${BASE_URL}`);
  console.log('');
  
  let allPass = true;
  
  // Test 1: Check /ready endpoint for xAutomationOk
  console.log('Test 1: GET /ready (X automation status)...');
  try {
    const readyResp = await fetch(`${BASE_URL}/ready`);
    const readyData = await readyResp.json() as ReadyResponse;
    
    console.log(`   - HTTP Status: ${readyResp.status}`);
    console.log(`   - ready: ${readyData.ready}`);
    console.log(`   - xAutomationOk: ${readyData.xAutomationOk}`);
    console.log(`   - xAutomationBlocked: ${readyData.xAutomationBlocked}`);
    console.log(`   - xAutomationLastError: ${readyData.xAutomationLastError || 'none'}`);
    
    if (!readyData.xAutomationOk) {
      console.log(`❌ FAIL: X automation is blocked`);
      console.log(`   Reason: ${readyData.xAutomationLastError || 'unknown'}`);
      allPass = false;
    } else {
      console.log(`✅ PASS: X automation is operational`);
    }
  } catch (error: any) {
    console.log(`❌ FAIL: /ready request failed: ${error.message}`);
    allPass = false;
  }
  
  console.log('');
  console.log('═══════════════════════════════════════');
  
  if (allPass) {
    console.log('✅ X AUTOMATION IS OPERATIONAL');
    process.exit(0);
  } else {
    console.log('❌ X AUTOMATION IS BLOCKED OR UNAVAILABLE');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Check Railway logs for [X_BLOCKED] messages');
    console.log('  2. Wait for cooldown period to expire (default: 60 minutes)');
    console.log('  3. Verify X.com is not presenting CAPTCHA/human verification');
    console.log('  4. Consider using X API posting as fallback (FEATURE_X_API_POSTING=true)');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Verification script error:', error.message);
  process.exit(1);
});


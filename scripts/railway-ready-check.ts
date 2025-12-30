#!/usr/bin/env tsx
/**
 * 🚂 RAILWAY READINESS CHECK
 * 
 * Verifies Railway deployment is fully operational:
 * - /status returns 200 (healthcheck)
 * - /ready returns 200 (true operational readiness)
 * - All critical systems are online (envOk, dbOk, jobsOk)
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

interface StatusResponse {
  ok: boolean;
  ready: boolean;
  degraded: boolean;
  lastError: string | null;
}

interface ReadyResponse {
  ready: boolean;
  envOk: boolean;
  dbOk: boolean;
  jobsOk: boolean;
  recoveryOk: boolean;
  invariantCheckOk: boolean;
  profileRecoveryOk: boolean;
  degraded: boolean;
  lastError: string | null;
}

async function main() {
  console.log('🚂 RAILWAY READINESS CHECK');
  console.log(`   Target: ${BASE_URL}`);
  console.log('');
  
  let allPass = true;
  
  // Test 1: /status must return 200 (healthcheck)
  console.log('Test 1: GET /status (healthcheck)...');
  try {
    const statusResp = await fetch(`${BASE_URL}/status`);
    const statusData = await statusResp.json() as StatusResponse;
    
    if (statusResp.status !== 200) {
      console.log(`❌ FAIL: /status returned ${statusResp.status} (expected 200)`);
      allPass = false;
    } else {
      console.log(`✅ PASS: /status returned 200`);
      console.log(`   - ok: ${statusData.ok}`);
      console.log(`   - ready: ${statusData.ready}`);
      console.log(`   - degraded: ${statusData.degraded}`);
      console.log(`   - lastError: ${statusData.lastError || 'none'}`);
    }
  } catch (error: any) {
    console.log(`❌ FAIL: /status request failed: ${error.message}`);
    allPass = false;
  }
  
  console.log('');
  
  // Test 2: /ready must return 200 with all systems ok
  console.log('Test 2: GET /ready (operational readiness)...');
  try {
    const readyResp = await fetch(`${BASE_URL}/ready`);
    const readyData = await readyResp.json() as ReadyResponse;
    
    if (readyResp.status !== 200) {
      console.log(`❌ FAIL: /ready returned ${readyResp.status} (expected 200)`);
      console.log(`   System state:`);
      console.log(`   - ready: ${readyData.ready}`);
      console.log(`   - envOk: ${readyData.envOk}`);
      console.log(`   - dbOk: ${readyData.dbOk}`);
      console.log(`   - jobsOk: ${readyData.jobsOk}`);
      console.log(`   - recoveryOk: ${readyData.recoveryOk}`);
      console.log(`   - invariantCheckOk: ${readyData.invariantCheckOk}`);
      console.log(`   - profileRecoveryOk: ${readyData.profileRecoveryOk}`);
      console.log(`   - degraded: ${readyData.degraded}`);
      console.log(`   - lastError: ${readyData.lastError || 'none'}`);
      allPass = false;
    } else {
      console.log(`✅ PASS: /ready returned 200`);
      console.log(`   - ready: ${readyData.ready}`);
      console.log(`   - envOk: ${readyData.envOk}`);
      console.log(`   - dbOk: ${readyData.dbOk}`);
      console.log(`   - jobsOk: ${readyData.jobsOk}`);
      console.log(`   - recoveryOk: ${readyData.recoveryOk}`);
      console.log(`   - invariantCheckOk: ${readyData.invariantCheckOk}`);
      console.log(`   - profileRecoveryOk: ${readyData.profileRecoveryOk}`);
      console.log(`   - degraded: ${readyData.degraded}`);
      
      // Verify critical systems
      if (!readyData.envOk) {
        console.log(`   ⚠️  WARNING: envOk=false`);
      }
      if (!readyData.dbOk) {
        console.log(`   ⚠️  WARNING: dbOk=false`);
        allPass = false;
      }
      if (!readyData.jobsOk) {
        console.log(`   ⚠️  WARNING: jobsOk=false`);
        allPass = false;
      }
    }
  } catch (error: any) {
    console.log(`❌ FAIL: /ready request failed: ${error.message}`);
    allPass = false;
  }
  
  console.log('');
  console.log('═══════════════════════════════════════');
  
  if (allPass) {
    console.log('✅ ALL CHECKS PASSED - Railway deployment is ready');
    process.exit(0);
  } else {
    console.log('❌ CHECKS FAILED - Railway deployment has issues');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Check script error:', error.message);
  process.exit(1);
});


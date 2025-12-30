#!/usr/bin/env tsx
/**
 * 🔍 RAILWAY VERIFICATION SCRIPT
 * 
 * Tests /status and /ready endpoints to verify Railway deployment health
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

interface StatusResponse {
  ok: boolean;
  ts: number;
  version: string;
  uptime: number;
  pid: number;
  ready: boolean;
  degraded: boolean;
  lastError: string | null;
}

interface ReadyResponse {
  ready: boolean;
  ts: number;
  uptime: number;
  envOk: boolean;
  dbOk: boolean;
  jobsOk: boolean;
  degraded: boolean;
  lastError: string | null;
  message?: string;
}

async function testEndpoint(path: string, expectedStatus: number): Promise<{ pass: boolean; data: any; status: number }> {
  try {
    const response = await fetch(`${BASE_URL}${path}`);
    const data = await response.json();
    const pass = response.status === expectedStatus;
    
    return { pass, data, status: response.status };
  } catch (error: any) {
    console.error(`❌ FAIL: ${path} - ${error.message}`);
    return { pass: false, data: null, status: 0 };
  }
}

async function main() {
  console.log('🔍 RAILWAY VERIFICATION');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log('');
  
  let allPass = true;
  
  // Test 1: /status should always return 200
  console.log('Test 1: GET /status (healthcheck)');
  const statusResult = await testEndpoint('/status', 200);
  
  if (statusResult.pass) {
    const data = statusResult.data as StatusResponse;
    console.log(`✅ PASS: /status returned 200`);
    console.log(`   - ok: ${data.ok}`);
    console.log(`   - ready: ${data.ready}`);
    console.log(`   - degraded: ${data.degraded}`);
    console.log(`   - uptime: ${data.uptime}s`);
    console.log(`   - pid: ${data.pid}`);
    console.log(`   - lastError: ${data.lastError || 'none'}`);
  } else {
    console.log(`❌ FAIL: /status returned ${statusResult.status} (expected 200)`);
    allPass = false;
  }
  
  console.log('');
  
  // Test 2: /ready should return 200 if ready, 503 if not
  console.log('Test 2: GET /ready (readiness check)');
  const readyResult = await testEndpoint('/ready', -1); // Accept any status
  
  if (readyResult.status === 200) {
    const data = readyResult.data as ReadyResponse;
    console.log(`✅ PASS: /ready returned 200 (system is ready)`);
    console.log(`   - ready: ${data.ready}`);
    console.log(`   - envOk: ${data.envOk}`);
    console.log(`   - dbOk: ${data.dbOk}`);
    console.log(`   - jobsOk: ${data.jobsOk}`);
    console.log(`   - degraded: ${data.degraded}`);
    console.log(`   - lastError: ${data.lastError || 'none'}`);
  } else if (readyResult.status === 503) {
    const data = readyResult.data as ReadyResponse;
    console.log(`⚠️  WARN: /ready returned 503 (system not ready yet)`);
    console.log(`   - ready: ${data.ready}`);
    console.log(`   - envOk: ${data.envOk}`);
    console.log(`   - dbOk: ${data.dbOk}`);
    console.log(`   - jobsOk: ${data.jobsOk}`);
    console.log(`   - degraded: ${data.degraded}`);
    console.log(`   - lastError: ${data.lastError || 'none'}`);
    console.log(`   - message: ${data.message || ''}`);
    console.log('');
    console.log('   ℹ️  This is normal during startup. Wait 30-60s and try again.');
  } else {
    console.log(`❌ FAIL: /ready returned ${readyResult.status} (expected 200 or 503)`);
    allPass = false;
  }
  
  console.log('');
  console.log('═══════════════════════════════════════');
  
  if (allPass && readyResult.status === 200) {
    console.log('✅ ALL TESTS PASSED - System is healthy and ready');
    process.exit(0);
  } else if (allPass && readyResult.status === 503) {
    console.log('⚠️  TESTS PASSED - System is starting (not ready yet)');
    process.exit(0);
  } else {
    console.log('❌ TESTS FAILED - System has issues');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Verification script error:', error.message);
  process.exit(1);
});


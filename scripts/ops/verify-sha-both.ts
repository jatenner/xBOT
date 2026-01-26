#!/usr/bin/env tsx
/**
 * Verify SHA and execution mode for both Railway services via /healthz endpoints
 * 
 * Usage:
 *   pnpm run verify:sha:both
 * 
 * Exits non-zero if:
 *   - SHAs don't match between services
 *   - executionMode != 'control' for either service
 *   - /healthz endpoints are unreachable
 */

const XBOT_URL = 'https://xbot-production-844b.up.railway.app';
const SERENE_URL = 'https://serene-cat-production.up.railway.app';

interface HealthzResponse {
  sha: string;
  railway_sha: string | null;
  app_sha: string | null;
  git_sha: string | null;
  serviceName: string;
  executionMode: string;
  runnerMode: boolean;
}

async function fetchHealthz(url: string, serviceName: string): Promise<HealthzResponse> {
  const cacheBust = `?ts=${Date.now()}`;
  const fullUrl = `${url}/healthz${cacheBust}`;
  
  try {
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as HealthzResponse;
    return data;
  } catch (error: any) {
    throw new Error(`Failed to fetch ${serviceName} /healthz: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 Verifying SHA and execution mode for both Railway services...\n');

  let xbotHealth: HealthzResponse;
  let sereneHealth: HealthzResponse;

  try {
    xbotHealth = await fetchHealthz(XBOT_URL, 'xBOT');
  } catch (error: any) {
    console.error(`❌ xBOT verification failed: ${error.message}`);
    process.exit(1);
  }

  try {
    sereneHealth = await fetchHealthz(SERENE_URL, 'serene-cat');
  } catch (error: any) {
    console.error(`❌ serene-cat verification failed: ${error.message}`);
    process.exit(1);
  }

  // Print results
  console.log('📊 Service Status:\n');
  console.log(`xBOT:`);
  console.log(`  sha: ${xbotHealth.sha}`);
  console.log(`  railway_sha: ${xbotHealth.railway_sha || 'null'}`);
  console.log(`  serviceName: ${xbotHealth.serviceName}`);
  console.log(`  executionMode: ${xbotHealth.executionMode}`);
  console.log(`  runnerMode: ${xbotHealth.runnerMode}`);
  console.log();
  console.log(`serene-cat:`);
  console.log(`  sha: ${sereneHealth.sha}`);
  console.log(`  railway_sha: ${sereneHealth.railway_sha || 'null'}`);
  console.log(`  serviceName: ${sereneHealth.serviceName}`);
  console.log(`  executionMode: ${sereneHealth.executionMode}`);
  console.log(`  runnerMode: ${sereneHealth.runnerMode}`);
  console.log();

  // Verify SHAs match
  if (xbotHealth.sha !== sereneHealth.sha) {
    console.error(`❌ SHA mismatch:`);
    console.error(`  xBOT: ${xbotHealth.sha}`);
    console.error(`  serene-cat: ${sereneHealth.sha}`);
    process.exit(1);
  }

  // Verify executionMode is 'control' for both
  if (xbotHealth.executionMode !== 'control') {
    console.error(`❌ xBOT executionMode is '${xbotHealth.executionMode}', expected 'control'`);
    process.exit(1);
  }

  if (sereneHealth.executionMode !== 'control') {
    console.error(`❌ serene-cat executionMode is '${sereneHealth.executionMode}', expected 'control'`);
    process.exit(1);
  }

  // Success
  console.log(`✅ Verification passed:`);
  console.log(`  Both services running SHA: ${xbotHealth.sha}`);
  console.log(`  Both services in executionMode: control`);
  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

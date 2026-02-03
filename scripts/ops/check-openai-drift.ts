#!/usr/bin/env tsx
/**
 * 🔍 OpenAI Key Drift Detector
 * 
 * Compares OpenAI API key fingerprints between local executor and Railway services.
 * Fails fast if keys don't match.
 * 
 * Usage:
 *   pnpm run ops:check:openai-drift
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface Fingerprint {
  present: boolean;
  length: number;
  masked: string;
  prefix: string;
  suffix: string;
  hash: string;
  hasWhitespace: boolean;
  hasQuotes: boolean;
  envVarName: string;
}

/**
 * Get local fingerprint
 */
function getLocalFingerprint(): Fingerprint {
  const output = execSync('pnpm run ops:fingerprint:openai', {
    encoding: 'utf-8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  // Extract JSON from output (last JSON block)
  const jsonMatch = output.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse fingerprint JSON');
  }

  return JSON.parse(jsonMatch[0]) as Fingerprint;
}

/**
 * Get Railway service fingerprint
 */
function getRailwayFingerprint(serviceName: string): Fingerprint | null {
  try {
    const output = execSync(
      `railway run --service ${serviceName} -- pnpm run ops:fingerprint:openai`,
      {
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe'],
        timeout: 30000,
      }
    );

    // Extract JSON from output (last JSON block)
    const jsonMatch = output.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`⚠️  Failed to parse fingerprint JSON from ${serviceName}`);
      return null;
    }

    return JSON.parse(jsonMatch[0]) as Fingerprint;
  } catch (error: any) {
    if (error.message?.includes('not found') || error.message?.includes('No service')) {
      console.warn(`⚠️  Service ${serviceName} not found or not accessible`);
      return null;
    }
    console.warn(`⚠️  Failed to get fingerprint from ${serviceName}: ${error.message}`);
    return null;
  }
}

/**
 * Compare fingerprints and report drift
 */
function compareFingerprints(
  local: Fingerprint,
  railway: Fingerprint | null,
  serviceName: string
): { match: boolean; details: string } {
  if (!railway) {
    return {
      match: false,
      details: `Could not retrieve fingerprint from ${serviceName}`,
    };
  }

  if (local.hash !== railway.hash) {
    return {
      match: false,
      details: `Hash mismatch: local=${local.hash.substring(0, 16)}... vs ${serviceName}=${railway.hash.substring(0, 16)}...`,
    };
  }

  return {
    match: true,
    details: `Hash match: ${local.hash.substring(0, 16)}...`,
  };
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 OpenAI Key Drift Detection');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Step 1: Get local fingerprint
  console.log('📋 Step 1: Getting local fingerprint...');
  let localFingerprint: Fingerprint;
  try {
    localFingerprint = getLocalFingerprint();
    console.log(`   ✅ Local: ${localFingerprint.masked} (hash: ${localFingerprint.hash.substring(0, 16)}...)`);
  } catch (error: any) {
    console.error(`   ❌ Failed to get local fingerprint: ${error.message}`);
    process.exit(1);
  }
  console.log();

  // Step 2: Get Railway fingerprints
  console.log('📋 Step 2: Getting Railway fingerprints...');
  
  const services = ['xBOT', 'serene-cat'];
  const railwayFingerprints: Record<string, Fingerprint | null> = {};
  
  for (const service of services) {
    try {
      console.log(`   Checking ${service}...`);
      railwayFingerprints[service] = getRailwayFingerprint(service);
      if (railwayFingerprints[service]) {
        const fp = railwayFingerprints[service]!;
        console.log(`   ✅ ${service}: ${fp.masked} (hash: ${fp.hash.substring(0, 16)}...)`);
      } else {
        console.log(`   ⚠️  ${service}: Could not retrieve fingerprint`);
      }
    } catch (error: any) {
      console.log(`   ⚠️  ${service}: ${error.message}`);
      railwayFingerprints[service] = null;
    }
  }
  console.log();

  // Step 3: Compare and report
  console.log('📋 Step 3: Comparing fingerprints...\n');
  
  const results: Array<{ service: string; match: boolean; details: string }> = [];
  let allMatch = true;

  for (const service of services) {
    const railway = railwayFingerprints[service];
    const comparison = compareFingerprints(localFingerprint, railway, service);
    results.push({
      service,
      match: comparison.match,
      details: comparison.details,
    });
    
    if (!comparison.match) {
      allMatch = false;
    }
  }

  // Print comparison table
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Comparison Results:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('| Environment | Status | Hash (first 16 chars) |');
  console.log('|-------------|--------|----------------------|');
  console.log(`| Local       | ✅     | ${localFingerprint.hash.substring(0, 16)}... |`);
  
  for (const result of results) {
    const railway = railwayFingerprints[result.service];
    const status = result.match ? '✅ Match' : '❌ Mismatch';
    const hash = railway ? railway.hash.substring(0, 16) + '...' : 'N/A';
    console.log(`| ${result.service.padEnd(11)} | ${status.padEnd(6)} | ${hash.padEnd(20)} |`);
  }
  console.log();

  // Final verdict
  if (allMatch) {
    console.log('✅ PASS: All fingerprints match');
    console.log('   All environments are using the same OpenAI API key.');
    process.exit(0);
  } else {
    console.log('❌ FAIL: Key drift detected');
    console.log('\n   Key fingerprints do not match between environments.');
    console.log('   This means different OpenAI API keys are being used.');
    console.log('\n   Next steps:');
    console.log('   1. Decide which key is correct (local or Railway)');
    console.log('   2. Update the incorrect environment:');
    console.log('      - Local: Update OPENAI_API_KEY in .env.local');
    console.log('      - Railway: Update OPENAI_API_KEY via Railway dashboard or CLI');
    console.log('   3. If updating local: Reload LaunchAgent:');
    console.log('      pnpm run executor:uninstall-service');
    console.log('      pnpm run executor:install-service');
    console.log('   4. Re-run drift check: pnpm run ops:check:openai-drift');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n❌ FATAL: Drift detection error:', error.message);
  process.exit(1);
});

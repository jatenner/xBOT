#!/usr/bin/env tsx
/**
 * 🚀 DEPLOY AND VERIFY BOTH SERVICES
 * 
 * Deploys to Railway and verifies BOTH services (xBOT worker + serene-cat main)
 * have matching SHA fingerprints.
 */

import { execSync, spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

const localSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const buildTime = new Date().toISOString();

console.log('═══════════════════════════════════════════════════════');
console.log('🚀 DEPLOY AND VERIFY BOTH SERVICES');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`Local SHA: ${localSha}`);
console.log(`Build time: ${buildTime}\n`);

// Service names (current production setup)
const WORKER_SERVICE = 'xBOT'; // xBOT is worker (SERVICE_ROLE=worker)
const MAIN_SERVICE = 'serene-cat'; // serene-cat is main (jobs disabled)

// Step 1: Set Railway env vars for both services
console.log('1️⃣  Setting Railway environment variables...');
try {
  execSync(`railway variables --set "APP_COMMIT_SHA=${localSha}" -s ${WORKER_SERVICE}`, { stdio: 'inherit' });
  execSync(`railway variables --set "APP_BUILD_TIME=${buildTime}" -s ${WORKER_SERVICE}`, { stdio: 'inherit' });
  
  // Try to set for main service (may not exist)
  try {
    execSync(`railway variables --set "APP_COMMIT_SHA=${localSha}" -s ${MAIN_SERVICE}`, { stdio: 'inherit' });
    execSync(`railway variables --set "APP_BUILD_TIME=${buildTime}" -s ${MAIN_SERVICE}`, { stdio: 'inherit' });
  } catch (e: any) {
    console.warn(`⚠️  Could not set vars for ${MAIN_SERVICE}: ${e.message}`);
    console.warn('   Continuing - main service may not exist or use different name\n');
  }
  
  console.log('✅ Environment variables set\n');
} catch (error: any) {
  console.warn(`⚠️  Failed to set env vars: ${error.message}`);
  console.warn('   Continuing - vars might already exist\n');
}

// Step 2: Deploy (single deploy should update both if they share codebase)
console.log('2️⃣  Deploying to Railway...');
const child = spawn('railway', ['up', '--detach'], { stdio: 'inherit' });

child.on('close', async (code) => {
  if (code !== 0) {
    console.error(`\n❌ Deploy failed with exit code ${code}`);
    process.exit(1);
  }
  
  console.log('\n3️⃣  Waiting for [BOOT] sha= lines in logs for both services...');
  console.log(`   Looking for: sha=${localSha.substring(0, 8)}...\n`);
  
  // Wait for both services to show boot fingerprint
  const servicesToCheck = [WORKER_SERVICE];
  
  // Try to check main service (may not exist)
  try {
    execSync(`railway logs -n 10 -s ${MAIN_SERVICE}`, { stdio: 'ignore' });
    servicesToCheck.push(MAIN_SERVICE);
  } catch {
    console.log(`   Note: ${MAIN_SERVICE} service not found, only checking ${WORKER_SERVICE}\n`);
  }
  
  const start = Date.now();
  const maxWait = 10 * 60 * 1000; // 10 minutes
  const verifiedServices = new Set<string>();
  let lastCheck = 0;
  
  const checkInterval = setInterval(async () => {
    try {
      for (const serviceName of servicesToCheck) {
        if (verifiedServices.has(serviceName)) continue;
        
        try {
          const logs = execSync(`railway logs -n 500 -s ${serviceName}`, { 
            encoding: 'utf8', 
            maxBuffer: 5 * 1024 * 1024 
          });
          
          // Look for boot fingerprint (with jobs_enabled)
          const match = logs.match(/\[BOOT\] sha=([^\s]+) build_time=([^\s]+) service_role=([^\s]+) railway_service=([^\s]+) jobs_enabled=([^\s]+)/);
          
          if (match) {
            const [, sha, buildTime, serviceRole, railwayService, jobsEnabled] = match;
            console.log(`✅ Found boot fingerprint for ${serviceName}:`);
            console.log(`   sha=${sha}`);
            console.log(`   build_time=${buildTime}`);
            console.log(`   service_role=${serviceRole}`);
            console.log(`   railway_service=${railwayService}`);
            console.log(`   jobs_enabled=${jobsEnabled}\n`);
            
            if (sha === localSha) {
              console.log(`✅ VERIFIED: ${serviceName} SHA matches local SHA`);
              verifiedServices.add(serviceName);
            } else {
              console.error(`❌ SHA MISMATCH for ${serviceName}:`);
              console.error(`   Expected: ${localSha.substring(0, 8)}`);
              console.error(`   Got:      ${sha.substring(0, 8)}`);
              console.error(`   Service is still running old code!\n`);
              clearInterval(checkInterval);
              process.exit(1);
            }
          }
          
          // Check for build errors
          if (logs.includes('Build failed') || logs.match(/error:\s*[^\n]*$/m)) {
            const errorLines = logs.split('\n').filter(l => l.includes('error:') || l.includes('ERROR')).slice(-5);
            if (errorLines.length > 0) {
              console.error(`\n❌ Build error detected for ${serviceName}:`);
              errorLines.forEach(line => console.error(`   ${line}`));
              clearInterval(checkInterval);
              process.exit(1);
            }
          }
        } catch (e: any) {
          // Service may not exist, continue
        }
      }
      
      // Check if all services verified
      if (verifiedServices.size === servicesToCheck.length) {
        console.log('═══════════════════════════════════════════════════════');
        console.log('✅ ALL SERVICES VERIFIED');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`All services running commit: ${localSha.substring(0, 8)}`);
        console.log(`Build time: ${buildTime}\n`);
        clearInterval(checkInterval);
        process.exit(0);
      }
      
      // Progress update every 30 seconds
      const elapsed = Math.floor((Date.now() - start) / 1000);
      if (elapsed - lastCheck >= 30) {
        const remaining = Math.floor((maxWait - (Date.now() - start)) / 1000);
        const verified = Array.from(verifiedServices).join(', ') || 'none';
        console.log(`⏳ Still waiting... (${elapsed}s elapsed, ${remaining}s remaining)`);
        console.log(`   Verified: ${verified || 'none'}\n`);
        lastCheck = elapsed;
      }
    } catch (e: any) {
      // Continue waiting on errors
    }
    
    if (Date.now() - start > maxWait) {
      console.error('\n❌ TIMEOUT: Not all services showed [BOOT] sha= line after 10 minutes');
      console.error(`   Verified: ${Array.from(verifiedServices).join(', ') || 'none'}`);
      console.error(`   Missing: ${servicesToCheck.filter(s => !verifiedServices.has(s)).join(', ')}`);
      console.error('   Check Railway dashboard for build status\n');
      clearInterval(checkInterval);
      process.exit(1);
    }
  }, 5000);
});

child.on('error', (error) => {
  console.error(`\n❌ Failed to start Railway deploy: ${error.message}`);
  process.exit(1);
});

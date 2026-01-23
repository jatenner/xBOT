#!/usr/bin/env tsx
/**
 * 🚀 DEPLOY AND VERIFY
 * 
 * Deploys to Railway and waits for verification that the new code is ACTIVE.
 */

import { execSync, spawn } from 'child_process';

const localSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const buildTime = new Date().toISOString();

console.log('═══════════════════════════════════════════════════════');
console.log('🚀 DEPLOY AND VERIFY');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`Local SHA: ${localSha}`);
console.log(`Build time: ${buildTime}\n`);

// Step 1: Set Railway env vars
console.log('1️⃣  Setting Railway environment variables...');
try {
  execSync(`railway variables --set "APP_COMMIT_SHA=${localSha}"`, { stdio: 'inherit' });
  execSync(`railway variables --set "APP_BUILD_TIME=${buildTime}"`, { stdio: 'inherit' });
  console.log('✅ Environment variables set\n');
} catch (error: any) {
  console.warn(`⚠️  Failed to set env vars: ${error.message}`);
  console.warn('   Continuing - vars might already exist\n');
}

// Step 2: Deploy
console.log('2️⃣  Deploying to Railway...');
const child = spawn('railway', ['up', '--detach'], { stdio: 'inherit' });

child.on('close', (code) => {
  if (code !== 0) {
    console.error(`\n❌ Deploy failed with exit code ${code}`);
    process.exit(1);
  }
  
  console.log('\n3️⃣  Waiting for [BOOT] sha= line in logs...');
  console.log(`   Looking for: sha=${localSha.substring(0, 8)}...\n`);
  
  const start = Date.now();
  const maxWait = 10 * 60 * 1000; // 10 minutes
  let lastCheck = 0;
  
  const checkInterval = setInterval(() => {
    try {
      const logs = execSync('railway logs -n 300', { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
      
      // Look for boot fingerprint
      const match = logs.match(/\[BOOT\] sha=([^\s]+) build_time=([^\s]+) service_role=([^\s]+) railway_service=([^\s]+)/);
      
      if (match) {
        const [, sha, buildTime, serviceRole, railwayService] = match;
        console.log(`✅ Found boot fingerprint:`);
        console.log(`   sha=${sha}`);
        console.log(`   build_time=${buildTime}`);
        console.log(`   service_role=${serviceRole}`);
        console.log(`   railway_service=${railwayService}\n`);
        
        if (sha === localSha) {
          console.log('✅ VERIFIED: Deployed SHA matches local SHA');
          console.log(`   Service is running commit ${sha.substring(0, 8)}\n`);
          clearInterval(checkInterval);
          process.exit(0);
        } else {
          console.error(`❌ SHA MISMATCH:`);
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
          console.error('\n❌ Build error detected:');
          errorLines.forEach(line => console.error(`   ${line}`));
          clearInterval(checkInterval);
          process.exit(1);
        }
      }
      
      // Progress update every 30 seconds
      const elapsed = Math.floor((Date.now() - start) / 1000);
      if (elapsed - lastCheck >= 30) {
        const remaining = Math.floor((maxWait - (Date.now() - start)) / 1000);
        console.log(`⏳ Still waiting... (${elapsed}s elapsed, ${remaining}s remaining)`);
        lastCheck = elapsed;
      }
    } catch (e: any) {
      // Continue waiting on errors
    }
    
    if (Date.now() - start > maxWait) {
      console.error('\n❌ TIMEOUT: [BOOT] sha= line not found after 10 minutes');
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

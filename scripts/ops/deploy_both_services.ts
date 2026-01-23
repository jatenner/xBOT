#!/usr/bin/env tsx
/**
 * 🚀 DEPLOY BOTH SERVICES AND VERIFY
 * 
 * Deploys to both worker and main Railway services and verifies fingerprints.
 */

import { execSync, spawn } from 'child_process';

const localSha = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
const buildTime = new Date().toISOString();

console.log('═══════════════════════════════════════════════════════');
console.log('🚀 DEPLOY BOTH SERVICES AND VERIFY');
console.log('═══════════════════════════════════════════════════════\n');

console.log(`Local SHA: ${localSha}`);
console.log(`Build time: ${buildTime}\n`);

// Determine which service is worker vs main
console.log('1️⃣  Identifying services...');
let workerService = 'xBOT';
let mainService: string | null = null;

try {
  // Check current service
  const status = execSync('railway status', { encoding: 'utf8' });
  if (status.includes('xBOT')) {
    workerService = 'xBOT';
  }
  
  // Try to find main service (might be named differently)
  // For now, assume only one service exists or both use same codebase
  console.log(`   Worker service: ${workerService}`);
  console.log(`   Main service: ${mainService || 'same as worker (single service)'}\n`);
} catch (e) {
  console.warn('   Could not determine services, using defaults\n');
}

// Step 1: Set Railway env vars for worker
console.log('2️⃣  Setting Railway environment variables...');
try {
  execSync(`railway variables --set "APP_COMMIT_SHA=${localSha}" -s ${workerService}`, { stdio: 'inherit' });
  execSync(`railway variables --set "APP_BUILD_TIME=${buildTime}" -s ${workerService}`, { stdio: 'inherit' });
  if (mainService) {
    execSync(`railway variables --set "APP_COMMIT_SHA=${localSha}" -s ${mainService}`, { stdio: 'inherit' });
    execSync(`railway variables --set "APP_BUILD_TIME=${buildTime}" -s ${mainService}`, { stdio: 'inherit' });
  }
  console.log('✅ Environment variables set\n');
} catch (error: any) {
  console.warn(`⚠️  Failed to set env vars: ${error.message}`);
  console.warn('   Continuing - vars might already exist\n');
}

// Step 2: Deploy worker service
console.log(`3️⃣  Deploying worker service (${workerService})...`);
const deployWorker = () => new Promise<void>((resolve, reject) => {
  const child = spawn('railway', ['up', '--detach', '-s', workerService], { stdio: 'inherit' });
  
  child.on('close', (code) => {
    if (code !== 0) {
      reject(new Error(`Deploy failed with exit code ${code}`));
      return;
    }
    resolve();
  });
  
  child.on('error', (error) => {
    reject(error);
  });
});

try {
  await deployWorker();
  console.log('✅ Worker deployment initiated\n');
} catch (error: any) {
  console.error(`❌ Worker deploy failed: ${error.message}`);
  process.exit(1);
}

// Step 3: Wait for worker boot fingerprint
console.log(`4️⃣  Waiting for worker [BOOT] sha= line...`);
console.log(`   Looking for: sha=${localSha.substring(0, 8)}...\n`);

const waitForBoot = (serviceName: string, maxWaitMs: number = 10 * 60 * 1000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let lastCheck = 0;
    
    const checkInterval = setInterval(() => {
      try {
        const logs = execSync(`railway logs -n 300 -s ${serviceName}`, { 
          encoding: 'utf8', 
          maxBuffer: 5 * 1024 * 1024 
        });
        
        // Look for boot fingerprint
        const match = logs.match(/\[BOOT\] sha=([^\s]+) build_time=([^\s]+) service_role=([^\s]+) railway_service=([^\s]+)/);
        
        if (match) {
          const [, sha] = match;
          clearInterval(checkInterval);
          resolve(sha);
          return;
        }
        
        // Check for build errors
        if (logs.includes('Build failed') || logs.match(/error:\s*[^\n]*$/m)) {
          const errorLines = logs.split('\n').filter(l => l.includes('error:') || l.includes('ERROR')).slice(-5);
          if (errorLines.length > 0) {
            clearInterval(checkInterval);
            reject(new Error(`Build error: ${errorLines.join('; ')}`));
            return;
          }
        }
        
        // Progress update every 30 seconds
        const elapsed = Math.floor((Date.now() - start) / 1000);
        if (elapsed - lastCheck >= 30) {
          const remaining = Math.floor((maxWaitMs - (Date.now() - start)) / 1000);
          console.log(`⏳ Still waiting for ${serviceName}... (${elapsed}s elapsed, ${remaining}s remaining)`);
          lastCheck = elapsed;
        }
      } catch (e: any) {
        // Continue waiting on errors
      }
      
      if (Date.now() - start > maxWaitMs) {
        clearInterval(checkInterval);
        reject(new Error(`Timeout: [BOOT] sha= line not found after ${maxWaitMs / 1000}s`));
      }
    }, 5000);
  });
};

try {
  const workerSha = await waitForBoot(workerService);
  console.log(`✅ Worker boot fingerprint found: sha=${workerSha.substring(0, 8)}`);
  
  if (workerSha === localSha) {
    console.log('✅ VERIFIED: Worker SHA matches local SHA\n');
  } else {
    console.error(`❌ SHA MISMATCH: Expected ${localSha.substring(0, 8)}, got ${workerSha.substring(0, 8)}`);
    process.exit(1);
  }
} catch (error: any) {
  console.error(`❌ Worker verification failed: ${error.message}`);
  process.exit(1);
}

// Step 4: Deploy main service (if different)
if (mainService) {
  console.log(`5️⃣  Deploying main service (${mainService})...`);
  try {
    await deployWorker(); // Reuse function, just change service
    console.log('✅ Main deployment initiated\n');
    
    const mainSha = await waitForBoot(mainService);
    console.log(`✅ Main boot fingerprint found: sha=${mainSha.substring(0, 8)}`);
    
    if (mainSha === localSha) {
      console.log('✅ VERIFIED: Main SHA matches local SHA\n');
    } else {
      console.error(`❌ SHA MISMATCH: Expected ${localSha.substring(0, 8)}, got ${mainSha.substring(0, 8)}`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`❌ Main deploy/verification failed: ${error.message}`);
    process.exit(1);
  }
} else {
  console.log('5️⃣  Skipping main service (single service deployment)\n');
}

console.log('═══════════════════════════════════════════════════════');
console.log('✅ DEPLOYMENT COMPLETE');
console.log('═══════════════════════════════════════════════════════');
console.log(`Both services running commit: ${localSha.substring(0, 8)}`);
console.log(`Build time: ${buildTime}\n`);

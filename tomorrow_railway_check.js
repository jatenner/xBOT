#!/usr/bin/env node

/**
 * 🕐 RAILWAY RATE LIMIT - TOMORROW'S RECOVERY PLAN
 * ===============================================
 * Smart waiting strategy with minimal API calls
 */

const { spawn } = require('child_process');

async function checkRateLimitStatus() {
  return new Promise((resolve) => {
    const p = spawn('railway', ['whoami'], { stdio: 'pipe' });
    let stderr = '';
    
    p.stderr.on('data', d => stderr += d.toString());
    p.on('close', code => {
      const output = stderr.toLowerCase();
      
      if (output.includes('being ratelimited') || output.includes('rate-limited')) {
        resolve({ status: 'RATE_LIMITED', message: stderr.trim() });
      } else if (output.includes('unauthorized')) {
        resolve({ status: 'READY_TO_AUTH', message: stderr.trim() });
      } else if (code === 0) {
        resolve({ status: 'AUTHENTICATED', message: 'Already logged in' });
      } else {
        resolve({ status: 'UNKNOWN', message: stderr.trim() });
      }
    });
  });
}

async function main() {
  const now = new Date();
  const timeString = now.toLocaleString();
  
  console.log(`🕐 RAILWAY STATUS CHECK - ${timeString}`);
  console.log('='.repeat(50));
  
  const result = await checkRateLimitStatus();
  
  console.log(`Status: ${result.status}`);
  console.log(`Message: ${result.message}`);
  console.log('');
  
  switch (result.status) {
    case 'RATE_LIMITED':
      console.log('❌ Still rate limited');
      console.log('⏳ Continue waiting - try again in a few hours');
      console.log('');
      console.log('📋 When ready tomorrow:');
      console.log('1. railway login');
      console.log('2. railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1');
      console.log('3. node bulletproof_railway_monitor_sre.js');
      break;
      
    case 'READY_TO_AUTH':
      console.log('🎉 RATE LIMIT CLEARED! Ready to authenticate');
      console.log('');
      console.log('Next steps:');
      console.log('1. railway login');
      console.log('2. railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1');
      console.log('3. node bulletproof_railway_monitor_sre.js');
      break;
      
    case 'AUTHENTICATED':
      console.log('✅ Already authenticated! Testing project access...');
      
      // Test project access
      const linkTest = spawn('railway', ['status'], { stdio: 'pipe' });
      linkTest.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Full Railway access restored!');
          console.log('Ready to start: node bulletproof_railway_monitor_sre.js');
        } else {
          console.log('⚠️ Authenticated but need to link project:');
          console.log('railway link --project c987ff2e-2bc7-4c65-9187-11c1a82d4ac1');
        }
      });
      break;
      
    default:
      console.log('❓ Unknown status - manual check needed');
      break;
  }
  
  console.log('');
  console.log(`Last checked: ${timeString}`);
}

main().catch(console.error);

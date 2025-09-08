#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 RELIABLE LOG MONITOR - NO HANGING GUARANTEED');
console.log('===============================================');
console.log('✨ Features:');
console.log('   ⏰ Auto-timeout every 30 seconds');
console.log('   🔄 Bounded reads (no infinite streams)');
console.log('   🎯 Focused on deployment & overlay fixes');
console.log('   🚫 NO hanging or stalling');
console.log('');

let logCount = 0;
const maxLogs = 100; // Limit to prevent overflow
const timeoutMs = 30000; // 30 second timeout

function runBoundedLogs() {
  console.log(`📡 Reading latest logs (attempt ${++logCount})...`);
  
  const railway = spawn('railway', ['logs'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  let hasOutput = false;
  let lineCount = 0;
  const maxLines = 50; // Limit lines per read
  
  const timeout = setTimeout(() => {
    console.log('⏰ TIMEOUT: Killing railway logs process to prevent hanging');
    railway.kill('SIGKILL');
  }, timeoutMs);
  
  railway.stdout.on('data', (data) => {
    hasOutput = true;
    const lines = data.toString().split('\n');
    
    for (const line of lines) {
      if (lineCount >= maxLines) break;
      
      // Filter for important logs only
      if (line.includes('BULLETPROOF_POSTER') || 
          line.includes('overlay') || 
          line.includes('twc-cc-mask') ||
          line.includes('Dismissed overlay') ||
          line.includes('POST_SUCCESS') ||
          line.includes('Compose modal opened') ||
          line.includes('Human-like delay') ||
          line.includes('realistic browser headers')) {
        console.log(line);
        lineCount++;
      }
    }
  });
  
  railway.stderr.on('data', (data) => {
    console.error('❌ Railway error:', data.toString().trim());
  });
  
  railway.on('close', (code) => {
    clearTimeout(timeout);
    
    if (!hasOutput) {
      console.log('⚠️ No new logs found');
    }
    
    console.log(`📊 Log read complete (${lineCount} relevant lines)`);
    console.log('');
    
    if (logCount >= 5) {
      console.log('🎯 MONITORING COMPLETE - 5 attempts finished');
      console.log('');
      console.log('🔍 SUMMARY:');
      console.log('• Look for: "🔧 Checking for Twitter overlays..."');
      console.log('• Look for: "✅ Dismissed overlay: [data-testid=\\"twc-cc-mask\\"]"');
      console.log('• Look for: "✅ Post button clicked successfully"');
      console.log('');
      process.exit(0);
    }
    
    // Wait 10 seconds before next attempt
    console.log('⏳ Waiting 10 seconds before next check...');
    setTimeout(runBoundedLogs, 10000);
  });
  
  railway.on('error', (err) => {
    clearTimeout(timeout);
    console.error('❌ Railway command error:', err.message);
    
    // Try again after delay
    setTimeout(runBoundedLogs, 10000);
  });
}

// Start monitoring
console.log('🎯 MONITORING FOR OVERLAY FIX DEPLOYMENT...');
console.log('');
runBoundedLogs();

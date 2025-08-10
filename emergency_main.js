#!/usr/bin/env node

/**
 * 🚨 EMERGENCY MAIN - Memory Crisis Mode
 * Absolute minimal system: post every 30 minutes, <400MB memory
 */

console.log('🚨 EMERGENCY MODE: Memory Crisis Recovery');
console.log('🎯 Target: <400MB memory usage');
console.log('⚡ Function: Posting only, all intelligence disabled');

const { EmergencyMinimalPoster } = require('./dist/utils/emergencyMinimalPoster');

const poster = new EmergencyMinimalPoster();

async function emergencyPost() {
  const content = `Health tip ${Date.now()}: Stay hydrated! Drink 8 glasses of water daily for optimal health. #HealthTips`;
  const success = await poster.post(content);
  console.log(`📊 Post result: ${success ? 'SUCCESS' : 'FAILED'}`);
  
  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
}

// Post every 30 minutes (Railway memory-safe interval)
setInterval(emergencyPost, 30 * 60 * 1000);

// Initial post
emergencyPost();

console.log('🔄 Emergency posting schedule started (30-minute intervals)');

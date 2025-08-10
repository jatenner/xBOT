#!/usr/bin/env node

/**
 * 🚨 EMERGENCY STARTUP WITH STRICT MEMORY LIMITS
 */

console.log('🚨 Starting in EMERGENCY MEMORY MODE');
console.log('Memory limit: 400MB (Railway: 512MB)');

// Set Node.js memory limit to 400MB
process.env.NODE_OPTIONS = '--max_old_space_size=400 --gc_interval=100';

// Enable garbage collection
if (global.gc) {
  // Force GC every 30 seconds
  setInterval(() => {
    const before = process.memoryUsage().rss;
    global.gc();
    const after = process.memoryUsage().rss;
    const freed = Math.round((before - after) / 1024 / 1024);
    if (freed > 5) {
      console.log(`♻️ GC freed ${freed}MB`);
    }
  }, 30000);
}

// Memory monitoring
setInterval(() => {
  const usage = process.memoryUsage();
  const rssMB = Math.round(usage.rss / 1024 / 1024);
  
  if (rssMB > 450) {
    console.log(`🚨 CRITICAL: Memory ${rssMB}MB > 450MB limit!`);
    process.exit(1); // Emergency restart
  } else if (rssMB > 400) {
    console.log(`⚠️ WARNING: Memory ${rssMB}MB > 400MB target`);
    if (global.gc) global.gc();
  }
}, 10000);

// Start the main application
require('./dist/main.js');

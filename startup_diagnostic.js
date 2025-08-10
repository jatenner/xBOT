#!/usr/bin/env node

console.log('🩺 === RAILWAY STARTUP DIAGNOSTIC ===');
console.log('Time:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);

// Memory check
const memory = process.memoryUsage();
console.log(`💾 Memory at startup: ${Math.round(memory.heapUsed / 1024 / 1024)}MB heap`);
console.log(`💾 Memory RSS: ${Math.round(memory.rss / 1024 / 1024)}MB`);

// Environment check
console.log('🌍 NODE_ENV:', process.env.NODE_ENV);
console.log('🌍 Railway detected:', !!process.env.RAILWAY_ENVIRONMENT_ID);
console.log('🌍 PORT:', process.env.PORT);

// File system check
const fs = require('fs');
console.log('📁 Current directory:', process.cwd());

try {
  const distFiles = fs.readdirSync('./dist').slice(0, 10);
  console.log('📁 dist/ contents:', distFiles.join(', '));
  
  if (fs.existsSync('./dist/simpleMain.js')) {
    const stats = fs.statSync('./dist/simpleMain.js');
    console.log(`📁 simpleMain.js exists: ${Math.round(stats.size/1024)}KB`);
  } else {
    console.log('❌ simpleMain.js NOT FOUND!');
  }
  
} catch (error) {
  console.log('❌ Error reading dist:', error.message);
}

// Package.json check
try {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
  console.log('📋 Start script:', pkg.scripts.start);
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}

console.log('🩺 === DIAGNOSTIC COMPLETE ===\n');
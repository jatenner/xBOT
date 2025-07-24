#!/usr/bin/env node

// JavaScript wrapper for Render deployment
// This ensures we crash immediately if build failed

const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Snap2Health Ghost Killer Bot (JS Wrapper)...');

// Get the correct paths
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const mainFile = path.join(distDir, 'main.js');

console.log(`📂 Root directory: ${rootDir}`);
console.log(`📂 Dist directory: ${distDir}`);

// Check if dist folder exists
if (!fs.existsSync(distDir)) {
  console.error('❌ dist folder not found! This is a build-time error.');
  console.error('💡 Solution: Ensure TypeScript compilation completed successfully during build');
  process.exit(1);
}

// Check if dist/main.js exists
if (!fs.existsSync(mainFile)) {
  console.error('❌ CRITICAL: dist/main.js not found!');
  console.error('💡 This indicates the TypeScript build failed.');
  console.error('🔧 Ensure "npm run build" completes successfully before deployment.');
  process.exit(1);
}

console.log('✅ dist/main.js found, starting bot...');

// Import and run the compiled JavaScript
try {
  require(mainFile);
} catch (error) {
  console.error('❌ Failed to start bot:', error);
  process.exit(1);
}
// Force deployment Thu Jul 24 14:34:18 EDT 2025

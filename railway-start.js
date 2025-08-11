#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Railway startup script starting...');
console.log('🌐 Working directory:', process.cwd());
console.log('🎭 Installing Playwright browsers (CRITICAL for browser automation)...');

// Install Playwright browsers first with better Railway compatibility
const playwright = spawn('npx', ['playwright', 'install', 'chromium'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  timeout: 180000 // 3 minutes timeout for Railway
});

playwright.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Playwright browsers installed successfully');
  } else {
    console.error('❌ Playwright installation failed with code:', code);
    console.log('🆘 Will handle browser installation at runtime...');
  }
  
  console.log('🤖 Starting main application...');
  
  // Start the main application
  const main = spawn('node', ['dist/main.js'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: { 
      ...process.env, 
      PLAYWRIGHT_RUNTIME_INSTALL: 'true' // Signal to install at runtime if needed
    }
  });
  
  main.on('close', (code) => {
    console.log(`🛑 Main application exited with code ${code}`);
    process.exit(code);
  });
  
  main.on('error', (error) => {
    console.error('💥 Main application error:', error);
    process.exit(1);
  });
});

playwright.on('error', (error) => {
  console.error('💥 Playwright installation error:', error);
  console.log('🆘 Starting without Playwright...');
  
  // Start the main app anyway
  const main = spawn('node', ['dist/main.js'], {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  main.on('close', (code) => {
    process.exit(code);
  });
});
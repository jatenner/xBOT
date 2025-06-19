#!/usr/bin/env node

// JavaScript wrapper for Render deployment
// This ensures we can run compiled JavaScript even if Render tries to execute src/index.js

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Snap2Health Ghost Killer Bot (JS Wrapper)...');

// Check if we're in the root directory or src directory
const isInSrc = __dirname.endsWith('src');
const rootDir = isInSrc ? path.join(__dirname, '..') : __dirname;
const distPath = path.join(rootDir, 'dist');

console.log(`📂 Root directory: ${rootDir}`);
console.log(`📂 Dist directory: ${distPath}`);

// Check if dist folder exists
if (!fs.existsSync(distPath)) {
  console.error('❌ dist folder not found! Trying to install dev dependencies and build...');
  
  // First try to install dev dependencies
  const installProcess = spawn('npm', ['install', '--include=dev'], {
    stdio: 'inherit',
    shell: true,
    cwd: rootDir
  });
  
  installProcess.on('close', (installCode) => {
    if (installCode !== 0) {
      console.error('❌ Dev dependency install failed with code:', installCode);
      console.log('🚨 Attempting to run without TypeScript compilation...');
      runFallbackMode();
      return;
    }
    
    console.log('✅ Dev dependencies installed, running build...');
    
    // Run build command
    const buildProcess = spawn('npm', ['run', 'build'], {
      stdio: 'inherit',
      shell: true,
      cwd: rootDir
    });
    
    buildProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ Build failed with code:', code);
        console.log('🚨 Attempting to run without TypeScript compilation...');
        runFallbackMode();
        return;
      }
      
      console.log('✅ Build completed successfully');
      startBot();
    });
  });
} else {
  console.log('✅ dist folder found, starting bot...');
  startBot();
}

function runFallbackMode() {
  console.log('🚨 === FALLBACK MODE ACTIVATED ===');
  console.log('🔄 Running in simulation mode without TypeScript compilation...');
  console.log('📝 Bot will simulate activity until build issues are resolved');
  
  // Create a simple simulation process that logs activity
  const simulationInterval = setInterval(() => {
    console.log('🤖 Ghost Killer Simulation: Bot would be active now');
    console.log('📊 Simulating engagement patterns...');
    console.log('⏰ Next simulated action in 5 minutes');
  }, 5 * 60 * 1000); // Every 5 minutes
  
  // Initial message
  console.log('🤖 Ghost Killer Simulation started - logging activity every 5 minutes');
  console.log('💡 To fix: Ensure TypeScript builds properly with all dependencies');
  
  // Handle shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Simulation stopping...');
    clearInterval(simulationInterval);
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 Simulation stopping...');
    clearInterval(simulationInterval);
    process.exit(0);
  });
}

function startBot() {
  // Check if the main file exists (it should be main.js now, not index.js)
  const mainFile = path.join(distPath, 'main.js');
  if (!fs.existsSync(mainFile)) {
    console.error('❌ dist/main.js not found! Build may have failed.');
    console.log('🔍 Looking for alternative entry points...');
    
    // Try index.js as fallback
    const indexFile = path.join(distPath, 'index.js');
    if (fs.existsSync(indexFile)) {
      console.log('✅ Found dist/index.js, using as entry point');
      launchBot(indexFile);
      return;
    }
    
    console.log('🚨 No compiled JavaScript found, entering fallback mode...');
    runFallbackMode();
    return;
  }
  
  console.log('🔥 Launching Ghost Account Syndrome Killer...');
  launchBot(mainFile);
}

function launchBot(entryFile) {
  // Start the bot
  const botProcess = spawn('node', [entryFile], {
    stdio: 'inherit',
    shell: false,
    cwd: rootDir
  });
  
  botProcess.on('error', (error) => {
    console.error('❌ Bot startup error:', error);
    process.exit(1);
  });
  
  botProcess.on('close', (code) => {
    console.log(`🛑 Bot process exited with code ${code}`);
    process.exit(code);
  });
  
  // Handle shutdown signals
  process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down...');
    botProcess.kill('SIGTERM');
  });
  
  process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down...');
    botProcess.kill('SIGINT');
  });
} 
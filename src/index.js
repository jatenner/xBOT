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
  console.error('❌ dist folder not found! Running build...');
  
  // Run build command
  const buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    shell: true,
    cwd: rootDir
  });
  
  buildProcess.on('close', (code) => {
    if (code !== 0) {
      console.error('❌ Build failed with code:', code);
      process.exit(1);
    }
    
    console.log('✅ Build completed successfully');
    startBot();
  });
} else {
  console.log('✅ dist folder found, starting bot...');
  startBot();
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
    
    process.exit(1);
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
#!/usr/bin/env node

// Simple Node.js starter for Render deployment
// This ensures we run the compiled JavaScript, not TypeScript

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Snap2Health Ghost Killer Bot...');

// Check if dist folder exists
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('❌ dist folder not found! Running build...');
  
  // Run build command
  const buildProcess = spawn('npm', ['run', 'build'], {
    stdio: 'inherit',
    shell: true
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
  // Check if the main file exists
  const mainFile = path.join(__dirname, 'dist', 'index.js');
  if (!fs.existsSync(mainFile)) {
    console.error('❌ dist/index.js not found! Build may have failed.');
    process.exit(1);
  }
  
  console.log('🔥 Launching Ghost Account Syndrome Killer...');
  
  // Start the bot
  const botProcess = spawn('node', ['dist/index.js'], {
    stdio: 'inherit',
    shell: false
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
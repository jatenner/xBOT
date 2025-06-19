#!/usr/bin/env node

// TypeScript redirect file for Render deployment
// Since Render keeps trying to run src/index.ts, let's give it what it wants
// but redirect to our JavaScript wrapper

import { spawn } from 'child_process';
import path from 'path';

console.log('🔄 TypeScript redirect activated - launching JavaScript wrapper...');

// Get the project root (go up one level from src)
const projectRoot = path.join(__dirname, '..');
const jsWrapper = path.join(projectRoot, 'src', 'index.js');

console.log(`📂 Project root: ${projectRoot}`);
console.log(`🚀 Launching: ${jsWrapper}`);

// Launch the JavaScript wrapper
const child = spawn('node', [jsWrapper], {
  stdio: 'inherit',
  cwd: projectRoot
});

child.on('error', (error) => {
  console.error('❌ Failed to launch JavaScript wrapper:', error);
  process.exit(1);
});

child.on('close', (code) => {
  console.log(`🛑 JavaScript wrapper exited with code ${code}`);
  process.exit(code);
});

// Handle shutdown signals
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down...');
  child.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down...');
  child.kill('SIGINT');
}); 
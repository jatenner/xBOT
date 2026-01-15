#!/usr/bin/env tsx
/**
 * 🌐 CHROME CDP LAUNCHER
 * 
 * Launches system Google Chrome with CDP enabled for Playwright connection
 * 
 * Usage:
 *   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile tsx scripts/runner/chrome-cdp.ts
 */

import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);
const CDP_PROFILE_DIR = path.join(RUNNER_PROFILE_DIR, '.chrome-cdp-profile');

/**
 * Find system Chrome executable
 */
function findSystemChrome(): string | null {
  if (process.env.RUNNER_CHROME_PATH) {
    if (fs.existsSync(process.env.RUNNER_CHROME_PATH)) {
      return process.env.RUNNER_CHROME_PATH;
    }
  }
  
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(chromePath)) {
    return chromePath;
  }
  
  const canaryPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
  if (fs.existsSync(canaryPath)) {
    return canaryPath;
  }
  
  return null;
}

/**
 * Check if CDP is already running
 */
async function isCDPRunning(): Promise<boolean> {
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Launch Chrome with CDP
 */
async function launchChromeCDP(): Promise<ChildProcess> {
  const chromePath = findSystemChrome();
  
  if (!chromePath) {
    throw new Error('System Chrome not found. Install Google Chrome or set RUNNER_CHROME_PATH');
  }
  
  console.log(`🚀 Launching Chrome with CDP...`);
  console.log(`   Chrome path: ${chromePath}`);
  console.log(`   CDP port: ${CDP_PORT}`);
  console.log(`   Profile dir: ${CDP_PROFILE_DIR}`);
  
  // Ensure profile dir exists
  if (!fs.existsSync(CDP_PROFILE_DIR)) {
    fs.mkdirSync(CDP_PROFILE_DIR, { recursive: true });
  }
  
  // Check if already running
  if (await isCDPRunning()) {
    console.log(`✅ Chrome CDP already running on port ${CDP_PORT}`);
    return null as any; // Signal that Chrome is already running
  }
  
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${CDP_PROFILE_DIR}`,
    '--profile-directory=Default',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    'https://x.com/i/flow/login',
  ];
  
  const chromeProcess = spawn(chromePath, args, {
    detached: true, // Detach so it keeps running
    stdio: 'ignore',
  });
  
  chromeProcess.unref(); // Allow Node to exit while Chrome keeps running
  
  // Wait for Chrome to start and CDP to become accessible
  let attempts = 0;
  while (attempts < 10) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (await isCDPRunning()) {
      console.log(`✅ Chrome launched with CDP on port ${CDP_PORT}`);
      return chromeProcess;
    }
    attempts++;
  }
  
  throw new Error('Chrome launched but CDP not accessible after 10 seconds');
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🌐 CHROME CDP LAUNCHER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  let chromeProcess: ChildProcess | null = null;
  
  try {
    chromeProcess = await launchChromeCDP();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('           ⏸️  CHROME RUNNING');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Chrome is running with CDP enabled.');
    console.log('Complete login/challenge in the Chrome window.');
    console.log('Press Enter to close Chrome and exit.\n');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    await new Promise<void>((resolve) => {
      rl.question('Press Enter to close Chrome... ', () => {
        rl.close();
        resolve();
      });
    });
    
  } catch (error: any) {
    console.error(`❌ Failed to launch Chrome CDP: ${error.message}`);
    process.exit(1);
  } finally {
    if (chromeProcess) {
      console.log('\n🛑 Closing Chrome...');
      chromeProcess.kill();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

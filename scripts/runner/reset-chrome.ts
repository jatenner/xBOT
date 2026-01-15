#!/usr/bin/env tsx
/**
 * 🔄 RESET CHROME CDP
 * 
 * Kills any existing Chrome CDP instance and starts a fresh one
 * 
 * Usage:
 *   RUNNER_MODE=true RUNNER_PROFILE_DIR=./.runner-profile tsx scripts/runner/reset-chrome.ts
 */

import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const RUNNER_PROFILE_DIR = process.env.RUNNER_PROFILE_DIR || path.join(process.cwd(), '.runner-profile');
const CDP_PORT = parseInt(process.env.CDP_PORT || '9222', 10);
const CDP_PROFILE_DIR = path.join(RUNNER_PROFILE_DIR, 'chrome-cdp-profile');

/**
 * Find system Chrome executable
 */
function findSystemChrome(): string {
  if (process.env.RUNNER_CHROME_PATH && fs.existsSync(process.env.RUNNER_CHROME_PATH)) {
    return process.env.RUNNER_CHROME_PATH;
  }
  
  const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(chromePath)) {
    return chromePath;
  }
  
  const canaryPath = '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary';
  if (fs.existsSync(canaryPath)) {
    return canaryPath;
  }
  
  throw new Error('System Chrome not found. Install Google Chrome or set RUNNER_CHROME_PATH');
}

/**
 * Kill Chrome processes using CDP port
 */
function killChromeCDP(): void {
  console.log('🛑 Killing existing Chrome CDP instances...');
  
  try {
    // Find processes using port 9222
    const result = execSync(`lsof -ti:${CDP_PORT}`, { encoding: 'utf-8' }).trim();
    if (result) {
      const pids = result.split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`   ✅ Killed process ${pid}`);
        } catch {}
      }
    }
  } catch {
    // No processes found on port - that's fine
  }
  
  // Also kill Chrome processes with our profile dir
  try {
    const chromeProcs = execSync(`ps aux | grep "[G]oogle Chrome.*chrome-cdp-profile" | awk '{print $2}'`, { encoding: 'utf-8' }).trim();
    if (chromeProcs) {
      const pids = chromeProcs.split('\n').filter(Boolean);
      for (const pid of pids) {
        try {
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
          console.log(`   ✅ Killed Chrome process ${pid}`);
        } catch {}
      }
    }
  } catch {}
  
  // Wait a moment for processes to die
  execSync('sleep 2', { stdio: 'ignore' });
}

/**
 * Launch Chrome with CDP
 */
function launchChromeCDP(): void {
  const chromePath = findSystemChrome();
  
  console.log(`🚀 Launching Chrome with CDP...`);
  console.log(`   Chrome path: ${chromePath}`);
  console.log(`   CDP port: ${CDP_PORT}`);
  console.log(`   Profile: ${CDP_PROFILE_DIR}`);
  
  // Ensure profile dir exists
  if (!fs.existsSync(CDP_PROFILE_DIR)) {
    fs.mkdirSync(CDP_PROFILE_DIR, { recursive: true });
  }
  
  // Minimal, stable args - NO automation flags that cause Chrome banners
  // Removed: --disable-blink-features=AutomationControlled (causes banner)
  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${CDP_PROFILE_DIR}`,
    '--profile-directory=Default',
    '--no-first-run',
    '--no-default-browser-check',
    'https://x.com/home',
  ];
  
  const chromeProcess = spawn(chromePath, args, {
    detached: true,
    stdio: 'ignore',
  });
  
  chromeProcess.unref();
  
  console.log(`✅ Chrome launched (PID: ${chromeProcess.pid})`);
  console.log(`   Chrome will open to https://x.com/home`);
  console.log(`   CDP available at http://127.0.0.1:${CDP_PORT}`);
}

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔄 RESET CHROME CDP');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  killChromeCDP();
  launchChromeCDP();
  
  // Wait a moment and verify CDP is accessible
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
    if (response.ok) {
      console.log('\n✅ Chrome CDP is ready and accessible');
    } else {
      console.log('\n⚠️  Chrome launched but CDP not yet accessible (may need a few more seconds)');
    }
  } catch {
    console.log('\n⚠️  Chrome launched but CDP not yet accessible (may need a few more seconds)');
  }
  
  console.log('');
}

main().catch((error) => {
  console.error('❌ Reset Chrome failed:', error);
  process.exit(1);
});

/**
 * Continuous monitor for ghost posts
 * Runs verifier every N minutes and logs results
 */

import 'dotenv/config';
import { execSync } from 'child_process';
import { appendFileSync } from 'fs';

const INTERVAL_MINUTES = parseInt(process.env.MONITOR_INTERVAL_MINUTES || '5', 10);
const LOG_FILE = './ops/ghost-investigation-log.md';

function logEntry(message: string) {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const entry = `\n## ${timestamp} ET\n\n${message}\n\n---\n`;
  appendFileSync(LOG_FILE, entry);
  console.log(`[${timestamp}] ${message}`);
}

async function runVerifier() {
  try {
    const output = execSync('pnpm exec tsx scripts/verify-not-in-db.ts --since-hours=0.25', {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    
    const hasIssues = output.includes('ISSUES FOUND');
    const isClean = output.includes('CLEAN: All tweets have valid build_sha');
    
    logEntry(`**Verifier Run**\n\`\`\`\n${output}\n\`\`\`\n\n**Result:** ${hasIssues ? '❌ ISSUES FOUND' : isClean ? '✅ CLEAN' : '⚠️ UNKNOWN'}`);
    
    return !hasIssues;
  } catch (error: any) {
    const errorMsg = error.stdout || error.message || String(error);
    logEntry(`**Verifier Error**\n\`\`\`\n${errorMsg}\n\`\`\``);
    return false;
  }
}

async function main() {
  console.log(`🔍 Starting ghost post monitor (every ${INTERVAL_MINUTES} minutes)`);
  console.log(`📝 Logging to: ${LOG_FILE}`);
  
  logEntry(`**Monitor Started**\nInterval: ${INTERVAL_MINUTES} minutes\nGoal: 15 minutes of clean runs`);
  
  let cleanRuns = 0;
  let totalRuns = 0;
  const startTime = Date.now();
  const TARGET_DURATION_MS = 15 * 60 * 1000; // 15 minutes
  
  while (true) {
    totalRuns++;
    const isClean = await runVerifier();
    
    if (isClean) {
      cleanRuns++;
    } else {
      cleanRuns = 0; // Reset on any issue
    }
    
    const elapsed = Date.now() - startTime;
    const elapsedMinutes = Math.floor(elapsed / 60000);
    
    logEntry(`**Status Update**\nClean runs: ${cleanRuns}/${totalRuns}\nElapsed: ${elapsedMinutes} minutes\nTarget: 15 minutes`);
    
    if (cleanRuns >= 3 && elapsed >= TARGET_DURATION_MS) {
      logEntry(`**✅ GOAL ACHIEVED**\n15 minutes of clean runs completed!\nReady for controlled test.`);
      console.log('\n✅ GOAL ACHIEVED: 15 minutes of clean runs!');
      process.exit(0);
    }
    
    // Wait for next interval
    await new Promise(resolve => setTimeout(resolve, INTERVAL_MINUTES * 60 * 1000));
  }
}

main().catch(error => {
  logEntry(`**FATAL ERROR**\n\`\`\`\n${error.message}\n${error.stack}\n\`\`\``);
  console.error('Fatal error:', error);
  process.exit(1);
});


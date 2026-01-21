#!/usr/bin/env tsx
/**
 * OPS LOGS
 * 
 * View recent logs from various sources
 */

import * as fs from 'fs';
import * as path from 'path';

const RUNNER_PROFILE = path.join(process.cwd(), '.runner-profile');
const DAEMON_LOG = path.join(RUNNER_PROFILE, 'daemon.log');
const GO_LIVE_LOG = path.join(RUNNER_PROFILE, 'go-live-monitor.log');
const COOLDOWN_LOG = path.join(RUNNER_PROFILE, 'cooldown-monitor.log');

function tailFile(filePath: string, lines: number = 50) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`\n❌ Log file not found: ${filePath}\n`);
      return;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const allLines = content.split('\n').filter(l => l.trim());
    const recentLines = allLines.slice(-lines);
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   ${path.basename(filePath)} (last ${recentLines.length} lines)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    recentLines.forEach(line => console.log(line));
  } catch (err: any) {
    console.log(`\n❌ Error reading ${filePath}: ${err.message}\n`);
  }
}

async function main() {
  const source = process.argv[2] || 'all';

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📋 OPS LOGS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (source === 'all' || source === 'daemon') {
    tailFile(DAEMON_LOG);
  }

  if (source === 'all' || source === 'go-live') {
    tailFile(GO_LIVE_LOG);
  }

  if (source === 'all' || source === 'cooldown') {
    tailFile(COOLDOWN_LOG);
  }

  if (source === 'all') {
    console.log('\n💡 Tip: Use "pnpm run ops:logs <source>" to view specific logs:');
    console.log('   - daemon: Runner daemon logs');
    console.log('   - go-live: Go-live monitor logs');
    console.log('   - cooldown: Cooldown monitor logs');
    console.log('\n💡 For Railway logs: pnpm run logs:railway\n');
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * RAILWAY LOGS VIEWER
 * Safe log viewer with various options
 */

const { spawn } = require('child_process');

const args = process.argv.slice(2);

console.log('📋 RAILWAY LOGS VIEWER');
console.log('======================');
console.log('Press Ctrl+C to stop streaming logs\n');

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage:');
  console.log('  node railway-logs.js          - Stream live logs');
  console.log('  node railway-logs.js --recent - Show recent logs only');
  console.log('  node railway-logs.js --errors - Filter for errors only');
  console.log('  node railway-logs.js --search <term> - Search logs');
  process.exit(0);
}

let railwayCmd = ['logs'];
let filterCmd = null;

if (args.includes('--errors')) {
  filterCmd = ['grep', '-i', '-E', 'error|fail|exception'];
} else if (args.includes('--search')) {
  const searchTerm = args[args.indexOf('--search') + 1];
  if (searchTerm) {
    filterCmd = ['grep', '-i', searchTerm];
  }
}

// Spawn railway logs
const railway = spawn('railway', railwayCmd, {
  cwd: '/Users/jonahtenner/Desktop/xBOT',
  stdio: filterCmd ? 'pipe' : 'inherit'
});

if (filterCmd) {
  const filter = spawn(filterCmd[0], filterCmd.slice(1), {
    stdio: ['pipe', 'inherit', 'inherit']
  });
  
  railway.stdout.pipe(filter.stdin);
  
  filter.on('close', (code) => {
    railway.kill();
  });
}

railway.on('error', (error) => {
  console.error('❌ Failed to start Railway logs:', error.message);
  console.log('💡 Make sure Railway CLI is installed and project is linked');
  process.exit(1);
});

railway.on('close', (code) => {
  if (code !== 0 && code !== null) {
    console.log(`\n⚠️  Railway logs exited with code ${code}`);
  }
});

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Stopped log streaming');
  railway.kill();
  process.exit(0);
});


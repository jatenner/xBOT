/**
 * Startup acceptance smoke tests
 * Non-blocking validation that systems are working
 */

import { spawn } from 'child_process';

function runScript(command: string, args: string[] = []): Promise<void> {
  return new Promise((resolve) => {
    console.log(`→ Running: ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, { stdio: 'inherit' });
    proc.on('close', (code) => {
      if (code !== 0) {
        console.log(`⚠️ ${command} failed with code ${code} (non-blocking)`);
      }
      resolve();
    });
    proc.on('error', (err) => {
      console.log(`⚠️ ${command} error: ${err.message} (non-blocking)`);
      resolve();
    });
  });
}

async function runAcceptanceTests() {
  if (process.env.STARTUP_ACCEPTANCE_ENABLED !== 'true') {
    console.log('🧪 Acceptance smoke: skipped (STARTUP_ACCEPTANCE_ENABLED=false)');
    return;
  }

  console.log('🧪 Running acceptance smoke (posting OFF)...');
  
  // Test learning job
  console.log('→ Testing learning job...');
  await runScript('npm', ['run', 'jobs:learn:js']);
  
  // Test plan dryrun
  console.log('→ Testing plan dryrun...');
  await runScript('npm', ['run', 'dryrun:plan:js']);
  
  // Test reply dryrun
  console.log('→ Testing reply dryrun...');
  await runScript('npm', ['run', 'dryrun:reply:js']);
  
  console.log('✅ Acceptance smoke completed (failures are non-blocking)');
}

// Only run if called directly
if (require.main === module) {
  runAcceptanceTests().catch((e) => {
    console.error('Acceptance tests error:', e);
    // Don't exit(1) - this should never crash boot
  });
}

export { runAcceptanceTests };

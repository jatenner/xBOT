/**
 * Run ghost reconciliation locally
 * Usage: pnpm exec tsx scripts/run-ghost-reconciliation.ts
 */

import 'dotenv/config';
import { runGhostReconciliation } from '../src/jobs/ghostReconciliationJob';

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('👻 GHOST RECONCILIATION');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const result = await runGhostReconciliation();
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('RESULTS:');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Tweets checked: ${result.checked}`);
  console.log(`Ghosts found: ${result.ghosts_found}`);
  console.log(`Ghosts inserted: ${result.ghosts_inserted}`);
  
  if (result.errors.length > 0) {
    console.log(`Errors: ${result.errors.length}`);
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  if (result.ghosts_found > 0) {
    console.log('\n🚨 GHOST TWEETS DETECTED!');
    console.log('   Check ghost_tweets table and system_events for details.');
  } else {
    console.log('\n✅ No ghosts detected - all tweets accounted for.');
  }
  
  console.log('\n');
  
  process.exit(0);
}

main().catch(console.error);


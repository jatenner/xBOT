#!/usr/bin/env tsx
/**
 * 📊 PERFORMANCE SNAPSHOT - ONE TIME RUN
 * 
 * Processes scheduled snapshots (for testing)
 */

import 'dotenv/config';

// Set runner mode
process.env.RUNNER_MODE = 'true';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 PERFORMANCE SNAPSHOT (ONE TIME)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const { processScheduledSnapshots } = await import('../../src/jobs/performanceSnapshotJob');
    const processed = await processScheduledSnapshots();
    
    console.log(`\n✅ Processed ${processed} snapshots`);
    
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

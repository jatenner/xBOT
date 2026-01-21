#!/usr/bin/env tsx
/**
 * 📊 ACCOUNT SNAPSHOT - ONE TIME RUN
 * 
 * Captures a single account snapshot (for testing)
 */

import 'dotenv/config';

// Set runner mode
process.env.RUNNER_MODE = 'true';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 ACCOUNT SNAPSHOT (ONE TIME)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  try {
    const { captureAccountSnapshot } = await import('../../src/jobs/accountSnapshotJob');
    const snapshot = await captureAccountSnapshot();
    
    if (snapshot) {
      console.log('\n✅ Snapshot captured successfully!');
      console.log(`   Followers: ${snapshot.followers_count}`);
      console.log(`   Following: ${snapshot.following_count}`);
      console.log(`   Total Posts: ${snapshot.total_posts}`);
      console.log(`   Source: ${snapshot.source}`);
    } else {
      console.log('\n⏭️ Snapshot already exists for this hour (idempotent)');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

main();

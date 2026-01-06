/**
 * One-shot postingQueue runner for debugging
 * Runs exactly one cycle and logs all gate checks
 */

import 'dotenv/config';
import { processPostingQueue } from '../src/jobs/postingQueue';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('🔍 ONE-SHOT POSTING QUEUE RUNNER');
  console.log('═══════════════════════════════════════════════════════════════════════\n');
  
  // Log environment gate values
  console.log('📋 Environment Gate Values:');
  console.log(`   POSTING_ENABLED: ${process.env.POSTING_ENABLED || 'NOT SET'}`);
  console.log(`   REPLIES_ENABLED: ${process.env.REPLIES_ENABLED || 'NOT SET'}`);
  console.log(`   DRAIN_QUEUE: ${process.env.DRAIN_QUEUE || 'NOT SET'}`);
  console.log(`   CONTROLLED_DECISION_ID: ${process.env.CONTROLLED_DECISION_ID || 'NOT SET'}`);
  console.log(`   CONTROLLED_POST_TOKEN: ${process.env.CONTROLLED_POST_TOKEN ? process.env.CONTROLLED_POST_TOKEN.substring(0, 16) + '...' : 'NOT SET'}`);
  console.log(`   RAILWAY_GIT_COMMIT_SHA: ${process.env.RAILWAY_GIT_COMMIT_SHA || 'NOT SET'}`);
  console.log('');
  
  console.log('🚀 Entering postingQueue...\n');
  
  try {
    await processPostingQueue();
    console.log('\n✅ postingQueue completed successfully');
  } catch (error: any) {
    console.error('\n❌ postingQueue failed with error:');
    console.error(`   ${error.message}`);
    console.error(`   ${error.stack}`);
    process.exit(1);
  }
  
  console.log('\n═══════════════════════════════════════════════════════════════════════');
  console.log('✅ ONE-SHOT RUN COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════════════');
  
  process.exit(0);
}

main().catch(console.error);


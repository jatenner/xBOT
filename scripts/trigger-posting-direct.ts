/**
 * Trigger posting queue directly (for controlled test)
 */

import 'dotenv/config';
import { processPostingQueue } from '../src/jobs/postingQueue';

async function main() {
  console.log('🚀 Triggering posting queue directly...');
  console.log(`POSTING_QUEUE_MAX=${process.env.POSTING_QUEUE_MAX || 'unset'}`);
  console.log(`POSTING_ENABLED=${process.env.POSTING_ENABLED || 'unset'}`);
  console.log(`DRAIN_QUEUE=${process.env.DRAIN_QUEUE || 'unset'}\n`);
  
  try {
    await processPostingQueue();
    console.log('\n✅ Posting queue completed');
  } catch (error: any) {
    console.error('\n❌ Posting queue failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch(console.error);


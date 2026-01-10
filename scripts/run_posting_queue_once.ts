/**
 * 🔒 ONE-SHOT POSTING QUEUE RUNNER
 * 
 * Runs postingQueue exactly once in CERT MODE:
 * - Only processes reply decisions with reply_v2_scheduler pipeline_source
 * - Processes up to 1 item
 * - Logs all instrumentation events
 */

import 'dotenv/config';
import { processPostingQueue } from '../src/jobs/postingQueue';

async function runPostingQueueOnce(): Promise<void> {
  console.log('========================================');
  console.log('ONE-SHOT POSTING QUEUE (CERT MODE)');
  console.log('========================================');
  
  // Set CERT MODE environment variable
  process.env.POSTING_QUEUE_CERT_MODE = 'true';
  
  try {
    await processPostingQueue({
      certMode: true,
      maxItems: 1,
    });
    
    console.log('========================================');
    console.log('✅ ONE-SHOT POSTING QUEUE COMPLETE');
    console.log('========================================');
  } catch (error: any) {
    console.error('========================================');
    console.error('❌ ONE-SHOT POSTING QUEUE FAILED');
    console.error('========================================');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

runPostingQueueOnce()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


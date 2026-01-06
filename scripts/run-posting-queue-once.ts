/**
 * Run posting queue once (for ramp mode testing)
 */

import 'dotenv/config';
import { processPostingQueue } from '../src/jobs/postingQueue';

async function main() {
  console.log('🚀 Running posting queue once...\n');
  
  try {
    await processPostingQueue();
    console.log('\n✅ Posting queue cycle complete');
  } catch (error: any) {
    console.error(`\n❌ Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
  
  process.exit(0);
}

main().catch(console.error);

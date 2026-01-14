#!/usr/bin/env tsx
/**
 * Run allow resumer once (for manual testing/debugging)
 */

import 'dotenv/config';
import { runAllowResumer } from '../src/jobs/replySystemV2/allowResumer';

async function main() {
  console.log('🔄 Running allow resumer...\n');
  
  try {
    await runAllowResumer();
    console.log('\n✅ Allow resumer complete');
  } catch (error: any) {
    console.error('❌ Allow resumer failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

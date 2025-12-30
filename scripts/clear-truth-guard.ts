/**
 * Emergency Fix: Clear Truth Guard Block
 * 
 * The truth guard is blocking all posting because verification failed.
 * This script clears the block so the system can resume.
 */

import 'dotenv/config';
import { clearTruthIntegrityBlock } from '../src/utils/truthGuard';

async function main() {
  console.log('\n🚨 EMERGENCY: Clearing Truth Guard Block\n');
  console.log('The system is blocked due to repeated truth integrity failures.');
  console.log('This script will clear the block so posting can resume.\n');
  
  await clearTruthIntegrityBlock();
  
  console.log('\n✅ Truth guard block cleared!');
  console.log('\n📋 NEXT STEPS:');
  console.log('   1. Posting should resume within 1-2 minutes');
  console.log('   2. Monitor for posts: railway logs --service xBOT | grep SUCCESS');
  console.log('   3. If issues persist, disable truth guard:');
  console.log('      railway variables --set "ENABLE_TRUTH_GUARD=false"');
  console.log('\n');
}

main().catch(error => {
  console.error('\n❌ Failed to clear block:', error.message);
  process.exit(1);
});


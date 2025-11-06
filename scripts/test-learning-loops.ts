/**
 * 🧪 TEST LEARNING LOOPS ACTIVATION
 * 
 * Quick test to verify learning loops are working
 */

import { planContent } from '../src/jobs/planJob';

async function testLearningLoops() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 TESTING LEARNING LOOPS ACTIVATION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('⏳ Generating 2 posts with learning loops enabled...\n');
  
  try {
    await planContent();
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ TEST COMPLETE - Check logs above for:');
    console.log('   1. [GROWTH_INTEL] 🚀 Activating learning loops...');
    console.log('   2. [GROWTH_INTEL] 📚 Loaded X recent posts from [generator]');
    console.log('   3. [SUBSTANCE] ✅ Post passed substance check');
    console.log('   4. No buzzwords in generated content');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
  } catch (error: any) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('Stack:', error.stack);
  }
}

testLearningLoops();


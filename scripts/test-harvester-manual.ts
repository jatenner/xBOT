/**
 * 🌾 Manual Harvester Test
 * 
 * Tests the reply opportunity harvester with detailed logging
 * to identify exactly where it's failing
 */

import { replyOpportunityHarvester } from '../src/jobs/replyOpportunityHarvester';

async function testHarvester() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║     🌾 Manual Harvester Test (Debug Mode)   ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  
  console.log('⏱️  Starting harvester...');
  console.log('');
  
  try {
    // Set debug environment variable
    process.env.HARVESTER_DEBUG = 'true';
    process.env.HARVESTER_TEST_LIMIT = '2'; // Only test first 2 tiers for speed
    
    const startTime = Date.now();
    
    await replyOpportunityHarvester();
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('');
    console.log(`✅ Harvester completed in ${elapsed}s`);
    console.log('');
    console.log('Now check the logs above to see:');
    console.log('  1. Did authentication succeed?');
    console.log('  2. Did searches return any tweets?');
    console.log('  3. Did AI filtering work?');
    console.log('  4. Were opportunities stored in database?');
    
  } catch (error: any) {
    console.error('');
    console.error('❌ Harvester test failed:');
    console.error(`   Error: ${error.message}`);
    console.error('');
    console.error('   Stack trace:');
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

testHarvester().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


/**
 * 🧪 TEST LIGHTWEIGHT POSTING SYSTEM
 * Quick test to verify Railway-optimized system works
 */

async function testLightweightSystem() {
  console.log('🧪 TESTING: Lightweight posting system...');
  
  try {
    // Test the new lightweight endpoint
    const response = await fetch('https://xbot-production-844b.up.railway.app/api/post-lightweight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: `🧪 Testing lightweight system - ${new Date().toLocaleTimeString()}`
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ LIGHTWEIGHT_TEST: SUCCESS!');
      console.log(`📊 Performance: ${result.performance.totalTimeMs}ms, ${result.performance.memoryUsedMB}MB`);
      console.log(`🎯 Tweet ID: ${result.tweetId || 'N/A'}`);
    } else {
      console.log('❌ LIGHTWEIGHT_TEST: FAILED');
      console.log(`Error: ${result.error}`);
    }

    // Test system stats endpoint
    const statsResponse = await fetch('https://xbot-production-844b.up.railway.app/api/system-stats');
    const stats = await statsResponse.json();
    
    console.log('\n📊 SYSTEM_STATS:');
    console.log(`Memory: ${stats.system.memoryMB.heap}MB heap, ${stats.system.memoryMB.total}MB total`);
    console.log(`Queue: ${stats.posting.queueLength} posts waiting`);
    console.log(`Estimated Railway cost: ${stats.railway.estimatedCost}`);
    
  } catch (error) {
    console.error('❌ TEST_ERROR:', error.message);
  }
}

// Run test
testLightweightSystem();

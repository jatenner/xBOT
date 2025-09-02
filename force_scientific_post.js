/**
 * FORCE SCIENTIFIC POST - Test immediate retry system
 */

require('dotenv').config();

async function forceScientificPost() {
  console.log('🧬 FORCING SCIENTIFIC POST TEST...');
  console.log('=======================================');
  
  try {
    // Import the posting engine
    const { SimplifiedPostingEngine } = await import('./dist/core/simplifiedPostingEngine.js');
    
    console.log('✅ SimplifiedPostingEngine imported');
    
    const engine = SimplifiedPostingEngine.getInstance();
    console.log('✅ Engine instance created');
    
    // Force post with scientific topic
    console.log('\n🚀 FORCING SCIENTIFIC POST: "hydration optimization protocol"...');
    
    const result = await engine.createEngagingPost('hydration optimization protocol');
    
    console.log('\n📊 SCIENTIFIC POST RESULTS:');
    console.log('============================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`🆔 Tweet ID: ${result.tweetId || 'None'}`);
    console.log(`📝 Content Preview: ${result.content ? result.content.substring(0, 200) + '...' : 'None'}`);
    console.log(`❌ Error: ${result.error || 'None'}`);
    
    if (result.success && result.tweetId) {
      console.log('\n🎉 SCIENTIFIC POST SUCCESS!');
      console.log('🔬 This should be complex scientific content with:');
      console.log('   - Specific numbers with units (mg, °F, %, hours)');
      console.log('   - Causal mechanisms (due to, because, activates)');
      console.log('   - Scientific terms (REM, GABA, melatonin, etc.)');
      console.log('   - Structured format (X ways to optimize Y)');
      console.log('   - Physiological connections');
      console.log(`🌐 Check: https://x.com/Signal_Synapse/status/${result.tweetId}`);
    } else {
      console.log('\n❌ SCIENTIFIC POST FAILED');
      console.log('🔧 Check the error above or wait for retry');
    }
    
  } catch (error) {
    console.error('\n💥 SCIENTIFIC POST CRASHED:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 3).join('\n'));
  }
}

// Run with timeout
const timeout = setTimeout(() => {
  console.log('\n⏰ Test timed out after 3 minutes');
  process.exit(1);
}, 180000);

forceScientificPost()
  .then(() => {
    clearTimeout(timeout);
    console.log('\n✅ Scientific post test completed');
  })
  .catch((error) => {
    clearTimeout(timeout);
    console.error('\n💥 Final error:', error.message);
  });

/**
 * MINIMAL POSTING SYSTEM - No bloat, just posting
 * Bypasses all complex systems and focuses on core functionality
 */

require('dotenv').config();

async function createMinimalPost() {
  console.log('🚀 MINIMAL POSTING SYSTEM - DIRECT APPROACH');
  console.log('===========================================');
  
  try {
    // STEP 1: Generate scientific thread content
    console.log('🧵 STEP 1: Generating scientific thread...');
    
    const { generateThread } = await import('./dist/ai/threadGenerator.js');
    const OpenAI = (await import('openai')).default;
    
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const threadResult = await generateThread({
      topic: 'hydration optimization for cognitive performance',
      pillar: 'biohacking',
      angle: 'contrarian',
      spice_level: 8,
      evidence_mode: 'mechanism'
    }, openai);
    
    console.log(`✅ Generated ${threadResult.tweets.length} scientific tweets`);
    console.log(`📝 Preview: "${threadResult.tweets[0].text.substring(0, 100)}..."`);
    
    // STEP 2: Post the thread using simple poster
    console.log('\n🚀 STEP 2: Posting thread directly...');
    
    const { SimpleThreadPoster } = await import('./dist/posting/simpleThreadPoster.js');
    const poster = SimpleThreadPoster.getInstance();
    
    const tweetTexts = threadResult.tweets.map(t => t.text);
    
    console.log('📋 Thread tweets to post:');
    tweetTexts.forEach((tweet, i) => {
      console.log(`${i + 1}. "${tweet.substring(0, 80)}..." (${tweet.length} chars)`);
    });
    
    const result = await poster.postRealThread(tweetTexts);
    
    console.log('\n📊 POSTING RESULTS:');
    console.log('===================');
    console.log(`✅ Success: ${result.success}`);
    console.log(`🔗 Root Tweet ID: ${result.rootTweetId || 'None'}`);
    console.log(`📝 Reply IDs: ${result.replyIds ? result.replyIds.join(', ') : 'None'}`);
    console.log(`📊 Total Tweets: ${result.totalTweets || 0}`);
    console.log(`❌ Error: ${result.error || 'None'}`);
    
    if (result.success && result.rootTweetId) {
      console.log('\n🎉 MINIMAL SYSTEM SUCCESS!');
      console.log(`🌐 Check thread: https://x.com/Signal_Synapse/status/${result.rootTweetId}`);
      console.log('🧵 This should be a real Twitter thread with scientific content');
    } else {
      console.log('\n❌ POSTING FAILED');
      console.log('🔧 Check browser automation or Twitter session');
    }
    
  } catch (error) {
    console.error('\n💥 MINIMAL SYSTEM ERROR:', error.message);
    console.error('Stack:', error.stack?.split('\n').slice(0, 5).join('\n'));
  }
}

// Run with timeout
const timeout = setTimeout(() => {
  console.log('\n⏰ Minimal test timed out');
  process.exit(1);
}, 120000); // 2 minutes

createMinimalPost()
  .then(() => {
    clearTimeout(timeout);
    console.log('\n✅ Minimal posting system test completed');
  })
  .catch((error) => {
    clearTimeout(timeout);
    console.error('\n💥 Final error:', error.message);
  });

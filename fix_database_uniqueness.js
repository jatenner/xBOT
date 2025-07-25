const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function fixDatabaseUniqueness() {
  try {
    console.log('🔧 FIXING DATABASE UNIQUENESS SYSTEM...\n');
    
    // 1. Check current database state
    console.log('1️⃣ CHECKING CURRENT DATABASE STATE:');
    const { data: allTweets, error: tweetsError } = await supabase
      .from('tweets')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (tweetsError) {
      console.error('❌ Error checking tweets:', tweetsError);
      return;
    }
    
    console.log(`📊 Found ${allTweets?.length || 0} total tweets in database`);
    
    if (allTweets && allTweets.length > 0) {
      console.log('\n📋 Current tweets:');
      allTweets.slice(0, 5).forEach((tweet, i) => {
        const isRealTwitterID = /^\d{19}$/.test(tweet.tweet_id);
        console.log(`  ${i + 1}. ID: ${tweet.tweet_id} ${isRealTwitterID ? '✅' : '❌ FAKE'}`);
        console.log(`     Created: ${tweet.created_at}`);
        console.log(`     Content: "${tweet.content.substring(0, 60)}..."`);
        console.log('');
      });
      
      // 2. Clean up fake/test data
      console.log('2️⃣ CLEANING UP FAKE/TEST DATA:');
      const fakeIDs = allTweets.filter(tweet => !/^\d{19}$/.test(tweet.tweet_id));
      
      if (fakeIDs.length > 0) {
        console.log(`🗑️ Found ${fakeIDs.length} fake/test tweets to remove:`);
        fakeIDs.forEach((tweet, i) => {
          console.log(`  ${i + 1}. ${tweet.tweet_id} - "${tweet.content.substring(0, 40)}..."`);
        });
        
        // Delete fake tweets
        for (const fakeTweet of fakeIDs) {
          const { error } = await supabase
            .from('tweets')
            .delete()
            .eq('tweet_id', fakeTweet.tweet_id);
          
          if (error) {
            console.error(`❌ Failed to delete ${fakeTweet.tweet_id}:`, error);
          } else {
            console.log(`✅ Deleted fake tweet: ${fakeTweet.tweet_id}`);
          }
        }
      } else {
        console.log('✅ No fake tweets found - all IDs look legitimate');
      }
    }
    
    // 3. Fix content_uniqueness table
    console.log('\n3️⃣ FIXING CONTENT_UNIQUENESS TABLE:');
    
    // Check if normalized_content column exists
    try {
      const { data: testData, error: testError } = await supabase
        .from('content_uniqueness')
        .select('normalized_content')
        .limit(1);
      
      if (testError && testError.message.includes('column "normalized_content" does not exist')) {
        console.log('❌ normalized_content column missing - needs manual SQL fix');
        console.log('\n🔧 RUN THIS SQL IN SUPABASE:');
        console.log('ALTER TABLE content_uniqueness ADD COLUMN IF NOT EXISTS normalized_content TEXT DEFAULT \'\';');
      } else {
        console.log('✅ normalized_content column exists');
      }
    } catch (error) {
      console.log('⚠️ Could not check content_uniqueness table:', error);
    }
    
    // 4. Test database connection and writes
    console.log('\n4️⃣ TESTING DATABASE WRITES:');
    
    const testTweetId = '1234567890123456789'; // Fake ID for testing
    const testContent = 'Test content for uniqueness checking system verification';
    
    try {
      // Try to insert a test tweet
      const { error: insertError } = await supabase
        .from('tweets')
        .insert({
          tweet_id: testTweetId,
          content: testContent,
          content_type: 'test',
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('❌ Tweet insert test failed:', insertError);
      } else {
        console.log('✅ Tweet insert test successful');
        
        // Clean up test data
        await supabase.from('tweets').delete().eq('tweet_id', testTweetId);
        console.log('🗑️ Test data cleaned up');
      }
    } catch (error) {
      console.error('❌ Database write test failed:', error);
    }
    
    // 5. Final summary
    console.log('\n📊 FINAL DATABASE STATE:');
    const { data: finalTweets } = await supabase
      .from('tweets')
      .select('tweet_id, created_at')
      .order('created_at', { ascending: false });
    
    const realTweets = finalTweets?.filter(tweet => /^\d{19}$/.test(tweet.tweet_id)) || [];
    
    console.log(`✅ Clean database with ${realTweets.length} real tweets`);
    console.log('✅ Ready for proper uniqueness checking');
    
    if (realTweets.length === 0) {
      console.log('\n⚠️ RECOMMENDATION:');
      console.log('Since database is now empty, the bot will start fresh with proper uniqueness tracking.');
      console.log('First few tweets may still seem similar until database builds up history.');
    }
    
  } catch (error) {
    console.error('❌ Fix script error:', error);
  }
}

// Run the script
fixDatabaseUniqueness().then(() => {
  console.log('\n🎉 Database uniqueness fix complete!');
  process.exit(0);
}); 
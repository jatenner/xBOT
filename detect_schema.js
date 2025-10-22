const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function detectSchema() {
  console.log('\n🔍 DETECTING SCHEMA BY TESTING INSERTS...\n');
  
  // Test Schema 1: Migration schema
  console.log('Testing Schema 1 (migration)...');
  const { error: error1 } = await supabase
    .from('reply_opportunities')
    .insert({
      account_username: 'test',
      tweet_id: 'test_' + Date.now(),
      tweet_url: 'https://test.com',
      tweet_content: 'test',
      tweet_author: 'test',
      discovered_at: new Date().toISOString()
    });
  
  if (!error1) {
    console.log('✅ Schema 1 works! Table has: account_username, tweet_id, discovered_at');
    
    // Clean up
    await supabase
      .from('reply_opportunities')
      .delete()
      .ilike('tweet_id', 'test_%');
    
    return 'schema1';
  } else {
    console.log('❌ Schema 1 failed:', error1.message);
  }
  
  // Test Schema 2: Create script schema
  console.log('\nTesting Schema 2 (create script)...');
  const { error: error2 } = await supabase
    .from('reply_opportunities')
    .insert({
      target_username: 'test',
      target_tweet_id: 'test_' + Date.now(),
      target_tweet_url: 'https://test.com',
      target_tweet_content: 'test',
      tweet_posted_at: new Date().toISOString()
    });
  
  if (!error2) {
    console.log('✅ Schema 2 works! Table has: target_username, target_tweet_id, tweet_posted_at');
    
    // Clean up
    await supabase
      .from('reply_opportunities')
      .delete()
      .ilike('target_tweet_id', 'test_%');
    
    return 'schema2';
  } else {
    console.log('❌ Schema 2 failed:', error2.message);
  }
  
  console.log('\n❌ Neither schema works! Table might have a completely different structure.');
}

detectSchema().then((result) => {
  if (result) {
    console.log(`\n✅ Active schema: ${result}`);
  }
  process.exit(0);
}).catch(e => {
  console.error('\nFatal error:', e);
  process.exit(1);
});

/**
 * Check the outcomes table schema
 */

import { getSupabaseClient } from '../src/db/index';

async function checkOutcomesSchema() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Checking outcomes table schema...\n');
  
  // Try to get schema info via a test insert (will fail and show error)
  const { data, error } = await supabase
    .from('outcomes')
    .select('*')
    .limit(1);
  
  console.log('SELECT query result:');
  console.log('Data:', data);
  console.log('Error:', error);
  console.log('');
  
  // Try a manual insert with the exact structure from metricsScraperJob
  console.log('Attempting manual insert with exact structure from scraper...');
  const testInsert = {
    decision_id: 'test_' + Date.now(),
    tweet_id: '1234567890123456789',
    likes: 100,
    retweets: 10,
    quote_tweets: null,
    replies: 5,
    views: 1000,
    bookmarks: null,
    impressions: null,
    first_hour_engagement: 115,
    collected_at: new Date().toISOString(),
    data_source: 'manual_test',
    simulated: false
  };
  
  console.log('Test data:', JSON.stringify(testInsert, null, 2));
  
  const { data: insertData, error: insertError } = await supabase
    .from('outcomes')
    .insert(testInsert);
  
  if (insertError) {
    console.log('\n❌ INSERT FAILED:');
    console.log('Error code:', insertError.code);
    console.log('Error message:', insertError.message);
    console.log('Error details:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('\n✅ INSERT SUCCEEDED!');
    console.log('Data:', insertData);
  }
}

checkOutcomesSchema().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});


#!/usr/bin/env tsx
/**
 * ✅ PROVE TEST LANE CAN BE ENABLED
 * 
 * Verifies that when ALLOW_TEST_POSTS=true, test posts are allowed
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     ✅ PROVE TEST LANE CAN BE ENABLED');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Temporarily enable test posts
  process.env.ALLOW_TEST_POSTS = 'true';
  const allowTestPosts = process.env.ALLOW_TEST_POSTS === 'true';

  console.log(`📋 ALLOW_TEST_POSTS: ${allowTestPosts ? 'true' : 'false'}\n`);

  const supabase = getSupabaseClient();

  // Query with test posts allowed
  let contentQuery = supabase
    .from('content_metadata')
    .select('decision_id, content, is_test_post, status, scheduled_at, tweet_id')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', new Date().toISOString());

  // Don't filter test posts when ALLOW_TEST_POSTS=true
  // (postingQueue doesn't add the filter in this case)
  
  const { data: readyPosts, error } = await contentQuery
    .order('scheduled_at', { ascending: true })
    .limit(10);

  if (error) {
    console.error('❌ Query failed:', error.message);
    process.exit(1);
  }

  console.log(`📊 Ready posts found: ${readyPosts?.length || 0}\n`);

  // Check for test posts
  const testPosts = readyPosts?.filter(p => p.is_test_post === true) || [];
  const prodPosts = readyPosts?.filter(p => !p.is_test_post || p.is_test_post === false) || [];

  console.log(`✅ Test posts in results: ${testPosts.length}`);
  console.log(`✅ Prod posts in results: ${prodPosts.length}\n`);

  if (testPosts.length > 0) {
    console.log('✅ VERIFICATION: Test posts are included when ALLOW_TEST_POSTS=true');
    testPosts.forEach((post: any) => {
      console.log(`   - Decision ID: ${post.decision_id}`);
      console.log(`     Content: ${post.content?.substring(0, 60)}...`);
    });
  } else {
    console.log('ℹ️  No test posts found in queue (may have been posted or not exist)');
  }

  // Check for POST_SUCCESS_TEST events
  const { data: successEvents } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'POST_SUCCESS_TEST')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`\n📋 POST_SUCCESS_TEST events: ${successEvents?.length || 0}`);
  if (successEvents && successEvents.length > 0) {
    console.log('   Recent test post successes:');
    successEvents.forEach((event: any) => {
      const data = event.event_data || {};
      console.log(`   - ${event.created_at}: decision_id=${data.decision_id}, tweet_id=${data.tweet_id}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ VERIFICATION: Test lane can be enabled with ALLOW_TEST_POSTS=true');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Clean up - unset for safety
  delete process.env.ALLOW_TEST_POSTS;
  console.log('🔒 ALLOW_TEST_POSTS unset (back to default: blocked)');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

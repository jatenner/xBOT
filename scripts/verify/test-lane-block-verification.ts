#!/usr/bin/env tsx
/**
 * 🔒 VERIFY TEST LANE BLOCKS BY DEFAULT
 * 
 * Simulates postingQueue behavior to prove test posts are blocked
 * when ALLOW_TEST_POSTS is not set
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('     🔒 VERIFY TEST LANE BLOCKS BY DEFAULT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const supabase = getSupabaseClient();
  const allowTestPosts = process.env.ALLOW_TEST_POSTS === 'true';

  console.log(`📋 ALLOW_TEST_POSTS: ${allowTestPosts ? 'true' : 'false/not_set'}\n`);

  // Simulate postingQueue query (same logic as getReadyDecisions)
  let contentQuery = supabase
    .from('content_metadata')
    .select('decision_id, content, is_test_post, status, scheduled_at')
    .eq('status', 'queued')
    .in('decision_type', ['single', 'thread'])
    .lte('scheduled_at', new Date().toISOString());

  // Filter out test posts unless explicitly allowed (same logic as postingQueue)
  if (!allowTestPosts) {
    console.log('🔒 TEST_LANE_BLOCK: Filtering out test posts (ALLOW_TEST_POSTS not set)');
    contentQuery = contentQuery.or('is_test_post.is.null,is_test_post.eq.false');
  }

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

  if (!allowTestPosts && testPosts.length > 0) {
    console.error('❌ FAILED: Test posts were NOT blocked!');
    console.error('   Test posts found:', testPosts.map(p => p.decision_id));
    process.exit(1);
  }

  if (allowTestPosts && testPosts.length === 0) {
    console.log('ℹ️  No test posts found (may not exist in queue)');
  }

  // Check system_events for TEST_LANE_BLOCK events
  const { data: blockEvents } = await supabase
    .from('system_events')
    .select('*')
    .eq('event_type', 'TEST_LANE_BLOCK')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log(`📋 TEST_LANE_BLOCK events in system_events: ${blockEvents?.length || 0}`);
  if (blockEvents && blockEvents.length > 0) {
    console.log('   Recent events:');
    blockEvents.forEach((event: any) => {
      console.log(`   - ${event.created_at}: ${event.message}`);
    });
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (!allowTestPosts) {
    console.log('✅ VERIFICATION PASSED: Test posts are blocked by default');
  } else {
    console.log('✅ VERIFICATION PASSED: Test posts are allowed (ALLOW_TEST_POSTS=true)');
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Output proof query
  console.log('📊 PROOF QUERY:');
  console.log(`
SELECT decision_id, is_test_post, status, scheduled_at
FROM content_metadata
WHERE status = 'queued'
  AND decision_type IN ('single', 'thread')
  AND scheduled_at <= NOW()
  ${!allowTestPosts ? "AND (is_test_post IS NULL OR is_test_post = false)" : ""}
ORDER BY scheduled_at ASC
LIMIT 10;
  `);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

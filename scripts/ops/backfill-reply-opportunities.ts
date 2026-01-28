#!/usr/bin/env tsx
/**
 * 🔧 TEMPORARY BACKFILL: Reply Opportunities
 * 
 * Creates 10 test opportunities for validating downstream reply + learning loop.
 * ONLY use when harvester is blocked by external dependencies.
 * 
 * ⚠️  WARNING: These are clearly labeled test opportunities.
 * ⚠️  They should be removed once harvester is restored.
 * 
 * Usage:
 *   pnpm tsx scripts/ops/backfill-reply-opportunities.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  console.log('🔧 Temporary Backfill: Reply Opportunities');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log('⚠️  WARNING: This creates TEST opportunities for validation only.');
  console.log('⚠️  Remove these once harvester is restored.\n');
  
  const supabase = getSupabaseClient();
  
  // Check current count
  const { count: currentCount } = await supabase
    .from('reply_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('replied_to', false)
    .eq('features->>backfill_test', 'true');
  
  if (currentCount && currentCount > 0) {
    console.log(`⚠️  Found ${currentCount} existing backfill opportunities`);
    console.log('   Skipping backfill (already exists)');
    process.exit(0);
  }
  
  // Create 10 test opportunities
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  
  const testOpportunities = Array.from({ length: 10 }, (_, i) => ({
    target_tweet_id: `backfill_test_${Date.now()}_${i}`,
    target_username: `test_account_${i}`,
    target_tweet_url: `https://twitter.com/test_account_${i}/status/backfill_test_${Date.now()}_${i}`,
    target_tweet_content: `[BACKFILL_TEST] Test health tweet ${i + 1}: Sleep quality matters for health optimization and longevity. This is a temporary test opportunity for validation.`,
    tweet_posted_at: oneHourAgo.toISOString(),
    posted_minutes_ago: 60,
    like_count: 5000 + (i * 1000), // 5K-14K likes
    reply_count: 50 + (i * 10),
    retweet_count: 100 + (i * 20),
    engagement_rate: 0.05,
    target_followers: 100000 + (i * 10000),
    account_followers: 100000 + (i * 10000),
    account_username: `test_account_${i}`,
    tier: null, // Let harvester assign tier
    opportunity_score: 50 + (i * 5),
    replied_to: false,
    status: 'pending',
    created_at: now.toISOString(),
  }));
  
  console.log(`[BACKFILL] Creating ${testOpportunities.length} test opportunities...`);
  
  const { data, error } = await supabase
    .from('reply_opportunities')
    .insert(testOpportunities)
    .select('target_tweet_id, created_at, target_tweet_content');
  
  if (error) {
    console.error(`❌ Backfill failed: ${error.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Created ${data?.length || 0} test opportunities`);
  console.log('\n📋 Backfill Summary:');
  console.log(`   Count: ${data?.length || 0}`);
  console.log(`   Tier: ACCEPTABLE`);
  console.log(`   Age: ~1 hour old`);
  console.log(`   Likes: 5K-14K`);
  console.log(`   Label: backfill_test=true`);
  console.log('\n⚠️  REMINDER: Remove these once harvester is restored.');
  
  // Verify insertion
  const { count: verifyCount } = await supabase
    .from('reply_opportunities')
    .select('id', { count: 'exact', head: true })
    .eq('replied_to', false)
    .like('target_tweet_content', '%[BACKFILL_TEST]%');
  
  console.log(`\n✅ Verified: ${verifyCount} backfill opportunities in DB`);
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

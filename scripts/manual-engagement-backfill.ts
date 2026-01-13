#!/usr/bin/env tsx
/**
 * Manual engagement backfill for a specific tweet ID
 * Usage: pnpm exec tsx scripts/manual-engagement-backfill.ts <posted_reply_tweet_id>
 */

import 'dotenv/config';
import { updateReplyEngagement } from '../src/jobs/replySystemV2/engagementTracker';
import { getSupabaseClient } from '../src/db';

async function main() {
  const tweetId = process.argv[2];
  
  if (!tweetId) {
    console.error('Usage: pnpm exec tsx scripts/manual-engagement-backfill.ts <posted_reply_tweet_id>');
    process.exit(1);
  }
  
  console.log(`📊 Manual engagement backfill for tweet: ${tweetId}\n`);
  
  const supabase = getSupabaseClient();
  
  // Check if decision exists
  const { data: decision, error } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, posted_reply_tweet_id, decision, created_at, reward_24h, engaged_at')
    .eq('posted_reply_tweet_id', tweetId)
    .maybeSingle();
  
  if (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
  
  if (!decision) {
    console.error(`❌ No reply_decision found for posted_reply_tweet_id=${tweetId}`);
    console.log(`   Creating a test decision row...`);
    
    // Create a test decision row for this tweet
    const { data: newDecision, error: createError } = await supabase
      .from('reply_decisions')
      .insert({
        target_tweet_id: 'test',
        root_tweet_id: 'test',
        ancestry_depth: 0,
        is_root: true,
        decision: 'ALLOW',
        status: 'OK',
        confidence: 'HIGH',
        method: 'manual_backfill',
        posted_reply_tweet_id: tweetId,
      })
      .select()
      .single();
    
    if (createError || !newDecision) {
      console.error(`❌ Failed to create test decision: ${createError?.message}`);
      process.exit(1);
    }
    
    console.log(`✅ Created test decision row: ${newDecision.id}`);
    console.log(`   Now updating engagement...\n`);
  } else {
    console.log(`✅ Found decision: ${decision.id}`);
    console.log(`   Current reward_24h: ${decision.reward_24h || 'NULL'}`);
    console.log(`   Current engaged_at: ${decision.engaged_at || 'NULL'}\n`);
  }
  
  // Update engagement
  console.log(`🔄 Fetching engagement metrics...`);
  try {
    await updateReplyEngagement(tweetId);
    console.log(`✅ Engagement update completed\n`);
    
    // Verify update
    const { data: updated } = await supabase
      .from('reply_decisions')
      .select('reward_24h, engaged_at, engagement_24h_likes, engagement_24h_replies, engagement_24h_retweets, engagement_24h_views')
      .eq('posted_reply_tweet_id', tweetId)
      .single();
    
    if (updated) {
      console.log(`📊 Updated engagement:`);
      console.log(`   likes: ${updated.engagement_24h_likes || 0}`);
      console.log(`   replies: ${updated.engagement_24h_replies || 0}`);
      console.log(`   retweets: ${updated.engagement_24h_retweets || 0}`);
      console.log(`   views: ${updated.engagement_24h_views || 0}`);
      console.log(`   reward_24h: ${updated.reward_24h || 'NULL'}`);
      console.log(`   engaged_at: ${updated.engaged_at || 'NULL'}`);
      
      if (updated.reward_24h !== null && updated.engaged_at !== null) {
        console.log(`\n✅ SUCCESS: reward_24h and engaged_at populated!`);
      } else {
        console.log(`\n⚠️ WARNING: reward_24h or engaged_at still NULL`);
      }
    }
  } catch (error: any) {
    console.error(`❌ Error updating engagement: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

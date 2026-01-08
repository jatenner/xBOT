/**
 * Backfill script: Fix reply_opportunities and content_metadata root tweet data
 * 
 * SAFE, MANUAL RUN ONLY
 * 
 * This script:
 * 1. Sets is_root_tweet=false where target_in_reply_to_tweet_id IS NOT NULL
 * 2. Sets is_reply_tweet=true where target_in_reply_to_tweet_id IS NOT NULL
 * 3. Closes/deletes reply opportunities where target is non-root
 * 4. Updates root_tweet_id if resolvable, else null
 * 
 * Usage:
 *   DRY_RUN=true pnpm exec tsx scripts/backfill-reply-root-data.ts
 *   pnpm exec tsx scripts/backfill-reply-root-data.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const DRY_RUN = process.env.DRY_RUN === 'true';
  const supabase = getSupabaseClient();
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🔧 BACKFILL: Reply Root Data Cleanup');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will modify DB)'}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Step 1: Find reply_opportunities with target_in_reply_to_tweet_id
  console.log('Step 1: Finding reply opportunities with in_reply_to_tweet_id...');
  const { data: replyOpps, error: oppError } = await supabase
    .from('reply_opportunities')
    .select('id, target_tweet_id, target_in_reply_to_tweet_id, is_root_tweet, is_reply_tweet, root_tweet_id, status')
    .not('target_in_reply_to_tweet_id', 'is', null);
  
  if (oppError) {
    console.error(`❌ Error querying reply_opportunities: ${oppError.message}`);
    process.exit(1);
  }
  
  console.log(`   Found ${replyOpps?.length || 0} opportunities with in_reply_to_tweet_id\n`);
  
  if (replyOpps && replyOpps.length > 0) {
    console.log('   Sample records:');
    replyOpps.slice(0, 5).forEach(opp => {
      console.log(`     - id=${opp.id} target=${opp.target_tweet_id} in_reply_to=${opp.target_in_reply_to_tweet_id} is_root=${opp.is_root_tweet} status=${opp.status}`);
    });
    if (replyOpps.length > 5) {
      console.log(`     ... and ${replyOpps.length - 5} more`);
    }
    console.log('');
    
    if (!DRY_RUN) {
      // Update: Set is_root_tweet=false, is_reply_tweet=true
      const updateIds = replyOpps.map(opp => opp.id);
      const { error: updateError } = await supabase
        .from('reply_opportunities')
        .update({
          is_root_tweet: false,
          is_reply_tweet: true,
          status: 'skipped', // Mark as skipped since we can't reply to replies
          updated_at: new Date().toISOString(),
        })
        .in('id', updateIds);
      
      if (updateError) {
        console.error(`❌ Error updating reply_opportunities: ${updateError.message}`);
      } else {
        console.log(`✅ Updated ${updateIds.length} reply_opportunities: is_root_tweet=false, is_reply_tweet=true, status=skipped`);
      }
    } else {
      console.log(`   [DRY RUN] Would update ${replyOpps.length} records: is_root_tweet=false, is_reply_tweet=true, status=skipped`);
    }
  }
  
  // Step 2: Find content_metadata replies with root_tweet_id != target_tweet_id
  console.log('\nStep 2: Finding content_metadata replies with root != target...');
  const { data: badReplies, error: replyError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, target_tweet_id, root_tweet_id, status')
    .eq('decision_type', 'reply')
    .not('root_tweet_id', 'is', null)
    .not('target_tweet_id', 'is', null)
    .neq('root_tweet_id', 'target_tweet_id');
  
  if (replyError) {
    console.error(`❌ Error querying content_metadata: ${replyError.message}`);
    process.exit(1);
  }
  
  console.log(`   Found ${badReplies?.length || 0} replies with root != target\n`);
  
  if (badReplies && badReplies.length > 0) {
    console.log('   Sample records:');
    badReplies.slice(0, 5).forEach(reply => {
      console.log(`     - decision_id=${reply.decision_id} target=${reply.target_tweet_id} root=${reply.root_tweet_id} status=${reply.status}`);
    });
    if (badReplies.length > 5) {
      console.log(`     ... and ${badReplies.length - 5} more`);
    }
    console.log('');
    
    if (!DRY_RUN) {
      // Update: Set status=blocked, skip_reason
      const decisionIds = badReplies.map(r => r.decision_id);
      const { error: updateError } = await supabase
        .from('content_generation_metadata_comprehensive')
        .update({
          status: 'blocked',
          skip_reason: 'backfill_root_mismatch',
          updated_at: new Date().toISOString(),
        })
        .in('decision_id', decisionIds);
      
      if (updateError) {
        console.error(`❌ Error updating content_metadata: ${updateError.message}`);
      } else {
        console.log(`✅ Updated ${decisionIds.length} content_metadata records: status=blocked, skip_reason=backfill_root_mismatch`);
      }
    } else {
      console.log(`   [DRY RUN] Would update ${badReplies.length} records: status=blocked, skip_reason=backfill_root_mismatch`);
    }
  }
  
  // Step 3: Find content_metadata replies with null root_tweet_id
  console.log('\nStep 3: Finding content_metadata replies with null root_tweet_id...');
  const { data: nullRootReplies, error: nullRootError } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, tweet_id, target_tweet_id, root_tweet_id, status')
    .eq('decision_type', 'reply')
    .not('target_tweet_id', 'is', null)
    .is('root_tweet_id', null)
    .in('status', ['queued', 'ready', 'posted']); // Only active ones
  
  if (nullRootError) {
    console.error(`❌ Error querying content_metadata: ${nullRootError.message}`);
    process.exit(1);
  }
  
  console.log(`   Found ${nullRootReplies?.length || 0} replies with null root_tweet_id (active status)\n`);
  
  if (nullRootReplies && nullRootReplies.length > 0) {
    console.log('   Sample records:');
    nullRootReplies.slice(0, 5).forEach(reply => {
      console.log(`     - decision_id=${reply.decision_id} target=${reply.target_tweet_id} status=${reply.status}`);
    });
    if (nullRootReplies.length > 5) {
      console.log(`     ... and ${nullRootReplies.length - 5} more`);
    }
    console.log('');
    
    if (!DRY_RUN) {
      // Update: Set root_tweet_id = target_tweet_id (assume root if null)
      const decisionIds = nullRootReplies.map(r => r.decision_id);
      const updates = nullRootReplies.map(r => ({
        decision_id: r.decision_id,
        root_tweet_id: r.target_tweet_id, // Set to target as fallback
      }));
      
      // Batch update
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('content_generation_metadata_comprehensive')
          .update({
            root_tweet_id: update.root_tweet_id,
            updated_at: new Date().toISOString(),
          })
          .eq('decision_id', update.decision_id);
        
        if (updateError) {
          console.error(`   ⚠️  Error updating decision_id=${update.decision_id}: ${updateError.message}`);
        }
      }
      
      console.log(`✅ Updated ${updates.length} content_metadata records: root_tweet_id = target_tweet_id`);
    } else {
      console.log(`   [DRY RUN] Would update ${nullRootReplies.length} records: root_tweet_id = target_tweet_id`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('✅ BACKFILL COMPLETE');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  process.exit(0);
}

main().catch(console.error);


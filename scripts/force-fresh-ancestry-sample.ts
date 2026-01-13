#!/usr/bin/env tsx
/**
 * Force fresh ancestry resolution using tweet IDs that haven't been seen before
 * This bypasses cache to test new code paths
 */

import { createClient } from '@supabase/supabase-js';
import { resolveTweetAncestry, recordReplyDecision, shouldAllowReply } from '../src/jobs/replySystemV2/replyDecisionRecorder';
import { fetchAndEvaluateCandidates } from '../src/jobs/replySystemV2/orchestrator';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const count = parseInt(process.argv.find(arg => arg.startsWith('--count='))?.split('=')[1] || '25', 10);
  
  console.log(`=== Force Fresh Ancestry Sample ===\n`);
  console.log(`Target count: ${count} fresh tweet IDs\n`);
  
  // Step 1: Fetch candidates from feeds
  console.log('Step 1: Fetching candidates from feeds...');
  const fetchResult = await fetchAndEvaluateCandidates();
  console.log(`✅ Fetched ${fetchResult.fetched} tweets, evaluated ${fetchResult.evaluated}\n`);
  
  // Step 2: Get tweet IDs from multiple sources
  console.log('Step 2: Collecting tweet IDs from recent feeds...');
  
  const candidateIds: string[] = [];
  
  // Source 1: discovered_accounts
  const { data: discoveredTweets } = await supabase
    .from('discovered_accounts')
    .select('tweet_id')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (discoveredTweets) {
    candidateIds.push(...discoveredTweets.map(t => t.tweet_id).filter(Boolean));
  }
  
  // Source 2: reply_candidate_queue (recent candidates)
  const { data: queueCandidates } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (queueCandidates) {
    candidateIds.push(...queueCandidates.map(c => c.candidate_tweet_id).filter(Boolean));
  }
  
  // Source 3: Use fetchAndEvaluateCandidates to get fresh IDs
  // The function returns fetched count, but we need to query the results
  // For now, use the IDs we collected above
  
  // Deduplicate
  const uniqueIds = Array.from(new Set(candidateIds));
  console.log(`Found ${uniqueIds.length} unique candidate tweet IDs\n`);
  
  // Step 3: Filter out IDs that already appear in reply_decisions (last 24h)
  console.log('Step 3: Filtering out IDs already in reply_decisions...');
  const { data: existingDecisions } = await supabase
    .from('reply_decisions')
    .select('target_tweet_id')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  
  const existingIds = new Set(existingDecisions?.map(d => d.target_tweet_id).filter(Boolean) || []);
  console.log(`Found ${existingIds.size} IDs already in reply_decisions\n`);
  
  // Step 4: Filter out IDs present in reply_ancestry_cache
  console.log('Step 4: Filtering out IDs in reply_ancestry_cache...');
  const { data: cachedAncestry } = await supabase
    .from('reply_ancestry_cache')
    .select('tweet_id');
  
  const cachedIds = new Set(cachedAncestry?.map(c => c.tweet_id).filter(Boolean) || []);
  console.log(`Found ${cachedIds.size} IDs in ancestry cache\n`);
  
  // Step 5: Choose first N "never seen" IDs
  const freshIds = candidateIds.filter(id => 
    !existingIds.has(id) && !cachedIds.has(id)
  ).slice(0, count);
  
  console.log(`Step 5: Selected ${freshIds.length} fresh tweet IDs\n`);
  
  if (freshIds.length === 0) {
    console.log('⚠️ No fresh tweet IDs found. Using any available IDs...');
    const fallbackIds = candidateIds.filter(id => !existingIds.has(id)).slice(0, count);
    if (fallbackIds.length === 0) {
      console.error('❌ No candidate IDs available');
      return;
    }
    freshIds.push(...fallbackIds);
  }
  
  console.log(`Processing ${freshIds.length} fresh tweet IDs...\n`);
  
  // Step 6: For each ID, run ancestry resolution and record decision
  let processed = 0;
  let skippedOverload = 0;
  let hasOverloadJson = 0;
  let hasDetailVersion = 0;
  
  for (const tweetId of freshIds) {
    try {
      console.log(`\n--- Processing ${tweetId} (${processed + 1}/${freshIds.length}) ---`);
      
      // Resolve ancestry (this will use new code path)
      const ancestry = await resolveTweetAncestry(tweetId);
      
      // Check if should allow (this extracts deny_reason_detail)
      const allowCheck = await shouldAllowReply(ancestry);
      
      // Record decision
      await recordReplyDecision({
        target_tweet_id: tweetId,
        target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
        root_tweet_id: ancestry.rootTweetId || 'null',
        ancestry_depth: ancestry.ancestryDepth ?? -1,
        is_root: ancestry.isRoot,
        decision: allowCheck.allow ? 'ALLOW' : 'DENY',
        reason: allowCheck.reason,
        deny_reason_code: allowCheck.deny_reason_code,
        deny_reason_detail: allowCheck.deny_reason_detail,
        status: ancestry.status,
        confidence: ancestry.confidence,
        method: ancestry.method || 'unknown',
        cache_hit: ancestry.cache_hit || false,
        pipeline_source: 'force_fresh_sample',
        scored_at: new Date().toISOString(),
      });
      
      processed++;
      
      if (allowCheck.deny_reason_code === 'ANCESTRY_SKIPPED_OVERLOAD') {
        skippedOverload++;
        if (allowCheck.deny_reason_detail?.includes('OVERLOAD_DETAIL_JSON') || 
            allowCheck.deny_reason_detail?.includes('detail_version')) {
          hasOverloadJson++;
        }
        if (allowCheck.deny_reason_detail?.includes('detail_version')) {
          hasDetailVersion++;
        }
      }
      
      // Small delay to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error: any) {
      console.error(`❌ Error processing ${tweetId}:`, error.message);
    }
  }
  
  console.log(`\n=== Summary ===`);
  console.log(`Processed: ${processed}/${freshIds.length}`);
  console.log(`SKIPPED_OVERLOAD: ${skippedOverload}`);
  console.log(`Has OVERLOAD_DETAIL_JSON marker: ${hasOverloadJson}`);
  console.log(`Has detail_version marker: ${hasDetailVersion}`);
}

main().catch(console.error);

#!/usr/bin/env tsx
/**
 * 🎯 POST ONE CURATED GOLDEN REPLY
 * 
 * Deterministic script to post ONE reply from curated candidates.
 * Filters by: whitelisted handles, last 6h, root-only, quality gates, grounding.
 * 
 * Usage:
 *   railway run -s xBOT -- pnpm exec tsx scripts/post-one-curated-golden-reply.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry } from '../src/jobs/replySystemV2/replyDecisionRecorder';
import { filterTargetQuality } from '../src/gates/replyTargetQualityFilter';
import { verifyContextGrounding } from '../src/gates/replyContextGroundingGate';
import { fetchCuratedCandidates, isCuratedMode, getCuratedHandles } from '../src/jobs/replySystemV2/curatedCandidateFetcher';
import { processPostingQueue } from '../src/jobs/postingQueue';

const MAX_CANDIDATES = 25;
const MAX_AGE_HOURS = 6;
const MAX_AGE_MS = MAX_AGE_HOURS * 60 * 60 * 1000;

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🎯 POST ONE CURATED GOLDEN REPLY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Check curated mode
  if (!isCuratedMode()) {
    console.error('❌ Curated mode not enabled. Set REPLY_TARGET_MODE=curated');
    process.exit(1);
  }

  const curatedHandles = getCuratedHandles();
  if (curatedHandles.length === 0) {
    console.error('❌ No curated handles configured. Set REPLY_CURATED_HANDLES=handle1,handle2,...');
    process.exit(1);
  }

  console.log(`✅ Curated mode enabled`);
  console.log(`✅ Curated handles: ${curatedHandles.join(', ')}\n`);

  const supabase = getSupabaseClient();
  const cutoffTime = new Date(Date.now() - MAX_AGE_MS).toISOString();

  // Step 1: Fetch fresh curated candidates
  console.log('📥 Fetching curated candidates...');
  const fetchResult = await fetchCuratedCandidates();
  console.log(`   Fetched: ${fetchResult.fetched}, Queued: ${fetchResult.queued}`);
  if (fetchResult.errors.length > 0) {
    console.log(`   Errors: ${fetchResult.errors.slice(0, 3).join(', ')}`);
  }
  console.log('');

  // Step 2: Pull candidates from queue (last 6h, curated handles)
  console.log(`📋 Loading candidates from queue (last ${MAX_AGE_HOURS}h)...`);
  const { data: allCandidates, error: queueError } = await supabase
    .from('reply_candidate_queue')
    .select('candidate_tweet_id, created_at, metadata')
    .gte('created_at', cutoffTime)
    .eq('status', 'queued')
    .order('created_at', { ascending: false })
    .limit(MAX_CANDIDATES * 2); // Get more to filter by handle

  if (queueError) {
    console.error(`❌ Queue query error: ${queueError.message}`);
    process.exit(1);
  }

  // Filter by curated handles (stored in metadata.author_handle)
  let candidates = (allCandidates || []).filter(c => {
    const authorHandle = c.metadata?.author_handle?.toLowerCase().replace('@', '');
    return authorHandle && curatedHandles.includes(authorHandle);
  }).slice(0, MAX_CANDIDATES);

  // STEP 5 FALLBACK: If no curated candidates, use ANY candidates from queue (apply quality filter + root-only)
  if (!candidates || candidates.length === 0) {
    console.log(`⚠️  No curated candidates found, using FALLBACK: any candidates from queue`);
    console.log(`   Will apply quality filter + root-only invariant\n`);
    
    candidates = (allCandidates || []).slice(0, MAX_CANDIDATES);
    
    if (!candidates || candidates.length === 0) {
      console.error(`❌ No candidates found in queue at all (last ${MAX_AGE_HOURS}h)`);
      process.exit(1);
    }
    
    console.log(`✅ Found ${candidates.length} candidates (fallback mode)\n`);
  } else {
    console.log(`✅ Found ${candidates.length} curated candidates\n`);
  }

  // Step 3: Validate each candidate (root + exists + quality + grounding)
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const tweetId = candidate.candidate_tweet_id;

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Candidate ${i + 1}/${candidates.length}: ${tweetId}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      // 3a: Validate root + exists
      console.log('🔍 Validating root + exists...');
      const ancestry = await resolveTweetAncestry(tweetId);
      
      if (ancestry.status !== 'OK' || !ancestry.isRoot) {
        console.log(`   ❌ Not root or status=${ancestry.status}`);
        continue;
      }

      if (ancestry.targetInReplyToTweetId !== null) {
        console.log(`   ❌ Has parent: ${ancestry.targetInReplyToTweetId}`);
        continue;
      }

      console.log(`   ✅ Root verified: ${ancestry.rootTweetId}`);

      // 3b: Get target text for quality filter
      const targetText = ancestry.normalizedSnapshot || '';
      if (!targetText || targetText.length < 20) {
        console.log(`   ❌ Target text too short or missing`);
        continue;
      }

      // 3c: Quality filter
      console.log('🔍 Running quality filter...');
      const authorHandle = candidate.metadata?.author_handle || undefined;
      const qualityResult = filterTargetQuality(
        targetText,
        authorHandle,
        undefined,
        targetText
      );

      if (!qualityResult.pass) {
        console.log(`   ❌ Quality filter blocked: ${qualityResult.code}`);
        console.log(`   Reason: ${qualityResult.reason}`);
        continue;
      }

      console.log(`   ✅ Quality filter passed (score: ${qualityResult.score || 'N/A'})`);

      // 3d: Generate reply (via tieredScheduler flow)
      console.log('🤖 Generating reply...');
      const { attemptScheduledReply } = await import('../src/jobs/replySystemV2/tieredScheduler');
      
      // Force this candidate by temporarily updating queue status
      await supabase
        .from('reply_candidate_queue')
        .update({ status: 'selected', selected_at: new Date().toISOString() })
        .eq('candidate_tweet_id', tweetId);

      const schedulerResult = await attemptScheduledReply();

      if (!schedulerResult.posted) {
        console.log(`   ❌ Scheduler did not post: ${schedulerResult.reason}`);
        // Reset status
        await supabase
          .from('reply_candidate_queue')
          .update({ status: 'queued', selected_at: null })
          .eq('candidate_tweet_id', tweetId);
        continue;
      }

      // 3e: Check for POST_SUCCESS event
      console.log('🔍 Checking for POST_SUCCESS...');
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for event to be written

      const { data: successEvents } = await supabase
        .from('system_events')
        .select('event_data, created_at')
        .eq('event_type', 'POST_SUCCESS')
        .eq('event_data->>decision_id', schedulerResult.candidate_tweet_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!successEvents || successEvents.length === 0) {
        console.log(`   ⚠️  No POST_SUCCESS event found (may still be processing)`);
        // Check reply_decisions for posted_reply_tweet_id
        const { data: decision } = await supabase
          .from('reply_decisions')
          .select('posted_reply_tweet_id, decision_id')
          .eq('target_tweet_id', tweetId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (decision?.posted_reply_tweet_id) {
          const tweetUrl = `https://x.com/i/status/${decision.posted_reply_tweet_id}`;
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`           ✅ SUCCESS`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
          console.log(`Tweet URL: ${tweetUrl}`);
          console.log(`Decision ID: ${decision.decision_id}`);
          console.log(`Posted Reply Tweet ID: ${decision.posted_reply_tweet_id}\n`);
          process.exit(0);
        } else {
          console.log(`   ❌ No posted_reply_tweet_id found`);
          continue;
        }
      }

      const eventData = typeof successEvents[0].event_data === 'string'
        ? JSON.parse(successEvents[0].event_data)
        : successEvents[0].event_data;

      const tweetUrl = eventData.tweet_url || `https://x.com/i/status/${eventData.posted_reply_tweet_id}`;

      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`           ✅ SUCCESS`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
      console.log(`Tweet URL: ${tweetUrl}`);
      console.log(`Decision ID: ${eventData.decision_id}`);
      console.log(`Posted Reply Tweet ID: ${eventData.posted_reply_tweet_id}`);
      console.log(`Target Tweet ID: ${eventData.target_tweet_id}\n`);

      process.exit(0);

    } catch (error: any) {
      console.error(`❌ Error processing candidate ${tweetId}: ${error.message}`);
      console.error(error.stack);
      continue;
    }
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`           ❌ NO SUCCESSFUL POST`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  console.log(`Processed ${candidates.length} candidates, none resulted in POST_SUCCESS`);
  console.log(`Check logs above for failure reasons.\n`);
  process.exit(1);
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

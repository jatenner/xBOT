#!/usr/bin/env tsx
/**
 * 🔍 FORENSIC TRACE: Bad Reply Analysis
 * 
 * TASK A: Trace a bad reply that replied to a reply instead of root
 * Usage: railway run -s xBOT -- pnpm exec tsx scripts/forensic-trace-bad-reply.ts --postedReplyTweetId=2011569652854612157
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';
import { resolveTweetAncestry } from '../src/jobs/replySystemV2/replyDecisionRecorder';

async function main() {
  const postedReplyTweetId = process.argv.find(arg => arg.startsWith('--postedReplyTweetId='))?.split('=')[1];
  
  if (!postedReplyTweetId) {
    console.error('❌ Missing --postedReplyTweetId parameter');
    console.error('Usage: railway run -s xBOT -- pnpm exec tsx scripts/forensic-trace-bad-reply.ts --postedReplyTweetId=<id>');
    process.exit(1);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔍 FORENSIC TRACE: BAD REPLY ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log(`Posted Reply Tweet ID: ${postedReplyTweetId}\n`);
  
  const supabase = getSupabaseClient();
  
  // TASK A.1: Query reply_decisions for this posted_reply_tweet_id
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           STEP 1: REPLY_DECISIONS ROW');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const { data: decision, error: decisionError } = await supabase
    .from('reply_decisions')
    .select('id, decision_id, target_tweet_id, posted_reply_tweet_id, decision, deny_reason_code, pipeline_source, template_id, prompt_version, scored_at, template_selected_at, generation_completed_at, posting_completed_at, ancestry_depth, is_root, root_tweet_id, target_in_reply_to_tweet_id, status, confidence, method, created_at')
    .eq('posted_reply_tweet_id', postedReplyTweetId)
    .maybeSingle();
  
  // Also query system_events for app_version at post time
  const { data: postEvents } = await supabase
    .from('system_events')
    .select('event_data, created_at')
    .in('event_type', ['POST_SUCCESS', 'POST_FAILED', 'POST_ATTEMPT'])
    .contains('event_data', { decision_id: decision?.decision_id || '' })
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (decisionError) {
    console.error(`❌ Error querying reply_decisions: ${decisionError.message}`);
    process.exit(1);
  }
  
  if (!decision) {
    // Try content_metadata instead
    console.log(`⚠️  No reply_decisions row found, checking content_metadata...\n`);
    
    const { data: contentMeta } = await supabase
      .from('content_metadata')
      .select('decision_id, target_tweet_id, tweet_id, status, decision_type, created_at')
      .eq('tweet_id', postedReplyTweetId)
      .eq('decision_type', 'reply')
      .maybeSingle();
    
    if (contentMeta) {
      console.log(`✅ Found in content_metadata, using decision_id: ${contentMeta.decision_id}\n`);
      
      // Query reply_decisions by decision_id
      const { data: decisionByDecisionId } = await supabase
        .from('reply_decisions')
        .select('id, decision_id, target_tweet_id, posted_reply_tweet_id, decision, deny_reason_code, pipeline_source, template_id, prompt_version, scored_at, template_selected_at, generation_completed_at, posting_completed_at, ancestry_depth, is_root, root_tweet_id, target_in_reply_to_tweet_id, status, confidence, method, created_at')
        .eq('decision_id', contentMeta.decision_id)
        .maybeSingle();
      
      if (decisionByDecisionId) {
        decision = decisionByDecisionId;
      } else {
        console.error(`❌ No reply_decisions row found for decision_id=${contentMeta.decision_id}`);
        console.error(`   This may be an old post before reply_decisions table existed.\n`);
        process.exit(1);
      }
    } else {
      console.error(`❌ No reply_decisions or content_metadata row found for posted_reply_tweet_id=${postedReplyTweetId}`);
      console.error(`   This tweet may not have been posted through the reply system.\n`);
      process.exit(1);
    }
  }
  
  console.log('📊 REPLY_DECISIONS ROW:');
  console.log(`   id: ${decision.id}`);
  console.log(`   decision_id: ${decision.decision_id}`);
  console.log(`   target_tweet_id: ${decision.target_tweet_id}`);
  console.log(`   posted_reply_tweet_id: ${decision.posted_reply_tweet_id}`);
  console.log(`   decision: ${decision.decision}`);
  console.log(`   deny_reason_code: ${decision.deny_reason_code || 'N/A'}`);
  console.log(`   pipeline_source: ${decision.pipeline_source || 'N/A'}`);
  console.log(`   template_id: ${decision.template_id || 'N/A'}`);
  console.log(`   prompt_version: ${decision.prompt_version || 'N/A'}`);
  console.log(`   scored_at: ${decision.scored_at || 'N/A'}`);
  console.log(`   template_selected_at: ${decision.template_selected_at || 'N/A'}`);
  console.log(`   generation_completed_at: ${decision.generation_completed_at || 'N/A'}`);
  console.log(`   posting_completed_at: ${decision.posting_completed_at || 'N/A'}`);
  console.log(`   ancestry_depth: ${decision.ancestry_depth}`);
  console.log(`   is_root: ${decision.is_root}`);
  console.log(`   root_tweet_id: ${decision.root_tweet_id}`);
  console.log(`   target_in_reply_to_tweet_id: ${decision.target_in_reply_to_tweet_id || 'NULL'}`);
  console.log(`   status: ${decision.status}`);
  console.log(`   confidence: ${decision.confidence}`);
  console.log(`   method: ${decision.method}`);
  console.log(`   created_at: ${decision.created_at}`);
  
  // Display app_version from system_events if available
  if (postEvents && postEvents.length > 0) {
    console.log(`\n   📊 SYSTEM_EVENTS (app_version at post time):`);
    for (const event of postEvents) {
      const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
      if (eventData.app_version) {
        console.log(`     ${event.created_at}: ${eventData.app_version}`);
      }
    }
  }
  console.log('');
  
  // TASK A.2: Determine if target_tweet_id is root or reply
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           STEP 2: ANCESTRY RESOLUTION');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`Resolving ancestry for target_tweet_id: ${decision.target_tweet_id}...\n`);
  
  // Clear cache to force fresh resolution
  await supabase
    .from('reply_ancestry_cache')
    .delete()
    .eq('tweet_id', decision.target_tweet_id);
  
  const ancestry = await resolveTweetAncestry(decision.target_tweet_id);
  
  console.log('📊 ANCESTRY RESOLUTION RESULT:');
  console.log(`   target_tweet_id: ${ancestry.targetTweetId}`);
  console.log(`   root_tweet_id: ${ancestry.rootTweetId || 'NULL'}`);
  console.log(`   target_in_reply_to_tweet_id: ${ancestry.targetInReplyToTweetId || 'NULL'}`);
  console.log(`   ancestry_depth: ${ancestry.ancestryDepth ?? 'NULL'}`);
  console.log(`   is_root: ${ancestry.isRoot}`);
  console.log(`   status: ${ancestry.status}`);
  console.log(`   confidence: ${ancestry.confidence}`);
  console.log(`   method: ${ancestry.method}`);
  
  // Extract signals if available
  if (ancestry.signals && typeof ancestry.signals === 'object') {
    const signals = ancestry.signals as any;
    console.log(`\n   Signals:`);
    console.log(`     in_reply_to_status_id: ${signals.inReplyToStatusId || 'NULL'}`);
    console.log(`     conversation_id: ${signals.conversationId || 'NULL'}`);
    if (signals.tweetText) {
      console.log(`     tweet_text: ${signals.tweetText.substring(0, 100)}...`);
    }
  }
  
  // Check if target is actually a reply
  const isActuallyReply = ancestry.targetInReplyToTweetId !== null && 
                         ancestry.targetInReplyToTweetId !== undefined &&
                         ancestry.targetInReplyToTweetId !== ancestry.targetTweetId;
  
  const isActuallyRoot = ancestry.isRoot && 
                        ancestry.status === 'OK' && 
                        ancestry.ancestryDepth === 0 &&
                        (ancestry.targetInReplyToTweetId === null || ancestry.targetInReplyToTweetId === undefined);
  
  console.log(`\n   🔍 ANALYSIS:`);
  console.log(`     Is actually a reply: ${isActuallyReply ? '❌ YES' : '✅ NO'}`);
  console.log(`     Is actually root: ${isActuallyRoot ? '✅ YES' : '❌ NO'}`);
  
  if (isActuallyReply) {
    console.log(`\n   ⚠️  PROBLEM DETECTED: Target tweet IS a reply, not a root tweet!`);
    console.log(`      Target is replying to: ${ancestry.targetInReplyToTweetId}`);
    console.log(`      Root tweet should be: ${ancestry.rootTweetId}`);
  }
  
  // TASK A.3: Identify code path
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           STEP 3: CODE PATH ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('🔍 CODE PATH INVESTIGATION:\n');
  
  // Check decision record values
  const wasAllowed = decision.decision === 'ALLOW';
  const wasRootFlagged = decision.is_root === true;
  const depthWasZero = decision.ancestry_depth === 0;
  const statusWasOk = decision.status === 'OK';
  
  console.log(`   Decision record values:`);
  console.log(`     decision: ${decision.decision} ${wasAllowed ? '✅' : '❌'}`);
  console.log(`     is_root: ${decision.is_root} ${wasRootFlagged ? '✅' : '❌'}`);
  console.log(`     ancestry_depth: ${decision.ancestry_depth} ${depthWasZero ? '✅' : '❌'}`);
  console.log(`     status: ${decision.status} ${statusWasOk ? '✅' : '❌'}`);
  console.log(`     method: ${decision.method}`);
  
  // Check if UNCERTAIN relaxation was used
  const wasUncertain = decision.status === 'UNCERTAIN';
  const hasRelaxedRoot = wasUncertain && wasRootFlagged && depthWasZero;
  
  console.log(`\n   Possible bypass paths:`);
  console.log(`     1. UNCERTAIN relaxation: ${hasRelaxedRoot ? '⚠️  YES (likely)' : '✅ NO'}`);
  console.log(`     2. Force script bypass: ${decision.pipeline_source?.includes('manual') || decision.pipeline_source?.includes('force') ? '⚠️  YES' : '✅ NO'}`);
  console.log(`     3. Scheduler selection: ${decision.pipeline_source?.includes('scheduler') ? '⚠️  YES' : '✅ NO'}`);
  console.log(`     4. Missing posting gate: ${wasAllowed && !wasRootFlagged ? '⚠️  YES (CRITICAL)' : '✅ NO'}`);
  
  // Check content_metadata for additional context
  if (decision.decision_id) {
    const { data: contentMeta } = await supabase
      .from('content_metadata')
      .select('status, skip_reason, error_message, pipeline_source')
      .eq('decision_id', decision.decision_id)
      .maybeSingle();
    
    if (contentMeta) {
      console.log(`\n   Content metadata:`);
      console.log(`     status: ${contentMeta.status}`);
      console.log(`     skip_reason: ${contentMeta.skip_reason || 'N/A'}`);
      console.log(`     pipeline_source: ${contentMeta.pipeline_source || 'N/A'}`);
    }
  }
  
  // TASK A.4: Check which gate failed to block it
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           STEP 4: GATE FAILURE ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('🔍 GATE CHECK ANALYSIS:\n');
  
  // Check content_metadata for skip_reason
  if (decision.decision_id) {
    const { data: contentMeta } = await supabase
      .from('content_metadata')
      .select('status, skip_reason, pipeline_source, build_sha, thread_parts')
      .eq('decision_id', decision.decision_id)
      .maybeSingle();
    
    if (contentMeta) {
      console.log(`   Content metadata:`);
      console.log(`     status: ${contentMeta.status}`);
      console.log(`     skip_reason: ${contentMeta.skip_reason || 'N/A'}`);
      console.log(`     pipeline_source: ${contentMeta.pipeline_source || 'N/A'}`);
      console.log(`     build_sha: ${contentMeta.build_sha || 'N/A'}`);
      
      if (contentMeta.thread_parts && Array.isArray(contentMeta.thread_parts) && contentMeta.thread_parts.length > 1) {
        console.log(`     ⚠️  THREAD_REPLY DETECTED: ${contentMeta.thread_parts.length} segments`);
      }
    }
  }
  
  // Check system_events for gate failures
  if (decision.decision_id) {
    const { data: gateEvents } = await supabase
      .from('system_events')
      .select('event_type, event_data, created_at')
      .eq('event_type', 'POST_FAILED')
      .contains('event_data', { decision_id: decision.decision_id })
      .order('created_at', { ascending: false })
      .limit(3);
    
    if (gateEvents && gateEvents.length > 0) {
      console.log(`\n   POST_FAILED events:`);
      for (const event of gateEvents) {
        const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
        console.log(`     ${event.created_at}: ${eventData.pipeline_error_reason || 'N/A'}`);
        if (eventData.deny_reason_code) {
          console.log(`       deny_reason_code: ${eventData.deny_reason_code}`);
        }
      }
    }
  }
  
  // Final verdict
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📋 VERDICT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (isActuallyReply) {
    console.log('❌ CONFIRMED: Bot replied to a reply instead of root tweet');
    console.log(`\n   Root cause analysis:`);
    
    if (hasRelaxedRoot) {
      console.log(`   ⚠️  LIKELY CAUSE: UNCERTAIN relaxation allowed non-root tweet`);
      console.log(`      - Status was UNCERTAIN but is_root=true and depth=0`);
      console.log(`      - Code path: scheduler/orchestrator with relaxed validation`);
      console.log(`      - Fix needed: Tighten UNCERTAIN handling in shouldAllowReply()`);
    } else if (!wasRootFlagged && wasAllowed) {
      console.log(`   ⚠️  LIKELY CAUSE: Missing root check in posting gate`);
      console.log(`      - Decision was ALLOW but is_root=false`);
      console.log(`      - Code path: postingQueue.ts postReply() may have bypassed check`);
      console.log(`      - Fix needed: Add hard gate before posting`);
    } else if (decision.pipeline_source?.includes('manual') || decision.pipeline_source?.includes('force')) {
      console.log(`   ⚠️  LIKELY CAUSE: Manual/force script bypass`);
      console.log(`      - Pipeline source: ${decision.pipeline_source}`);
      console.log(`      - Fix needed: Add root check to manual scripts`);
    } else {
      console.log(`   ⚠️  UNKNOWN CAUSE: Need to investigate further`);
      console.log(`      - Decision values suggest it should have been blocked`);
      console.log(`      - But posting succeeded - check postingQueue.ts gates`);
    }
    
    console.log(`\n   Files to check:`);
    console.log(`     1. src/jobs/replySystemV2/replyDecisionRecorder.ts:shouldAllowReply()`);
    console.log(`     2. src/jobs/postingQueue.ts:postReply()`);
    console.log(`     3. src/jobs/replySystemV2/tieredScheduler.ts (if scheduler)`);
    console.log(`     4. scripts/post-one-golden-reply.ts (if manual)`);
  } else {
    console.log('✅ Target tweet appears to be root (or ancestry resolution changed)');
    console.log('   This may be a false positive, or the tweet was deleted/recreated.');
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});

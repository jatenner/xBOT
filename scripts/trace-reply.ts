/**
 * 🔍 TRACE REPLY
 * 
 * Traces a reply tweet_id through the entire pipeline:
 * feed_run_id -> candidate_evaluation_id -> candidate_id -> queue_id -> scheduler_run_id -> decision_id -> permit_id -> posted_tweet_id
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Usage: pnpm exec tsx scripts/trace-reply.ts <tweet_id>');
    console.error('Example: pnpm exec tsx scripts/trace-reply.ts 2009296730974515446');
    process.exit(1);
  }
  
  const tweetId = args[0];
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`🔍 TRACING REPLY: ${tweetId}`);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  
  // Step 1: Find decision by tweet_id
  console.log('[TRACE] Step 1: Finding decision...');
  const { data: decision } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('*')
    .eq('tweet_id', tweetId)
    .eq('decision_type', 'reply')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!decision) {
    console.error(`[TRACE] ❌ Decision not found for tweet_id=${tweetId}`);
    process.exit(1);
  }
  
  console.log(`[TRACE] ✅ Found decision: ${decision.decision_id}`);
  console.log(`[TRACE]   Pipeline: ${decision.pipeline_source}`);
  console.log(`[TRACE]   Posted at: ${decision.posted_at}\n`);
  
  // Step 2: Find permit
  console.log('[TRACE] Step 2: Finding permit...');
  const { data: permit } = await supabase
    .from('post_attempts')
    .select('*')
    .eq('decision_id', decision.decision_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (permit) {
    console.log(`[TRACE] ✅ Found permit: ${permit.permit_id}`);
    console.log(`[TRACE]   Status: ${permit.status}`);
    console.log(`[TRACE]   Created: ${permit.created_at}`);
    console.log(`[TRACE]   Approved: ${permit.approved_at || 'N/A'}`);
    console.log(`[TRACE]   Used: ${permit.used_at || 'N/A'}\n`);
  } else {
    console.log(`[TRACE] ⚠️ No permit found (may be pre-permit system)\n`);
  }
  
  // Step 3: Find queue entry
  console.log('[TRACE] Step 3: Finding queue entry...');
  let queueEntry = null;
  let candidateEvaluation = null;
  
  if (decision.queue_id) {
    const { data: queue } = await supabase
      .from('reply_candidate_queue')
      .select('*')
      .eq('id', decision.queue_id)
      .single();
    
    if (queue) {
      queueEntry = queue;
      console.log(`[TRACE] ✅ Found queue entry: ${queue.id}`);
      console.log(`[TRACE]   Candidate tweet: ${queue.candidate_tweet_id}`);
      console.log(`[TRACE]   Predicted tier: ${queue.predicted_tier}`);
      console.log(`[TRACE]   Score: ${queue.overall_score}`);
      console.log(`[TRACE]   Scheduler run: ${queue.scheduler_run_id || 'N/A'}\n`);
      
      // Get evaluation
      if (queue.evaluation_id) {
        const { data: eval } = await supabase
          .from('candidate_evaluations')
          .select('*')
          .eq('id', queue.evaluation_id)
          .single();
        
        if (eval) {
          candidateEvaluation = eval;
        }
      }
    }
  } else if (decision.candidate_evaluation_id) {
    // Direct link to evaluation
    const { data: eval } = await supabase
      .from('candidate_evaluations')
      .select('*')
      .eq('id', decision.candidate_evaluation_id)
      .single();
    
    if (eval) {
      candidateEvaluation = eval;
    }
  }
  
  if (candidateEvaluation) {
    console.log(`[TRACE] ✅ Found candidate evaluation: ${candidateEvaluation.id}`);
    console.log(`[TRACE]   Candidate tweet: ${candidateEvaluation.candidate_tweet_id}`);
    console.log(`[TRACE]   Author: @${candidateEvaluation.candidate_author_username}`);
    console.log(`[TRACE]   Source: ${candidateEvaluation.source_type}`);
    console.log(`[TRACE]   Feed run ID: ${candidateEvaluation.feed_run_id || 'N/A'}`);
    console.log(`[TRACE]   Scores:`);
    console.log(`[TRACE]     Overall: ${candidateEvaluation.overall_score}`);
    console.log(`[TRACE]     Topic relevance: ${candidateEvaluation.topic_relevance_score}`);
    console.log(`[TRACE]     Velocity: ${candidateEvaluation.velocity_score}`);
    console.log(`[TRACE]     Predicted views: ${candidateEvaluation.predicted_24h_views}`);
    console.log(`[TRACE]     Predicted tier: ${candidateEvaluation.predicted_tier}`);
    console.log(`[TRACE]   Filter reason: ${candidateEvaluation.filter_reason}\n`);
  } else {
    console.log(`[TRACE] ⚠️ No candidate evaluation found\n`);
  }
  
  // Step 4: Find SLO event
  console.log('[TRACE] Step 4: Finding SLO event...');
  const { data: sloEvent } = await supabase
    .from('reply_slo_events')
    .select('*')
    .eq('decision_id', decision.decision_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (sloEvent) {
    console.log(`[TRACE] ✅ Found SLO event: ${sloEvent.id}`);
    console.log(`[TRACE]   Scheduler run: ${sloEvent.scheduler_run_id}`);
    console.log(`[TRACE]   Slot time: ${sloEvent.slot_time}`);
    console.log(`[TRACE]   Posted: ${sloEvent.posted}`);
    console.log(`[TRACE]   SLO hit: ${sloEvent.slo_hit}\n`);
  } else {
    console.log(`[TRACE] ⚠️ No SLO event found\n`);
  }
  
  // Step 5: Find performance metrics
  console.log('[TRACE] Step 5: Finding performance metrics...');
  const { data: metrics } = await supabase
    .from('reply_performance_metrics')
    .select('*')
    .eq('our_reply_tweet_id', tweetId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (metrics) {
    console.log(`[TRACE] ✅ Found performance metrics: ${metrics.id}`);
    console.log(`[TRACE]   Views 30m: ${metrics.views_30m || 'N/A'}`);
    console.log(`[TRACE]   Views 4h: ${metrics.views_4h || 'N/A'}`);
    console.log(`[TRACE]   Views 24h: ${metrics.views_24h || 'N/A'}`);
    console.log(`[TRACE]   Target: ${metrics.target_24h_views}`);
    console.log(`[TRACE]   Passed target: ${metrics.passed_target ? 'YES ✅' : 'NO ❌'}`);
    console.log(`[TRACE]   Predicted tier: ${metrics.predicted_tier}`);
    console.log(`[TRACE]   Actual tier: ${metrics.actual_tier || 'N/A'}\n`);
  } else {
    console.log(`[TRACE] ⚠️ No performance metrics found (may be too recent)\n`);
  }
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('TRACE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Tweet ID: ${tweetId}`);
  console.log(`Decision ID: ${decision.decision_id}`);
  console.log(`Permit ID: ${permit?.permit_id || 'N/A'}`);
  console.log(`Queue ID: ${queueEntry?.id || 'N/A'}`);
  console.log(`Candidate Evaluation ID: ${candidateEvaluation?.id || 'N/A'}`);
  console.log(`Feed Run ID: ${candidateEvaluation?.feed_run_id || 'N/A'}`);
  console.log(`Scheduler Run ID: ${sloEvent?.scheduler_run_id || queueEntry?.scheduler_run_id || 'N/A'}`);
  console.log(`Source Feed: ${candidateEvaluation?.source_type || 'N/A'}`);
  console.log(`Predicted Tier: ${candidateEvaluation?.predicted_tier || 'N/A'}`);
  console.log(`Predicted Views: ${candidateEvaluation?.predicted_24h_views || 'N/A'}`);
  console.log(`Actual Views (24h): ${metrics?.views_24h || 'N/A'}`);
  console.log(`Passed Target: ${metrics?.passed_target ? 'YES ✅' : metrics?.passed_target === false ? 'NO ❌' : 'PENDING'}`);
  console.log('\n');
  
  process.exit(0);
}

main().catch(console.error);

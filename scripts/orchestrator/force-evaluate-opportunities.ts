#!/usr/bin/env tsx
/**
 * 🔧 FORCE ORCHESTRATOR RUN
 * 
 * Forces evaluation of pending reply_opportunities to create reply_decisions
 * Bypasses normal feed fetching and directly processes opportunities
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';
import { scoreCandidate } from '../../src/jobs/replySystemV2/candidateScorer';
import { resolveTweetAncestry, recordReplyDecision } from '../../src/jobs/replySystemV2/replyDecisionRecorder';
import { refreshCandidateQueue } from '../../src/jobs/replySystemV2/queueManager';

async function main() {
  const supabase = getSupabaseClient();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           🔧 FORCE ORCHESTRATOR RUN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Fetch up to 5 pending opportunities
  const { data: opportunities, error } = await supabase
    .from('reply_opportunities')
    .select('*')
    .eq('status', 'pending')
    .gte('created_at', sixHoursAgo)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (error) {
    console.error(`❌ Failed to fetch opportunities: ${error.message}`);
    process.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.log('⚠️  No pending opportunities found in last 6h');
    process.exit(0);
  }
  
  console.log(`📊 Found ${opportunities.length} pending opportunities\n`);
  
  let evaluated = 0;
  let passed = 0;
  let denied = 0;
  
  for (const opp of opportunities) {
    try {
      console.log(`🔍 Evaluating ${opp.target_tweet_id} (@${opp.target_username || 'unknown'})...`);
      
      // Resolve ancestry
      const ancestry = await resolveTweetAncestry(opp.target_tweet_id);
      
      if (ancestry.status !== 'OK' || !ancestry.isRoot) {
        console.log(`   ⏭️  Skipped: status=${ancestry.status}, isRoot=${ancestry.isRoot}`);
        denied++;
        continue;
      }
      
      // Score candidate
      const score = await scoreCandidate(
        opp.target_tweet_id,
        opp.target_username || 'unknown',
        opp.target_tweet_content || '',
        opp.tweet_posted_at || new Date().toISOString(),
        opp.like_count || 0,
        opp.reply_count || 0,
        opp.retweet_count || 0,
        `forced_${Date.now()}`
      );
      
      evaluated++;
      
      // Create candidate_evaluation (required for queue)
      const feedRunId = `forced_${Date.now()}`;
      await supabase.from('candidate_evaluations').insert({
        candidate_tweet_id: opp.target_tweet_id,
        candidate_author_username: opp.target_username || 'unknown',
        candidate_content: opp.target_tweet_content || '',
        candidate_posted_at: opp.tweet_posted_at || new Date().toISOString(),
        source_type: 'forced_opportunity',
        source_feed_name: 'forced_opportunity',
        feed_run_id: feedRunId,
        is_root_tweet: ancestry.isRoot,
        topic_relevance_score: score.topic_relevance_score,
        spam_score: score.spam_score,
        velocity_score: score.velocity_score,
        recency_score: score.recency_score,
        author_signal_score: score.author_signal_score,
        overall_score: score.overall_score,
        passed_hard_filters: score.passed_hard_filters,
        filter_reason: score.filter_reason,
        predicted_24h_views: score.predicted_24h_views,
        predicted_tier: score.predicted_tier,
        status: score.passed_hard_filters ? 'evaluated' : 'blocked',
      });
      
      // Record decision
      const { mapFilterReasonToDenyCode } = await import('../../src/jobs/replySystemV2/denyReasonMapper');
      const denyReasonCode = score.passed_hard_filters ? null : mapFilterReasonToDenyCode(score.filter_reason);
      
      await recordReplyDecision({
        target_tweet_id: opp.target_tweet_id,
        target_in_reply_to_tweet_id: ancestry.targetInReplyToTweetId,
        root_tweet_id: ancestry.rootTweetId || opp.target_tweet_id,
        ancestry_depth: ancestry.ancestryDepth ?? 0,
        is_root: ancestry.isRoot,
        decision: score.passed_hard_filters ? 'ALLOW' : 'DENY',
        reason: score.passed_hard_filters ? 'Passed filters' : `Filter: ${score.filter_reason}`,
        deny_reason_code: denyReasonCode,
        status: ancestry.status,
        confidence: ancestry.confidence,
        method: ancestry.method || 'forced_evaluation',
        candidate_features: {
          topic_relevance: score.topic_relevance_score,
          velocity: score.velocity_score,
          recency: score.recency_score,
          author_signal: score.author_signal_score,
          overall_score: score.overall_score,
        },
        candidate_score: score.overall_score,
        scored_at: new Date().toISOString(),
        pipeline_source: 'forced_orchestrator',
      } as any);
      
      if (score.passed_hard_filters) {
        console.log(`   ✅ ALLOW: score=${score.overall_score.toFixed(1)}`);
        passed++;
        
        // Mark opportunity as processed
        await supabase
          .from('reply_opportunities')
          .update({ status: 'processed' })
          .eq('id', opp.id);
      } else {
        console.log(`   ❌ DENY: ${score.filter_reason}`);
        denied++;
      }
    } catch (err: any) {
      console.error(`   ❌ Error: ${err.message}`);
    }
  }
  
  // Refresh queue to create queued decisions
  console.log('\n🔄 Refreshing candidate queue...');
  await refreshCandidateQueue();
  
  // Log event
  await supabase.from('system_events').insert({
    event_type: 'ORCHESTRATOR_FORCED_RUN',
    severity: 'info',
    message: `Forced orchestrator run: ${evaluated} evaluated, ${passed} passed, ${denied} denied`,
    event_data: {
      evaluated,
      passed,
      denied,
      opportunities_processed: opportunities.length,
    },
    created_at: new Date().toISOString(),
  });
  
  console.log(`\n✅ Complete: ${evaluated} evaluated, ${passed} passed, ${denied} denied`);
}

main().catch(console.error);

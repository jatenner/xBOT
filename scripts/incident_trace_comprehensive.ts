/**
 * 🔍 COMPREHENSIVE INCIDENT TRACE
 * Traces tweet IDs to determine if ghost or legit
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

const INCIDENT_TWEET_IDS = [
  '2009613043710456073',
  '2009611762119881177'
];

async function traceIncident() {
  const supabase = getSupabaseClient();
  
  console.log('========================================');
  console.log('COMPREHENSIVE INCIDENT TRACE');
  console.log('========================================\n');
  
  const results: any[] = [];
  
  for (const tweetId of INCIDENT_TWEET_IDS) {
    console.log(`\n🔍 TRACING TWEET ID: ${tweetId}`);
    console.log('='.repeat(60));
    
    const trace: any = {
      tweet_id: tweetId,
      classification: 'UNKNOWN',
      evidence: {},
      lineage: {},
      reason: '',
    };
    
    // A1) Check content_generation_metadata_comprehensive
    const { data: contentMeta } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('tweet_id', tweetId)
      .single();
    
    trace.evidence.content_metadata = contentMeta ? 'FOUND' : 'NOT_FOUND';
    if (contentMeta) {
      trace.lineage.decision_id = contentMeta.decision_id;
      trace.lineage.pipeline_source = contentMeta.pipeline_source;
      trace.lineage.status = contentMeta.status;
      trace.lineage.build_sha = contentMeta.build_sha;
      trace.lineage.posted_at = contentMeta.posted_at;
    }
    
    // Check post_attempts (permits)
    const { data: permit } = await supabase
      .from('post_attempts')
      .select('*')
      .eq('actual_tweet_id', tweetId)
      .single();
    
    trace.evidence.permit = permit ? 'FOUND' : 'NOT_FOUND';
    if (permit) {
      trace.lineage.permit_id = permit.permit_id;
      trace.lineage.permit_status = permit.status;
      trace.lineage.permit_pipeline_source = permit.pipeline_source;
      trace.lineage.permit_decision_id = permit.decision_id;
      trace.lineage.permit_created_at = permit.created_at;
      trace.lineage.permit_used_at = permit.used_at;
    }
    
    // Check by decision_id if we found one
    if (trace.lineage.decision_id) {
      const { data: permitByDecision } = await supabase
        .from('post_attempts')
        .select('*')
        .eq('decision_id', trace.lineage.decision_id)
        .single();
      
      if (permitByDecision && !permit) {
        trace.evidence.permit = 'FOUND_BY_DECISION';
        trace.lineage.permit_id = permitByDecision.permit_id;
        trace.lineage.permit_status = permitByDecision.status;
        trace.lineage.permit_pipeline_source = permitByDecision.pipeline_source;
      }
    }
    
    // Check system_events
    const { data: events } = await supabase
      .from('system_events')
      .select('*')
      .or(`event_data->>tweet_id.eq.${tweetId},event_data->>posted_tweet_id.eq.${tweetId},event_data->>decision_id.eq.${trace.lineage.decision_id || 'null'},event_data->>permit_id.eq.${trace.lineage.permit_id || 'null'}`)
      .order('created_at', { ascending: false })
      .limit(20);
    
    trace.evidence.system_events = events?.length || 0;
    if (events && events.length > 0) {
      trace.lineage.events = events.map(e => ({
        type: e.event_type,
        created_at: e.created_at,
        message: e.message,
      }));
    }
    
    // Check ghost_tweets
    const { data: ghost } = await supabase
      .from('ghost_tweets')
      .select('*')
      .eq('tweet_id', tweetId)
      .single();
    
    trace.evidence.ghost_tweets = ghost ? 'FOUND' : 'NOT_FOUND';
    if (ghost) {
      trace.lineage.ghost_detected_at = ghost.detected_at;
      trace.lineage.ghost_status = ghost.status;
    }
    
    // A2) Classify
    const hasDecision = !!trace.lineage.decision_id;
    const hasPermit = !!trace.lineage.permit_id;
    const permitUsed = trace.lineage.permit_status === 'USED';
    const permitMatchesTweet = permit?.actual_tweet_id === tweetId;
    
    if (hasDecision && hasPermit && permitUsed && permitMatchesTweet) {
      trace.classification = 'LEGIT';
      trace.reason = 'Has decision_id + permit_id + permit status=USED + actual_tweet_id matches';
    } else if (!hasDecision && !hasPermit && !trace.evidence.system_events) {
      trace.classification = 'GHOST';
      trace.reason = 'No decision_id, no permit_id, no system_events';
    } else if (hasDecision && !hasPermit) {
      trace.classification = 'GHOST';
      trace.reason = 'Has decision_id but no permit_id (bypassed permit system)';
    } else if (hasPermit && trace.lineage.permit_status !== 'USED') {
      trace.classification = 'SUSPICIOUS';
      trace.reason = `Has permit but status=${trace.lineage.permit_status} (not USED)`;
    } else {
      trace.classification = 'INCOMPLETE';
      trace.reason = 'Partial lineage found but cannot definitively classify';
    }
    
    results.push(trace);
    
    console.log(`\n📋 CLASSIFICATION: ${trace.classification}`);
    console.log(`   Reason: ${trace.reason}`);
    console.log(`\n📊 EVIDENCE:`);
    console.log(`   Content Metadata: ${trace.evidence.content_metadata}`);
    console.log(`   Permit: ${trace.evidence.permit}`);
    console.log(`   System Events: ${trace.evidence.system_events}`);
    console.log(`   Ghost Table: ${trace.evidence.ghost_tweets}`);
    console.log(`\n🔗 LINEAGE:`);
    console.log(JSON.stringify(trace.lineage, null, 2));
  }
  
  return results;
}

traceIncident().then(results => {
  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================\n');
  results.forEach(r => {
    console.log(`${r.tweet_id}: ${r.classification} - ${r.reason}`);
  });
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});


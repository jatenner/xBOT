/**
 * 🔍 INCIDENT TRACE SCRIPT
 * Traces posted tweet IDs to find their origin and permit status
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
  console.log('INCIDENT TRACE REPORT');
  console.log('========================================\n');
  
  for (const tweetId of INCIDENT_TWEET_IDS) {
    console.log(`\n🔍 TRACING TWEET ID: ${tweetId}`);
    console.log('='.repeat(50));
    
    const lineage: any = {
      posted_tweet_id: tweetId,
      permit_id: null,
      decision_id: null,
      pipeline_source: null,
      railway_service_name: null,
      git_sha: null,
      run_id: null,
      target_tweet_id: null,
      target_is_root: null,
      job_origin: null,
    };
    
    // 1. Check permit table
    const { data: permit } = await supabase
      .from('permits')
      .select('*')
      .eq('posted_tweet_id', tweetId)
      .single();
    
    if (permit) {
      lineage.permit_id = permit.id;
      lineage.decision_id = permit.decision_id;
      lineage.target_tweet_id = permit.target_tweet_id;
      console.log(`✅ PERMIT FOUND: ${permit.id}`);
      console.log(`   Decision ID: ${permit.decision_id}`);
      console.log(`   Target Tweet ID: ${permit.target_tweet_id}`);
      console.log(`   Status: ${permit.status}`);
      console.log(`   Created: ${permit.created_at}`);
    } else {
      console.log('❌ NO PERMIT FOUND');
    }
    
    // 2. Check content_generation_metadata_comprehensive
    const { data: contentMeta } = await supabase
      .from('content_generation_metadata_comprehensive')
      .select('*')
      .eq('tweet_id', tweetId)
      .single();
    
    if (contentMeta) {
      lineage.decision_id = contentMeta.decision_id || lineage.decision_id;
      lineage.pipeline_source = contentMeta.pipeline_source;
      lineage.git_sha = contentMeta.build_sha;
      lineage.run_id = contentMeta.job_run_id;
      console.log(`✅ CONTENT METADATA FOUND`);
      console.log(`   Decision ID: ${contentMeta.decision_id}`);
      console.log(`   Pipeline Source: ${contentMeta.pipeline_source}`);
      console.log(`   Git SHA: ${contentMeta.build_sha}`);
      console.log(`   Job Run ID: ${contentMeta.job_run_id}`);
      console.log(`   Target Tweet ID: ${contentMeta.target_tweet_id}`);
      console.log(`   Root Tweet ID: ${contentMeta.root_tweet_id}`);
    } else {
      console.log('❌ NO CONTENT METADATA FOUND');
    }
    
    // 3. Check ghost_tweets
    const { data: ghost } = await supabase
      .from('ghost_tweets')
      .select('*')
      .eq('tweet_id', tweetId)
      .single();
    
    if (ghost) {
      console.log(`⚠️  GHOST TWEET RECORD FOUND`);
      console.log(`   Detected: ${ghost.detected_at}`);
      console.log(`   Status: ${ghost.status}`);
    }
    
    // 4. Check system_events for decision_id/permit_id
    if (lineage.decision_id) {
      const { data: decisionEvents } = await supabase
        .from('system_events')
        .select('*')
        .eq('event_data->>decision_id', lineage.decision_id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (decisionEvents && decisionEvents.length > 0) {
        console.log(`\n📊 SYSTEM EVENTS (decision_id: ${lineage.decision_id}):`);
        decisionEvents.forEach(e => {
          console.log(`   ${e.created_at}: ${e.event_type} - ${e.message}`);
        });
      }
    }
    
    if (lineage.permit_id) {
      const { data: permitEvents } = await supabase
        .from('system_events')
        .select('*')
        .eq('event_data->>permit_id', lineage.permit_id)
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (permitEvents && permitEvents.length > 0) {
        console.log(`\n📊 SYSTEM EVENTS (permit_id: ${lineage.permit_id}):`);
        permitEvents.forEach(e => {
          console.log(`   ${e.created_at}: ${e.event_type} - ${e.message}`);
        });
      }
    }
    
    // 5. Check target tweet to see if it's a root
    if (lineage.target_tweet_id) {
      const { data: targetMeta } = await supabase
        .from('content_generation_metadata_comprehensive')
        .select('tweet_id, root_tweet_id, in_reply_to_status_id')
        .eq('tweet_id', lineage.target_tweet_id)
        .single();
      
      if (targetMeta) {
        lineage.target_is_root = !targetMeta.in_reply_to_status_id && targetMeta.tweet_id === targetMeta.root_tweet_id;
        console.log(`\n🎯 TARGET TWEET ANALYSIS:`);
        console.log(`   Target Tweet ID: ${lineage.target_tweet_id}`);
        console.log(`   Root Tweet ID: ${targetMeta.root_tweet_id}`);
        console.log(`   In Reply To: ${targetMeta.in_reply_to_status_id || 'NONE'}`);
        console.log(`   Is Root: ${lineage.target_is_root ? '✅ YES' : '❌ NO (THIS IS THE PROBLEM)'}`);
      } else {
        // Try to get from reply_slo_events or candidate_evaluations
        const { data: sloEvent } = await supabase
          .from('reply_slo_events')
          .select('*')
          .eq('candidate_tweet_id', lineage.target_tweet_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        
        if (sloEvent) {
          console.log(`\n🎯 TARGET FROM SLO EVENT:`);
          console.log(`   Candidate Tweet ID: ${sloEvent.candidate_tweet_id}`);
          console.log(`   Posted: ${sloEvent.posted}`);
        }
      }
    }
    
    // 6. Determine job origin
    if (lineage.pipeline_source) {
      if (lineage.pipeline_source.includes('reply_v2') || lineage.pipeline_source.includes('scheduler')) {
        lineage.job_origin = 'reply_v2_scheduler';
      } else if (lineage.pipeline_source.includes('replyJob') || lineage.pipeline_source.includes('reply_posting')) {
        lineage.job_origin = 'old_replyJob';
      } else {
        lineage.job_origin = lineage.pipeline_source;
      }
    }
    
    console.log(`\n📋 LINEAGE SUMMARY:`);
    console.log(JSON.stringify(lineage, null, 2));
  }
  
  process.exit(0);
}

traceIncident().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});


#!/usr/bin/env tsx
/**
 * Probe script to force a fallback reply generation
 * This intentionally triggers fallback mode by simulating an ungrounded generation skip
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function probeSchedulerRun() {
  const supabase = getSupabaseClient();
  
  // Check for --cert flag
  const certMode = process.argv.includes('--cert') || process.env.CERT_MODE === 'true';
  
  console.log('========================================');
  console.log(`PROBE SCHEDULER RUN${certMode ? ' (CERT MODE)' : ''}`);
  console.log('========================================\n');
  
  // Set CERT_MODE globally if flag is passed
  if (certMode) {
    (global as any).CERT_MODE = true;
    process.env.CERT_MODE = 'true';
    console.log('[PROBE] 🔒 CERT_MODE enabled - certified reply generation will be used\n');
  }
  
  // Import scheduler function
  const { attemptScheduledReply } = await import('../src/jobs/replySystemV2/tieredScheduler');
  
  try {
    console.log('[PROBE] Running scheduler...');
    const result = await attemptScheduledReply();
    
    console.log('\n=== SCHEDULER RESULT ===');
    console.log(JSON.stringify(result, null, 2));
    
    // Wait a moment for DB updates to propagate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check for latest decision
    const { data: latestDecision } = await supabase
      .from('content_metadata')
      .select('decision_id, status, features, pipeline_source, content')
      .eq('decision_type', 'reply')
      .eq('pipeline_source', 'reply_v2_scheduler')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (latestDecision) {
      console.log('\n=== LATEST DECISION ===');
      console.log('Decision ID:', latestDecision.decision_id);
      console.log('Status:', latestDecision.status);
      console.log('Features:', JSON.stringify(latestDecision.features, null, 2));
      console.log('Content length:', latestDecision.content?.length || 0);
      
      // Check for persistence event
      const { data: persistEvent } = await supabase
        .from('system_events')
        .select('event_type, event_data, created_at')
        .eq('event_type', 'reply_v2_decision_queued_persisted')
        .eq('event_data->>decision_id', latestDecision.decision_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (persistEvent) {
        console.log('\n=== PERSISTENCE EVENT ===');
        console.log(JSON.stringify(persistEvent, null, 2));
      } else {
        console.log('\n⚠️ No persistence event found');
      }
    } else {
      console.log('\n⚠️ No decision found');
    }
    
    console.log('\n========================================');
    console.log('✅ PROBE COMPLETE');
    console.log('========================================');
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n=== PROBE ERROR ===');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

probeSchedulerRun();

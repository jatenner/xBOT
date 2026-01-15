#!/usr/bin/env tsx
/**
 * Query gate statistics from database
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function main() {
  const supabase = getSupabaseClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  console.log('GATE BLOCKS (Last 24h):\n');
  
  // NON_ROOT from system_events
  const { count: nonRoot } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', oneDayAgo);
  
  const { data: nonRootEvents } = await supabase
    .from('system_events')
    .select('event_data')
    .eq('event_type', 'POST_FAILED')
    .gte('created_at', oneDayAgo);
  
  let nonRootCount = 0;
  if (nonRootEvents) {
    for (const event of nonRootEvents) {
      const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
      if (eventData.deny_reason_code === 'NON_ROOT' || eventData.pipeline_error_reason?.includes('NON_ROOT')) {
        nonRootCount++;
      }
    }
  }
  
  // THREAD_REPLY_FORBIDDEN
  let threadCount = 0;
  if (nonRootEvents) {
    for (const event of nonRootEvents) {
      const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
      if (eventData.pipeline_error_reason?.includes('THREAD_REPLY')) {
        threadCount++;
      }
    }
  }
  
  // Quality filters from reply_decisions
  const { count: lowSignal } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'LOW_SIGNAL_TARGET')
    .gte('created_at', oneDayAgo);
  
  const { count: emoji } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'EMOJI_SPAM_TARGET')
    .gte('created_at', oneDayAgo);
  
  const { count: parody } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'PARODY_OR_BOT_SIGNAL')
    .gte('created_at', oneDayAgo);
  
  const { count: nonHealth } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .eq('deny_reason_code', 'NON_HEALTH_TOPIC')
    .gte('created_at', oneDayAgo);
  
  const { count: ungrounded } = await supabase
    .from('reply_decisions')
    .select('*', { count: 'exact', head: true })
    .like('pipeline_error_reason', '%UNGROUNDED_REPLY%')
    .gte('created_at', oneDayAgo);
  
  const { count: success } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'POST_SUCCESS')
    .gte('created_at', oneDayAgo);
  
  console.log(`  NON_ROOT: ${nonRootCount}`);
  console.log(`  THREAD_REPLY_FORBIDDEN: ${threadCount}`);
  console.log(`  LOW_SIGNAL_TARGET: ${lowSignal || 0}`);
  console.log(`  EMOJI_SPAM_TARGET: ${emoji || 0}`);
  console.log(`  PARODY_OR_BOT_SIGNAL: ${parody || 0}`);
  console.log(`  NON_HEALTH_TOPIC: ${nonHealth || 0}`);
  console.log(`  UNGROUNDED_REPLY: ${ungrounded || 0}`);
  console.log(`  POST_SUCCESS: ${success || 0}\n`);
}

main().catch(console.error);

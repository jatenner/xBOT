import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  console.log('=== EXECUTOR DAEMON TICK ACTIVITY (Last 15 minutes) ===\n');
  
  // Count ticks
  const { count: tickCount } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .eq('event_type', 'EXECUTOR_DAEMON_TICK')
    .gte('created_at', fifteenMinutesAgo);
  
  console.log(`Total EXECUTOR_DAEMON_TICK events: ${tickCount || 0}\n`);
  
  // Last 5 ticks
  const { data: lastTicks } = await supabase
    .from('system_events')
    .select('id, created_at, event_data')
    .eq('event_type', 'EXECUTOR_DAEMON_TICK')
    .gte('created_at', fifteenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (lastTicks && lastTicks.length > 0) {
    console.log('Last 5 EXECUTOR_DAEMON_TICK events:');
    for (const tick of lastTicks) {
      const eventData = typeof tick.event_data === 'string' ? JSON.parse(tick.event_data) : tick.event_data;
      console.log(`  ${tick.created_at}: pages=${eventData.pages || 'N/A'} posting_ready=${eventData.posting_ready || 'N/A'} posting_attempts=${eventData.posting_attempts || 'N/A'} reply_ready=${eventData.reply_ready || 'N/A'} reply_attempts=${eventData.reply_attempts || 'N/A'}`);
    }
  } else {
    console.log('  No ticks found in last 15 minutes');
  }
  
  console.log('\n=== LAST 20 EXECUTOR_* EVENTS (Last 15 minutes) ===\n');
  
  const { data: executorEvents } = await supabase
    .from('system_events')
    .select('event_type, created_at, event_data')
    .like('event_type', 'EXECUTOR_%')
    .gte('created_at', fifteenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (executorEvents && executorEvents.length > 0) {
    for (const event of executorEvents) {
      const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
      console.log(`  ${event.created_at} [${event.event_type}]: ${JSON.stringify(eventData).substring(0, 100)}`);
    }
  } else {
    console.log('  No EXECUTOR_* events found in last 15 minutes');
  }
  
  console.log('\n=== PROOF DECISION SELECTION EVENTS (Last 30 minutes) ===\n');
  
  const { data: proofSelections } = await supabase
    .from('system_events')
    .select('id, created_at, event_data')
    .eq('event_type', 'EXECUTOR_PROOF_DECISION_SELECTED')
    .gte('created_at', thirtyMinutesAgo)
    .order('created_at', { ascending: false });
  
  if (proofSelections && proofSelections.length > 0) {
    console.log(`Found ${proofSelections.length} proof selection event(s):`);
    for (const event of proofSelections) {
      const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
      console.log(`  ${event.created_at}: decision_id=${eventData.decision_id} proof_tag=${eventData.proof_tag || 'N/A'}`);
    }
  } else {
    console.log('  No proof selection events found in last 30 minutes');
  }
}

main().catch(console.error);

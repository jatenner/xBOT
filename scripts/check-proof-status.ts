import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();

  // Check latest proof decision
  const { data: decisions } = await supabase
    .from('content_metadata')
    .select('decision_id, status, error_message, features, created_at')
    .like('features->>proof_tag', 'control-post-%')
    .order('created_at', { ascending: false })
    .limit(3);

  console.log('Latest Proof Decisions:');
  console.log(JSON.stringify(decisions, null, 2));

  // Check for POST_FAILED events
  const { data: failedEvents } = await supabase
    .from('system_events')
    .select('event_type, event_data, created_at')
    .eq('event_type', 'POST_FAILED')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nLatest POST_FAILED Events:');
  for (const event of failedEvents || []) {
    const eventData = typeof event.event_data === 'string' ? JSON.parse(event.event_data) : event.event_data;
    console.log(`- ${event.created_at}: decision_id=${eventData.decision_id}, error_code=${eventData.error_code || 'N/A'}, is_timeout=${eventData.is_timeout || false}`);
  }

  // Check for outcomes
  const { data: outcomes } = await supabase
    .from('outcomes')
    .select('decision_id, tweet_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  console.log('\nLatest Outcomes:');
  console.log(JSON.stringify(outcomes, null, 2));
}

main().catch(console.error);

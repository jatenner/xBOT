import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const decisionId = process.argv[2] || 'e808fa1d-ad9a-47d0-a697-d54fbdf2d53f';

  // Check outcomes
  const { data: outcomes } = await supabase.from('outcomes').select('*').eq('decision_id', decisionId);
  console.log('Outcomes:', JSON.stringify(outcomes, null, 2));

  // Check posting_attempts
  const { data: attempts } = await supabase.from('posting_attempts').select('*').eq('decision_id', decisionId);
  console.log('\nPosting Attempts:', JSON.stringify(attempts, null, 2));

  // Check POST_SUCCESS event
  const { data: events } = await supabase.from('system_events').select('event_type, event_data').eq('event_data->>decision_id', decisionId).in('event_type', ['POST_SUCCESS', 'POST_FAILED']);
  console.log('\nEvents:', JSON.stringify(events, null, 2));
  
  // Check content_metadata
  const { data: metadata } = await supabase.from('content_metadata').select('decision_id, status, tweet_id, error_message').eq('decision_id', decisionId);
  console.log('\nContent Metadata:', JSON.stringify(metadata, null, 2));
}

main().catch(console.error);

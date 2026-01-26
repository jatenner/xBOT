import 'dotenv/config';
import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const proofTag = 'control-reply-1769440472369';
  const decisionId = 'aa05774f-e0fd-494c-8ea1-48e91b8df55a';
  
  console.log('Decision ID:', decisionId);
  console.log('Proof Tag:', proofTag);
  console.log('');
  
  const events = [
    'REPLY_SUCCESS',
    'REPLY_FAILED',
    'EXECUTOR_DECISION_CLAIM_ATTEMPT',
    'EXECUTOR_DECISION_CLAIM_OK',
    'EXECUTOR_DECISION_CLAIM_FAIL',
    'POST_ATTEMPT',
    'REPLY_ATTEMPT'
  ];
  
  for (const eventType of events) {
    const { data, count } = await supabase
      .from('system_events')
      .select('id, created_at, event_data')
      .eq('event_type', eventType)
      .or(`event_data->>decision_id.eq.${decisionId},event_data->>proof_tag.eq.${proofTag}`)
      .order('created_at', { ascending: false })
      .limit(5);
    
    console.log(`${eventType}: count=${count || 0}`);
    if (data && data.length > 0) {
      console.log(`  Latest ID: ${data[0].id}`);
      console.log(`  Latest at: ${data[0].created_at}`);
      if (eventType === 'REPLY_SUCCESS' || eventType === 'REPLY_FAILED') {
        const ed = typeof data[0].event_data === 'string' ? JSON.parse(data[0].event_data) : data[0].event_data;
        console.log(`  Error code: ${ed.error_code || 'N/A'}`);
        console.log(`  Reply tweet ID: ${ed.reply_tweet_id || ed.tweet_id || 'N/A'}`);
        if (ed.reply_tweet_id || ed.tweet_id) {
          console.log(`  Reply URL: https://x.com/Signal_Synapse/status/${ed.reply_tweet_id || ed.tweet_id}`);
        }
      }
    }
    console.log('');
  }
  
  // Check the specific event ID from the report
  const { data: specificEvent } = await supabase
    .from('system_events')
    .select('event_type, created_at, event_data')
    .eq('id', '39b6ce05-bc91-4f0c-af51-c106ddd05a32')
    .maybeSingle();
  
  if (specificEvent) {
    console.log('Event 39b6ce05-bc91-4f0c-af51-c106ddd05a32:');
    console.log(`  Type: ${specificEvent.event_type}`);
    console.log(`  Created: ${specificEvent.created_at}`);
    const ed = typeof specificEvent.event_data === 'string' ? JSON.parse(specificEvent.event_data) : specificEvent.event_data;
    console.log(`  Data: ${JSON.stringify(ed, null, 2)}`);
  }
  
  // Check decision status and tweet_id
  const { data: decision } = await supabase
    .from('content_metadata')
    .select('status, tweet_id, url')
    .eq('decision_id', decisionId)
    .maybeSingle();
  
  if (decision) {
    console.log('\nDecision Status:');
    console.log(`  Status: ${decision.status}`);
    console.log(`  Tweet ID: ${decision.tweet_id || 'N/A'}`);
    console.log(`  URL: ${decision.url || 'N/A'}`);
  }
}

main().catch(console.error);

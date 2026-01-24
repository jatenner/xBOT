import 'dotenv/config';
import { getSupabaseClient } from './src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const proofTag = 'control-post-1769274292283';
  const decisionId = 'ff2b4897-8b80-484b-94c0-5cd0e2b1cb83';
  
  const { data } = await supabase
    .from('content_metadata')
    .select('decision_id, status, features, error_message, tweet_id, url')
    .eq('decision_id', decisionId)
    .limit(1);
  
  console.log('Decision:', JSON.stringify(data, null, 2));
  
  // Check for POST_SUCCESS/POST_FAILED events
  const { data: events } = await supabase
    .from('system_events')
    .select('event_id, event_type, event_data, created_at')
    .or(`event_type.eq.POST_SUCCESS,event_type.eq.POST_FAILED`)
    .like('event_data->>decision_id', `%${decisionId}%`)
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('\nEvents:', JSON.stringify(events, null, 2));
}

main().catch(console.error);

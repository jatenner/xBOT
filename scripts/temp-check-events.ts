import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('system_events')
    .select('id, event_type, created_at, event_data')
    .eq('event_data->>decision_id', '8cdbf84c-2088-4b14-a3da-0896e6d999ba')
    .in('event_type', ['REPLY_FAILED', 'REPLY_SUCCESS', 'POST_FAILED', 'EXECUTOR_DECISION_CLAIM_OK'])
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(JSON.stringify(data, null, 2));
}

main().catch(console.error);

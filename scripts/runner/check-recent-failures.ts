#!/usr/bin/env tsx
import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';

async function main() {
  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from('system_events')
    .select('created_at, message, event_data')
    .eq('event_type', 'POST_FAILED')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log('\n📊 Recent POST_FAILED events:\n');
  data?.forEach((e, i) => {
    const ed = typeof e.event_data === 'string' ? JSON.parse(e.event_data) : e.event_data || {};
    console.log(`${i + 1}. ${e.created_at}`);
    console.log(`   Reason: ${ed.deny_reason_code || ed.reason || e.message || 'unknown'}`);
    if (ed.decision_id) console.log(`   Decision ID: ${ed.decision_id}`);
    console.log('');
  });
}

main().catch(console.error);

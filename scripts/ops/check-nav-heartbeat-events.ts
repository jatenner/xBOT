#!/usr/bin/env tsx
/** Print last 10 nav_heartbeat rows from system_events (no secrets) */
import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main(): Promise<void> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('system_events')
    .select('id, event_type, severity, message, event_data, created_at')
    .eq('event_type', 'nav_heartbeat')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }

  console.log(`nav_heartbeat rows (last 10): ${data?.length ?? 0}`);
  for (const row of data || []) {
    const ed = (row.event_data as Record<string, unknown>) || {};
    console.log(`  id=${row.id} created_at=${row.created_at} success=${ed.success} reason=${ed.reason ?? 'n/a'} duration_ms=${ed.duration_ms ?? 'n/a'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

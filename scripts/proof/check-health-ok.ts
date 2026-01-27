#!/usr/bin/env tsx
import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { data, error } = await supabase
    .from('system_events')
    .select('id, created_at')
    .eq('event_type', 'EXECUTOR_HEALTH_OK')
    .gte('created_at', fifteenMinutesAgo)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
  
  console.log(`HEALTH_OK events in last 15 min: ${data?.length || 0}`);
  if (data && data.length > 0) {
    console.log(`Latest: ${data[0].id} at ${data[0].created_at}`);
  }
}

main().catch(console.error);

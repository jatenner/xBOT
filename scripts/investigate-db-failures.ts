/**
 * Investigate posting_db_update_fail_60m failures
 */

import { getSupabaseClient } from '../src/db/index';
import { getConfig } from '../src/config/config';

async function investigate() {
  getConfig();
  const supabase = getSupabaseClient();

  console.log('🔍 PHASE 1: Investigating DB update failures\n');

  // Check system_events for atomic_post_update_failed
  const { data: events } = await supabase
    .from('system_events')
    .select('event_type, severity, message, event_data, created_at')
    .eq('event_type', 'atomic_post_update_failed')
    .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  console.log(`Found ${events?.length || 0} atomic_post_update_failed events in last 60m:\n`);
  events?.forEach((e, i) => {
    console.log(`${i+1}. ${e.created_at}`);
    console.log(`   Message: ${e.message}`);
    console.log(`   Event data: ${JSON.stringify(e.event_data)}\n`);
  });

  // Check for failed/posting_attempt rows
  const { data: failedRows } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, tweet_id, pipeline_source, build_sha, job_run_id, created_at, posted_at')
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
    .in('status', ['failed', 'posting_attempt']);

  console.log(`\nFound ${failedRows?.length || 0} failed/posting_attempt rows in last 2h:\n`);
  failedRows?.forEach((r, i) => {
    console.log(`${i+1}. decision_id=${r.decision_id.substring(0, 12)}...`);
    console.log(`   type=${r.decision_type} status=${r.status} tweet_id=${r.tweet_id || 'NULL'}`);
    console.log(`   pipeline=${r.pipeline_source} created=${r.created_at}\n`);
  });

  // Check for posted rows with NULL tweet_id
  const { data: postedNull } = await supabase
    .from('content_generation_metadata_comprehensive')
    .select('decision_id, decision_type, status, tweet_id, pipeline_source, created_at, posted_at')
    .eq('status', 'posted')
    .is('tweet_id', null)
    .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

  console.log(`\nFound ${postedNull?.length || 0} posted rows with NULL tweet_id in last 2h:\n`);
  postedNull?.forEach((r, i) => {
    console.log(`${i+1}. decision_id=${r.decision_id.substring(0, 12)}...`);
    console.log(`   type=${r.decision_type} status=${r.status} tweet_id=NULL`);
    console.log(`   pipeline=${r.pipeline_source} created=${r.created_at}\n`);
  });
}

investigate().catch(console.error);


/**
 * 🔍 QUEUE BOTTLENECK DIAGNOSTIC
 * 
 * Investigates why Hard Pass → Queued conversion is only 3.8%
 */

import { getSupabaseClient } from '../src/db/index';

async function main() {
  const supabase = getSupabaseClient();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  console.log('=== STEP 2: Queue Refresh Job Evidence ===\n');

  // A) Count queue refresh events
  const { count: refreshStarted6h } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .ilike('event_type', '%queue_refresh%started%')
    .gte('created_at', sixHoursAgo);

  const { count: refreshCompleted6h } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .ilike('event_type', '%queue_refresh%completed%')
    .gte('created_at', sixHoursAgo);

  const { count: refreshStarted1h } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .ilike('event_type', '%queue_refresh%started%')
    .gte('created_at', oneHourAgo);

  const { count: refreshCompleted1h } = await supabase
    .from('system_events')
    .select('*', { count: 'exact', head: true })
    .ilike('event_type', '%queue_refresh%completed%')
    .gte('created_at', oneHourAgo);

  console.log(`A) Queue Refresh Events:`);
  console.log(`   Last 6h: started=${refreshStarted6h || 0}, completed=${refreshCompleted6h || 0}`);
  console.log(`   Last 1h: started=${refreshStarted1h || 0}, completed=${refreshCompleted1h || 0}\n`);

  // B) Failed events
  const { data: failedEvents } = await supabase
    .from('system_events')
    .select('*')
    .ilike('event_type', '%queue_refresh%failed%')
    .gte('created_at', sixHoursAgo)
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`B) Failed Events: ${failedEvents?.length || 0}`);
  if (failedEvents && failedEvents.length > 0) {
    failedEvents.forEach((e: any) => {
      console.log(`   ${e.created_at}: ${e.event_type}`);
      if (e.metadata?.error) {
        console.log(`      Error: ${JSON.stringify(e.metadata.error)}`);
      }
    });
  }
  console.log('');

  // C) Most recent completion
  const { data: lastCompletion } = await supabase
    .from('system_events')
    .select('created_at, metadata')
    .ilike('event_type', '%queue_refresh%completed%')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  console.log(`C) Most Recent Completion: ${lastCompletion?.created_at || 'NONE'}\n`);

  console.log('=== STEP 3: Reconcile Counts (Last 6h) ===\n');

  // Candidate evaluations
  const { count: evaluationsCreated } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sixHoursAgo);

  const { count: passedHardFilters } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('passed_hard_filters', true)
    .gte('created_at', sixHoursAgo);

  // Queue inserts
  const { count: queueInserts } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', sixHoursAgo);

  // Currently queued
  const { count: currentlyQueued } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'queued')
    .gt('expires_at', new Date().toISOString());

  // Expired
  const { count: expired } = await supabase
    .from('reply_candidate_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'expired')
    .gte('created_at', sixHoursAgo);

  // Status breakdown
  const { data: statusBreakdown } = await supabase
    .from('reply_candidate_queue')
    .select('status')
    .gte('created_at', sixHoursAgo);

  const statusCounts: Record<string, number> = {};
  statusBreakdown?.forEach((r: any) => {
    statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
  });

  console.log('| Metric | Count |');
  console.log('|--------|-------|');
  console.log(`| candidate_evaluations created | ${evaluationsCreated || 0} |`);
  console.log(`| passed_hard_filters=true | ${passedHardFilters || 0} |`);
  console.log(`| reply_candidate_queue inserts | ${queueInserts || 0} |`);
  console.log(`| currently queued (not expired) | ${currentlyQueued || 0} |`);
  console.log(`| expired | ${expired || 0} |`);
  console.log(`| Status breakdown: | |`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`|   - ${status} | ${count} |`);
  });
  console.log('');

  // Tier breakdown for hard pass candidates
  const { data: tierBreakdown } = await supabase
    .from('candidate_evaluations')
    .select('predicted_tier')
    .eq('passed_hard_filters', true)
    .gte('created_at', sixHoursAgo);

  const tierCounts: Record<number, number> = {};
  tierBreakdown?.forEach((r: any) => {
    const tier = r.predicted_tier || 4;
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  });

  console.log('=== Tier Breakdown (Hard Pass Candidates) ===\n');
  console.log('| Tier | Count |');
  console.log('|------|-------|');
  Object.entries(tierCounts).sort(([a], [b]) => parseInt(a) - parseInt(b)).forEach(([tier, count]) => {
    console.log(`| ${tier} | ${count} |`);
  });
  console.log('');

  // Check if queue refresh query matches candidates
  const { count: candidatesMatchingQuery } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'evaluated')
    .eq('passed_hard_filters', true)
    .gte('predicted_tier', 2) // Current query
    .gte('created_at', sixHoursAgo);

  const { count: candidatesWithTier1 } = await supabase
    .from('candidate_evaluations')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'evaluated')
    .eq('passed_hard_filters', true)
    .eq('predicted_tier', 1)
    .gte('created_at', sixHoursAgo);

  console.log('=== Queue Refresh Query Analysis ===\n');
  console.log(`Current query: .gte('predicted_tier', 2)`);
  console.log(`Candidates matching current query: ${candidatesMatchingQuery || 0}`);
  console.log(`Tier 1 candidates excluded: ${candidatesWithTier1 || 0}`);
  console.log(`Expected if query fixed (.lte('predicted_tier', 3)): ${(passedHardFilters || 0) - (candidatesMatchingQuery || 0) + (candidatesWithTier1 || 0)}`);
  console.log('');

  // Check for insertion errors
  const { data: recentQueueInserts } = await supabase
    .from('reply_candidate_queue')
    .select('*')
    .gte('created_at', sixHoursAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  console.log('=== Recent Queue Inserts (Last 20) ===\n');
  if (recentQueueInserts && recentQueueInserts.length > 0) {
    console.log(`Found ${recentQueueInserts.length} inserts`);
    recentQueueInserts.forEach((q: any) => {
      console.log(`  ${q.created_at}: ${q.candidate_tweet_id} (tier ${q.predicted_tier}, status ${q.status})`);
    });
  } else {
    console.log('NO QUEUE INSERTS IN LAST 6H');
  }
  console.log('');

  // Check expires_at distribution
  const { data: expiresAtData } = await supabase
    .from('reply_candidate_queue')
    .select('expires_at, created_at')
    .gte('created_at', sixHoursAgo)
    .limit(100);

  if (expiresAtData && expiresAtData.length > 0) {
    const now = Date.now();
    const expiredCount = expiresAtData.filter((r: any) => {
      const expiresAt = new Date(r.expires_at).getTime();
      return expiresAt < now;
    }).length;

    console.log('=== Expires_at Analysis ===\n');
    console.log(`Total queue entries: ${expiresAtData.length}`);
    console.log(`Already expired: ${expiredCount}`);
    console.log(`Still valid: ${expiresAtData.length - expiredCount}`);
  }

  process.exit(0);
}

main().catch(console.error);

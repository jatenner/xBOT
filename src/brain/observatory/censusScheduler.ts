/**
 * Census Scheduler
 *
 * DB-only job that runs every 5 minutes. Picks accounts due for a census
 * check and marks them in the DB for the census worker to process.
 *
 * Uses a DB-backed queue (census_queued_at column) instead of in-memory array.
 * This means the queue survives process restarts.
 *
 * Census frequency depends on growth_status and follower_range:
 *   explosive: every 6h
 *   hot: every 12h
 *   interesting: every 24h
 *   boring nano/micro: every 336h (2 weeks) — tiny accounts rarely change
 *   boring small/mid: every 168h (weekly)
 *   boring large+: every 336h (2 weeks) — large accounts grow slowly in %
 *   unknown: every 48h (needs baseline, but not as urgent at scale)
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/census-scheduler]';
const MAX_BATCH_SIZE = 1000; // Increased from 200 for scale

// Legacy in-memory queue — kept for backward compatibility with existing worker
// The worker checks BOTH this and the DB queue during the transition
export const censusQueue: string[] = [];

export async function runCensusScheduler(): Promise<{ queued: number }> {
  const supabase = getSupabaseClient();

  // Find accounts where next_census_at <= NOW() and not already queued
  let dueAccounts: any[] | null = null;
  let queryError: any = null;

  // Try with follower_range first, fall back without it if schema cache is stale
  const { data: d1, error: e1 } = await supabase
    .from('brain_accounts')
    .select('username, growth_status, census_frequency_hours, follower_range')
    .eq('is_active', true)
    .lte('next_census_at', new Date().toISOString())
    .is('census_queued_at', null)
    .order('next_census_at', { ascending: true })
    .limit(MAX_BATCH_SIZE);

  if (e1 && e1.message?.includes('schema cache')) {
    // Schema cache stale — retry without new columns
    const { data: d2, error: e2 } = await supabase
      .from('brain_accounts')
      .select('username, growth_status, census_frequency_hours')
      .eq('is_active', true)
      .lte('next_census_at', new Date().toISOString())
      .order('next_census_at', { ascending: true })
      .limit(MAX_BATCH_SIZE);
    dueAccounts = d2;
    queryError = e2;
  } else {
    dueAccounts = d1;
    queryError = e1;
  }

  if (queryError) {
    console.error(`${LOG_PREFIX} Query error: ${queryError.message}`);
    return { queued: 0 };
  }

  if (!dueAccounts || dueAccounts.length === 0) {
    return { queued: 0 };
  }

  const now = new Date().toISOString();
  let queued = 0;

  // Mark accounts as queued in DB and schedule next census
  for (const account of dueAccounts) {
    const freqHours = getCensusFrequency(account.growth_status, account.follower_range);
    const nextCensus = new Date(Date.now() + freqHours * 60 * 60 * 1000).toISOString();

    await supabase
      .from('brain_accounts')
      .update({
        census_queued_at: now,
        next_census_at: nextCensus,
        census_frequency_hours: freqHours,
      })
      .eq('username', account.username);

    // Also add to legacy in-memory queue for backward compat
    censusQueue.push(account.username);
    queued++;
  }

  if (queued > 0) {
    console.log(`${LOG_PREFIX} Queued ${queued} accounts for census`);
  }

  return { queued };
}

/**
 * Get accounts from the DB-backed queue (for the parallel census worker).
 * Returns usernames and their growth status for lightweight vs full census decision.
 */
export async function getQueuedAccounts(limit: number = 100): Promise<Array<{
  username: string;
  growth_status: string | null;
  follower_range: string | null;
}>> {
  const supabase = getSupabaseClient();

  const { data } = await supabase
    .from('brain_accounts')
    .select('username, growth_status, follower_range')
    .not('census_queued_at', 'is', null)
    .eq('is_active', true)
    .order('census_queued_at', { ascending: true })
    .limit(limit);

  return data ?? [];
}

/**
 * Clear the queue flag for processed accounts.
 */
export async function clearQueuedAccount(username: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('brain_accounts')
    .update({ census_queued_at: null })
    .eq('username', username);
}

function getCensusFrequency(growthStatus: string | null, followerRange: string | null): number {
  switch (growthStatus) {
    case 'explosive': return 6;
    case 'hot': return 12;
    case 'interesting': return 24;
    case 'boring': {
      // Scale-aware: tiny and huge accounts get checked less often
      if (followerRange === 'nano' || followerRange === 'micro') return 336; // 2 weeks
      if (followerRange === 'large' || followerRange === 'mega' || followerRange === 'celebrity') return 336;
      return 168; // weekly for small/mid
    }
    case 'unknown':
    default: return 48; // 2 days for unknowns (need 2nd snapshot for growth detection)
  }
}

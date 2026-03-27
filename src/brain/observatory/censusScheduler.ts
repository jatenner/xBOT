/**
 * Census Scheduler
 *
 * DB-only job that runs every 5 minutes. Picks accounts due for a census
 * check and queues them for the census worker.
 *
 * Census frequency depends on growth_status:
 *   explosive: every 6h
 *   hot: every 12h
 *   interesting: every 24h
 *   boring: every 168h (weekly)
 *   unknown: every 72h (new accounts, checking for first time)
 */

import { getSupabaseClient } from '../../db';

const LOG_PREFIX = '[observatory/census-scheduler]';
const MAX_BATCH_SIZE = 50; // Max accounts to queue per cycle

// In-memory queue that the census worker reads from
export const censusQueue: string[] = [];

export async function runCensusScheduler(): Promise<{ queued: number }> {
  const supabase = getSupabaseClient();

  // Find accounts where next_census_at <= NOW()
  const { data: dueAccounts, error } = await supabase
    .from('brain_accounts')
    .select('username, growth_status, census_frequency_hours')
    .eq('is_active', true)
    .lte('next_census_at', new Date().toISOString())
    .order('next_census_at', { ascending: true })
    .limit(MAX_BATCH_SIZE);

  if (error) {
    console.error(`${LOG_PREFIX} Query error: ${error.message}`);
    return { queued: 0 };
  }

  if (!dueAccounts || dueAccounts.length === 0) {
    return { queued: 0 };
  }

  // Add to queue (dedup against existing queue)
  const existing = new Set(censusQueue);
  let added = 0;

  for (const account of dueAccounts) {
    if (!existing.has(account.username)) {
      censusQueue.push(account.username);
      added++;
    }

    // Schedule next census
    const freqHours = getCensusFrequency(account.growth_status);
    const nextCensus = new Date(Date.now() + freqHours * 60 * 60 * 1000).toISOString();

    await supabase
      .from('brain_accounts')
      .update({ next_census_at: nextCensus, census_frequency_hours: freqHours })
      .eq('username', account.username);
  }

  if (added > 0) {
    console.log(`${LOG_PREFIX} Queued ${added} accounts for census (total queue: ${censusQueue.length})`);
  }

  return { queued: added };
}

function getCensusFrequency(growthStatus: string | null): number {
  switch (growthStatus) {
    case 'explosive': return 6;
    case 'hot': return 12;
    case 'interesting': return 24;
    case 'boring': return 168; // weekly
    case 'unknown':
    default: return 72; // 3 days for new accounts
  }
}

/**
 * Follower Range Backfill
 *
 * One-time (safe to re-run) job that backfills follower_range on:
 * 1. brain_accounts — from followers_count
 * 2. brain_accounts.follower_range_at_first_snapshot — from earliest snapshot
 * 3. brain_growth_events — follower_range_at_detection, before, after
 * 4. brain_retrospective_analyses — follower_range_at_growth
 */

import { getSupabaseClient } from '../../db';
import { getFollowerRange } from '../types';

const LOG_PREFIX = '[observatory/range-backfill]';

export async function runFollowerRangeBackfill(): Promise<{
  accounts_updated: number;
  events_updated: number;
  retros_updated: number;
}> {
  const supabase = getSupabaseClient();
  let accountsUpdated = 0;
  let eventsUpdated = 0;
  let retrosUpdated = 0;

  // 1. Backfill brain_accounts.follower_range
  const { data: accounts } = await supabase
    .from('brain_accounts')
    .select('username, followers_count')
    .is('follower_range', null)
    .not('followers_count', 'is', null)
    .limit(5000);

  if (accounts && accounts.length > 0) {
    for (const acct of accounts) {
      const range = getFollowerRange(acct.followers_count);
      await supabase
        .from('brain_accounts')
        .update({ follower_range: range })
        .eq('username', acct.username);
      accountsUpdated++;
    }
    console.log(`${LOG_PREFIX} Backfilled follower_range on ${accountsUpdated} accounts`);
  }

  // 2. Backfill brain_accounts.follower_range_at_first_snapshot
  const { data: noFirstRange } = await supabase
    .from('brain_accounts')
    .select('username')
    .is('follower_range_at_first_snapshot', null)
    .not('first_snapshot_at', 'is', null)
    .limit(5000);

  if (noFirstRange && noFirstRange.length > 0) {
    let firstRangeCount = 0;
    for (const acct of noFirstRange) {
      // Get the earliest snapshot for this account
      const { data: earliest } = await supabase
        .from('brain_account_snapshots')
        .select('followers_count')
        .eq('username', acct.username)
        .order('checked_at', { ascending: true })
        .limit(1)
        .single();

      if (earliest && earliest.followers_count != null) {
        await supabase
          .from('brain_accounts')
          .update({ follower_range_at_first_snapshot: getFollowerRange(earliest.followers_count) })
          .eq('username', acct.username);
        firstRangeCount++;
      }
    }
    console.log(`${LOG_PREFIX} Backfilled follower_range_at_first_snapshot on ${firstRangeCount} accounts`);
  }

  // 3. Backfill brain_growth_events
  const { data: events } = await supabase
    .from('brain_growth_events')
    .select('id, username, followers_at_detection')
    .is('follower_range_at_detection', null)
    .not('followers_at_detection', 'is', null)
    .limit(5000);

  if (events && events.length > 0) {
    for (const event of events) {
      const rangeAtDetection = getFollowerRange(event.followers_at_detection);

      // Try to find the 7d-ago snapshot for range_before
      const sevenDaysBeforeDetection = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: snap7d } = await supabase
        .from('brain_account_snapshots')
        .select('followers_count')
        .eq('username', event.username)
        .lte('checked_at', sevenDaysBeforeDetection)
        .order('checked_at', { ascending: false })
        .limit(1)
        .single();

      const rangeBefore = snap7d?.followers_count
        ? getFollowerRange(snap7d.followers_count)
        : rangeAtDetection;

      await supabase
        .from('brain_growth_events')
        .update({
          follower_range_at_detection: rangeAtDetection,
          follower_range_before: rangeBefore,
          follower_range_after: rangeAtDetection,
        })
        .eq('id', event.id);
      eventsUpdated++;
    }
    console.log(`${LOG_PREFIX} Backfilled follower_range on ${eventsUpdated} growth events`);
  }

  // 4. Backfill brain_retrospective_analyses
  const { data: retros } = await supabase
    .from('brain_retrospective_analyses')
    .select('id, growth_event_id')
    .is('follower_range_at_growth', null)
    .limit(5000);

  if (retros && retros.length > 0) {
    for (const retro of retros) {
      // Look up the growth event to get the follower range
      if (retro.growth_event_id) {
        const { data: event } = await supabase
          .from('brain_growth_events')
          .select('followers_at_detection, follower_range_at_detection')
          .eq('id', retro.growth_event_id)
          .single();

        if (event) {
          const range = event.follower_range_at_detection
            ?? (event.followers_at_detection ? getFollowerRange(event.followers_at_detection) : null);

          if (range) {
            await supabase
              .from('brain_retrospective_analyses')
              .update({ follower_range_at_growth: range })
              .eq('id', retro.id);
            retrosUpdated++;
          }
        }
      }
    }
    console.log(`${LOG_PREFIX} Backfilled follower_range on ${retrosUpdated} retrospectives`);
  }

  console.log(
    `${LOG_PREFIX} Backfill complete: ${accountsUpdated} accounts, ${eventsUpdated} events, ${retrosUpdated} retros`
  );

  return { accounts_updated: accountsUpdated, events_updated: eventsUpdated, retros_updated: retrosUpdated };
}

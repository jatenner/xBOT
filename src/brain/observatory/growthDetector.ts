/**
 * Growth Detector
 *
 * DB-only job that runs every 30 minutes. No browser needed.
 *
 * Compares consecutive follower snapshots for every tracked account.
 * Detects growth acceleration and classifies accounts as:
 *   boring → interesting → hot → explosive
 *
 * Growth thresholds are RELATIVE to account size:
 *   A 50-follower account gaining 25 followers/week (50% growth) = EXPLOSIVE
 *   A 100K-follower account gaining 25 followers/week (0.025%) = BORING
 *
 * When an account's status upgrades, inserts a brain_growth_event
 * and adjusts census frequency so we check growing accounts more often.
 */

import { getSupabaseClient } from '../../db';
import { GROWTH_THRESHOLDS, getAccountSizeBucket, type GrowthStatus } from '../types';

const LOG_PREFIX = '[observatory/growth-detector]';

const CENSUS_FREQUENCY: Record<GrowthStatus, number> = {
  unknown: 72,
  boring: 168,
  interesting: 24,
  hot: 12,
  explosive: 6,
};

interface GrowthComputation {
  username: string;
  current_followers: number;
  growth_rate_7d: number | null;   // % change over 7 days
  growth_rate_30d: number | null;  // % change over 30 days
  growth_acceleration: number | null; // is growth speeding up?
  new_status: GrowthStatus;
  old_status: GrowthStatus;
  status_changed: boolean;
}

export async function runGrowthDetector(): Promise<{
  accounts_analyzed: number;
  status_upgrades: number;
  status_downgrades: number;
  growth_events_created: number;
}> {
  const supabase = getSupabaseClient();
  let analyzed = 0;
  let upgrades = 0;
  let downgrades = 0;
  let eventsCreated = 0;

  // Get accounts that have at least 2 snapshots (need comparison data)
  const { data: accounts } = await supabase
    .from('brain_accounts')
    .select('username, followers_count, growth_status, snapshot_count')
    .eq('is_active', true)
    .gte('snapshot_count', 2)
    .limit(1000);

  if (!accounts || accounts.length === 0) {
    console.log(`${LOG_PREFIX} No accounts with 2+ snapshots yet`);
    return { accounts_analyzed: 0, status_upgrades: 0, status_downgrades: 0, growth_events_created: 0 };
  }

  for (const account of accounts) {
    try {
      const computation = await computeGrowthForAccount(supabase, account);
      if (!computation) continue;

      analyzed++;

      // Update brain_accounts with growth data
      const updateData: Record<string, any> = {
        growth_rate_7d: computation.growth_rate_7d,
        growth_rate_30d: computation.growth_rate_30d,
        growth_acceleration: computation.growth_acceleration,
        growth_status: computation.new_status,
        census_frequency_hours: CENSUS_FREQUENCY[computation.new_status],
        updated_at: new Date().toISOString(),
      };

      // Adjust next_census_at based on new frequency
      const freqHours = CENSUS_FREQUENCY[computation.new_status];
      updateData.next_census_at = new Date(Date.now() + freqHours * 60 * 60 * 1000).toISOString();

      await supabase
        .from('brain_accounts')
        .update(updateData)
        .eq('username', computation.username);

      // Track status changes
      if (computation.status_changed) {
        const statusOrder: GrowthStatus[] = ['unknown', 'boring', 'interesting', 'hot', 'explosive'];
        const oldIdx = statusOrder.indexOf(computation.old_status);
        const newIdx = statusOrder.indexOf(computation.new_status);

        if (newIdx > oldIdx) {
          upgrades++;

          // Create a growth event for status upgrades to interesting/hot/explosive
          if (computation.new_status !== 'boring') {
            await supabase.from('brain_growth_events').insert({
              username: computation.username,
              detected_at: new Date().toISOString(),
              growth_rate_before: computation.growth_rate_30d,
              growth_rate_after: computation.growth_rate_7d,
              acceleration_factor: computation.growth_acceleration,
              trigger_type: 'organic',
              growth_phase_at_detection: getGrowthPhaseFromFollowers(computation.current_followers),
              followers_at_detection: computation.current_followers,
              retrospective_status: 'pending',
            });
            eventsCreated++;

            // Increment growth_events_count
            await supabase
              .from('brain_accounts')
              .update({
                growth_events_count: (account as any).growth_events_count
                  ? (account as any).growth_events_count + 1
                  : 1,
              })
              .eq('username', computation.username);

            console.log(
              `${LOG_PREFIX} ⚡ @${computation.username}: ${computation.old_status} → ${computation.new_status} ` +
              `(${computation.current_followers} followers, ${computation.growth_rate_7d?.toFixed(1)}%/week)`
            );
          }
        } else if (newIdx < oldIdx) {
          downgrades++;
        }
      }
    } catch (err: any) {
      // Non-fatal per account
      console.error(`${LOG_PREFIX} Error on @${account.username}: ${err.message}`);
    }
  }

  if (analyzed > 0) {
    console.log(
      `${LOG_PREFIX} Analyzed ${analyzed} accounts: ` +
      `${upgrades} upgrades, ${downgrades} downgrades, ${eventsCreated} growth events`
    );
  }

  return {
    accounts_analyzed: analyzed,
    status_upgrades: upgrades,
    status_downgrades: downgrades,
    growth_events_created: eventsCreated,
  };
}

async function computeGrowthForAccount(
  supabase: any,
  account: { username: string; followers_count: number | null; growth_status: string | null; snapshot_count: number | null },
): Promise<GrowthComputation | null> {
  const username = account.username;
  const currentFollowers = account.followers_count ?? 0;
  if (currentFollowers <= 0) return null;

  const oldStatus = (account.growth_status ?? 'unknown') as GrowthStatus;

  // Get snapshots for 7d and 30d comparisons
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Get oldest snapshot near 7 days ago
  const { data: snap7d } = await supabase
    .from('brain_account_snapshots')
    .select('followers_count, checked_at')
    .eq('username', username)
    .lte('checked_at', sevenDaysAgo)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single();

  // Get oldest snapshot near 30 days ago
  const { data: snap30d } = await supabase
    .from('brain_account_snapshots')
    .select('followers_count, checked_at')
    .eq('username', username)
    .lte('checked_at', thirtyDaysAgo)
    .order('checked_at', { ascending: false })
    .limit(1)
    .single();

  // Compute growth rates
  let growthRate7d: number | null = null;
  let growthRate30d: number | null = null;

  if (snap7d && snap7d.followers_count > 0) {
    growthRate7d = ((currentFollowers - snap7d.followers_count) / snap7d.followers_count) * 100;
  }

  if (snap30d && snap30d.followers_count > 0) {
    growthRate30d = ((currentFollowers - snap30d.followers_count) / snap30d.followers_count) * 100;
  }

  // If we don't have 7d data, try to compute from whatever snapshots we have
  if (growthRate7d === null) {
    const { data: oldestSnap } = await supabase
      .from('brain_account_snapshots')
      .select('followers_count, checked_at')
      .eq('username', username)
      .order('checked_at', { ascending: true })
      .limit(1)
      .single();

    if (oldestSnap && oldestSnap.followers_count > 0) {
      const daysBetween = (now - new Date(oldestSnap.checked_at).getTime()) / (24 * 60 * 60 * 1000);
      if (daysBetween >= 1) {
        const totalGrowth = ((currentFollowers - oldestSnap.followers_count) / oldestSnap.followers_count) * 100;
        growthRate7d = (totalGrowth / daysBetween) * 7; // Extrapolate to weekly
      }
    }
  }

  // Compute acceleration (is growth speeding up?)
  // Compare growth in last 7 days vs previous 7 days (days 8-14)
  let acceleration: number | null = null;

  if (snap7d) {
    const { data: snap14d } = await supabase
      .from('brain_account_snapshots')
      .select('followers_count')
      .eq('username', username)
      .lte('checked_at', fourteenDaysAgo)
      .order('checked_at', { ascending: false })
      .limit(1)
      .single();

    if (snap14d && snap14d.followers_count > 0 && snap7d.followers_count > 0) {
      const recentGrowth = currentFollowers - snap7d.followers_count;
      const olderGrowth = snap7d.followers_count - snap14d.followers_count;

      if (olderGrowth > 0) {
        acceleration = (recentGrowth - olderGrowth) / olderGrowth; // >0 = accelerating
      } else if (recentGrowth > 0) {
        acceleration = 1.0; // Was flat, now growing = max acceleration signal
      }
    }
  }

  // Determine growth status based on thresholds
  const weeklyRate = growthRate7d ?? 0;
  const sizeBucket = getAccountSizeBucket(currentFollowers);
  const thresholds = GROWTH_THRESHOLDS[sizeBucket];

  let newStatus: GrowthStatus;
  if (weeklyRate >= thresholds.explosive) {
    newStatus = 'explosive';
  } else if (weeklyRate >= thresholds.hot) {
    newStatus = 'hot';
  } else if (weeklyRate >= thresholds.interesting) {
    newStatus = 'interesting';
  } else if (weeklyRate > 0 || growthRate7d === null) {
    // Slightly positive or no data yet — keep as boring (not unknown)
    newStatus = growthRate7d === null ? 'unknown' : 'boring';
  } else {
    newStatus = 'boring';
  }

  return {
    username,
    current_followers: currentFollowers,
    growth_rate_7d: growthRate7d !== null ? Math.round(growthRate7d * 100) / 100 : null,
    growth_rate_30d: growthRate30d !== null ? Math.round(growthRate30d * 100) / 100 : null,
    growth_acceleration: acceleration !== null ? Math.round(acceleration * 100) / 100 : null,
    new_status: newStatus,
    old_status: oldStatus,
    status_changed: newStatus !== oldStatus,
  };
}

function getGrowthPhaseFromFollowers(followers: number): string {
  if (followers < 500) return 'cold_start';
  if (followers < 2000) return 'early_traction';
  if (followers < 10000) return 'growth';
  if (followers < 50000) return 'authority';
  return 'scale';
}

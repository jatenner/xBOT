/**
 * Account Pruner — keeps the brain's active pool lean enough to deeply track.
 *
 * The brain accumulates accounts via discovery feeds (profileHopSeeder,
 * accountDiscoveryEngine, googleDiscovery, mention extraction). Without
 * pruning, the pool grows unbounded — currently 32K+ active, 88% of which
 * are C-tier (low signal) and ~63% of which haven't been scraped in 7+
 * days. The wide+shallow trap.
 *
 * This job runs weekly. It deactivates accounts that have produced no
 * actionable signal over a long enough window. Deactivation is reversible
 * (is_active=false, deactivation_reason set) — if signal returns later,
 * the discovery feeds will re-promote the account.
 *
 * Conservative thresholds:
 *   1. zero_tweets_30d — discovered ≥30 days ago, never produced a tweet
 *      we captured. They're either silent, deleted, or so rarely active
 *      that scraping them costs more than it yields.
 *
 *   2. zero_engagement_60d — has tweets but avg_engagement_rate_30d is
 *      below 0.001 (0.1%) and account is ≥60 days old. They post but
 *      nothing lands. Not useful for "what works" learning.
 *
 *   3. dormant_no_growth_90d — no follower-delta movement in 90+ days.
 *      Dormant accounts; they may exist but they aren't growing, so they
 *      can't teach us about growth mechanics.
 *
 * S/A tier accounts are never pruned automatically — they're our deep-track
 * cohort and need explicit demotion via the tier daemon, not silent removal.
 */
import { getSupabaseClient } from '../../db/index';

const LOG_PREFIX = '[brain/observatory/pruner]';

interface PruneResult {
  zero_tweets_30d: number;
  zero_engagement_60d: number;
  dormant_no_growth_90d: number;
  total_deactivated: number;
}

export async function runAccountPruner(): Promise<PruneResult> {
  const supabase = getSupabaseClient();
  const startedAt = Date.now();

  const day30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const day60 = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const day90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  // ── Rule 1: zero tweets after 30 days ──
  // Account has been in the pool 30+ days but tweets_collected_count is 0.
  // Either silent, deleted, or rarely active. We protect S/A tier from
  // automatic pruning (they get explicit tier-daemon decisions).
  const { data: r1, error: e1 } = await supabase
    .from('brain_accounts')
    .update({
      is_active: false,
      deactivation_reason: 'zero_tweets_30d',
      deactivated_at: nowIso,
    })
    .eq('is_active', true)
    .not('tier', 'in', '(S,A)')
    .lt('discovered_at', day30)
    .or('tweets_collected_count.eq.0,tweets_collected_count.is.null')
    .select('username');

  if (e1) console.warn(`${LOG_PREFIX} rule 1 error: ${e1.message}`);
  const zeroTweets = r1?.length ?? 0;

  // ── Rule 2: chronically low engagement after 60 days ──
  // Account has tweets but engagement_rate is microscopic. They post but
  // nothing resonates. Not useful for learning what drives growth.
  const { data: r2, error: e2 } = await supabase
    .from('brain_accounts')
    .update({
      is_active: false,
      deactivation_reason: 'zero_engagement_60d',
      deactivated_at: nowIso,
    })
    .eq('is_active', true)
    .not('tier', 'in', '(S,A)')
    .lt('discovered_at', day60)
    .gt('tweets_collected_count', 0)
    .lt('avg_engagement_rate_30d', 0.001)
    .select('username');

  if (e2) console.warn(`${LOG_PREFIX} rule 2 error: ${e2.message}`);
  const zeroEng = r2?.length ?? 0;

  // ── Rule 3: dormant — no follower movement in 90+ days ──
  // The most conservative rule (longest window). Targets accounts that exist
  // but are functionally frozen — no follower changes detected over 3 months.
  const { data: r3, error: e3 } = await supabase
    .from('brain_accounts')
    .update({
      is_active: false,
      deactivation_reason: 'dormant_no_growth_90d',
      deactivated_at: nowIso,
    })
    .eq('is_active', true)
    .not('tier', 'in', '(S,A)')
    .lt('discovered_at', day90)
    .eq('growth_rate_7d', 0)
    .eq('growth_rate_30d', 0)
    .select('username');

  if (e3) console.warn(`${LOG_PREFIX} rule 3 error: ${e3.message}`);
  const dormant = r3?.length ?? 0;

  const total = zeroTweets + zeroEng + dormant;
  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `${LOG_PREFIX} Pruned ${total} accounts: ` +
    `zero_tweets_30d=${zeroTweets}, zero_engagement_60d=${zeroEng}, dormant_no_growth_90d=${dormant} ` +
    `(elapsed ${elapsedSec}s)`,
  );

  return {
    zero_tweets_30d: zeroTweets,
    zero_engagement_60d: zeroEng,
    dormant_no_growth_90d: dormant,
    total_deactivated: total,
  };
}

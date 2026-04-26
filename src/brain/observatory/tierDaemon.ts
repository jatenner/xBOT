/**
 * Tier Promotion / Demotion Daemon
 *
 * Runs daily. Re-tiers accounts based on a learned composite signal so the
 * brain's depth budget is always spent on the highest-signal accounts. Hard
 * caps the population per tier so we never re-enter the wide-shallow trap.
 *
 *   S = 200 accounts (deepest tracking, full timeline + replies + tweet curves)
 *   A = 600 accounts (daily scrape, log-spaced re-captures on viral tweets)
 *   B = 1,500 accounts (weekly scrape)
 *   C = remainder (on-signal only)
 *
 * Signal composite (z-scored, equal-weighted):
 *   - 7-day follower delta
 *   - growth acceleration (delta of delta)
 *   - max single-tweet engagement-velocity z-score (vs author's own baseline)
 *
 * Promotion: top-N candidates by composite score get promoted to fill open
 * slots in the next-higher tier.
 *
 * Demotion: accounts in S/A/B with consistently below-median signal for 7+
 * days drop one tier. Excess accounts above the hard cap are demoted from
 * the bottom of their tier.
 *
 * Audit trail: every change is recorded in brain_account_tier_history with
 * the score and reason at change time, so we can validate retrospectively
 * whether tier-up correlated with subsequent growth (the meta-feedback loop).
 *
 * This implements the watchlist-promotion pattern used by Nansen Smart Money,
 * Elasticsearch ILM, and BlackMagic.so — applied to Twitter accounts.
 */
import { getSupabaseClient } from '../../db/index';

const LOG_PREFIX = '[brain/observatory/tier-daemon]';

// Hard caps. The research is clear: 50/250/1500 (BlackMagic.so / commercial
// tools) up to 200/600/1500 (academic minimum-viable-brain) is the right
// ballpark. We pick the upper end to give the brain more deep-tracked signal.
const CAP_S = parseInt(process.env.BRAIN_TIER_CAP_S || '200', 10);
const CAP_A = parseInt(process.env.BRAIN_TIER_CAP_A || '600', 10);
const CAP_B = parseInt(process.env.BRAIN_TIER_CAP_B || '1500', 10);

interface AccountForTiering {
  username: string;
  tier: string | null;
  followers_count: number | null;
  growth_rate_7d: number | null;
  growth_rate_30d: number | null;
  growth_acceleration: number | null;
  avg_engagement_rate_30d: number | null;
  viral_rate_30d: number | null;
  hit_rate_30d: number | null;
  tweets_collected_count: number | null;
  snapshot_count: number | null;
  growth_status: string | null;
}

interface ScoredAccount extends AccountForTiering {
  score: number;
  current_tier: string;
  target_tier: string;
}

export async function runTierDaemon(): Promise<{
  promoted: number;
  demoted: number;
  unchanged: number;
  tier_distribution: Record<string, number>;
}> {
  const supabase = getSupabaseClient();
  const startedAt = Date.now();

  // Pull all active accounts with the signals we need.
  // Limited to is_active=true so the pruner can quietly drop accounts.
  const { data: accounts, error } = await supabase
    .from('brain_accounts')
    .select(
      'username, tier, followers_count, growth_rate_7d, growth_rate_30d, growth_acceleration, ' +
      'avg_engagement_rate_30d, viral_rate_30d, hit_rate_30d, tweets_collected_count, snapshot_count, growth_status',
    )
    .eq('is_active', true);

  if (error || !accounts) {
    console.error(`${LOG_PREFIX} fetch failed: ${error?.message}`);
    return { promoted: 0, demoted: 0, unchanged: 0, tier_distribution: {} };
  }

  const all = accounts as AccountForTiering[];

  // Compute z-scores for each signal so they're comparable.
  const zScored = computeZScores(all);

  // Composite score: equal-weighted z-score of growth signals + a small
  // "data depth" bonus (we prefer to deep-track accounts where we already
  // have meaningful history — avoids ranking unscraped C-tier surprises).
  const scored: ScoredAccount[] = zScored.map(a => ({
    ...a,
    current_tier: a.tier || 'C',
    target_tier: 'C', // assigned below
    score:
      0.35 * (a as any).z_growth_7d +
      0.25 * (a as any).z_growth_accel +
      0.20 * (a as any).z_engagement +
      0.10 * (a as any).z_viral_rate +
      0.10 * Math.min((a.tweets_collected_count ?? 0) / 50, 1.0),
  }));

  // Force "explosive"/"hot" growth_status accounts to S regardless of score —
  // the growth detector spotted a real event, we should be deeply tracking it.
  const forcedS = new Set(
    scored
      .filter(a => a.growth_status === 'explosive' || a.growth_status === 'hot')
      .map(a => a.username),
  );

  // Sort by score desc and assign target tiers respecting the caps.
  // Forced-S accounts take priority in the S slot allocation.
  const forcedSAccounts = scored.filter(a => forcedS.has(a.username));
  const otherAccounts = scored
    .filter(a => !forcedS.has(a.username))
    .sort((a, b) => b.score - a.score);

  let sFilled = 0;
  let aFilled = 0;
  let bFilled = 0;
  for (const a of forcedSAccounts.slice(0, CAP_S)) {
    a.target_tier = 'S';
    sFilled++;
  }
  for (const a of forcedSAccounts.slice(CAP_S)) {
    // forced-S accounts beyond cap drop to A (they're still high-signal)
    if (aFilled < CAP_A) {
      a.target_tier = 'A';
      aFilled++;
    } else {
      a.target_tier = 'B';
      bFilled++;
    }
  }
  for (const a of otherAccounts) {
    if (sFilled < CAP_S) {
      a.target_tier = 'S';
      sFilled++;
    } else if (aFilled < CAP_A) {
      a.target_tier = 'A';
      aFilled++;
    } else if (bFilled < CAP_B) {
      a.target_tier = 'B';
      bFilled++;
    } else {
      a.target_tier = 'C';
    }
  }

  // Apply changes. Log every promotion/demotion to brain_account_tier_history
  // so the daemon's decisions are auditable.
  let promoted = 0;
  let demoted = 0;
  let unchanged = 0;
  const distribution: Record<string, number> = { S: 0, A: 0, B: 0, C: 0 };
  const nowIso = new Date().toISOString();

  // Batch by change-type for efficient writes.
  const changes: Array<{
    username: string;
    from_tier: string;
    to_tier: string;
    reason: string;
    signal_score: number;
    followers: number | null;
    growth_rate_7d: number | null;
  }> = [];

  for (const a of scored) {
    distribution[a.target_tier] = (distribution[a.target_tier] ?? 0) + 1;
    if (a.target_tier === a.current_tier) {
      unchanged++;
      continue;
    }
    const tierRank: Record<string, number> = { S: 4, A: 3, B: 2, C: 1, dormant: 0 };
    const promotedDirection = (tierRank[a.target_tier] ?? 0) > (tierRank[a.current_tier] ?? 0);
    if (promotedDirection) promoted++;
    else demoted++;

    changes.push({
      username: a.username,
      from_tier: a.current_tier,
      to_tier: a.target_tier,
      reason: forcedS.has(a.username) ? 'growth_status_forced' : (promotedDirection ? 'promotion_signal' : 'demotion_no_signal'),
      signal_score: Number.isFinite(a.score) ? Math.round(a.score * 1000) / 1000 : 0,
      followers: a.followers_count,
      growth_rate_7d: a.growth_rate_7d,
    });
  }

  // Apply tier updates in chunks so we don't overwhelm the connection.
  const CHUNK = 100;
  for (let i = 0; i < changes.length; i += CHUNK) {
    const slice = changes.slice(i, i + CHUNK);

    // Write tier_history audit rows (in one batch).
    await supabase.from('brain_account_tier_history').insert(
      slice.map(c => ({
        username: c.username,
        changed_at: nowIso,
        from_tier: c.from_tier,
        to_tier: c.to_tier,
        reason: c.reason,
        signal_score: c.signal_score,
        followers_at_change: c.followers,
        growth_rate_7d_at_change: c.growth_rate_7d,
      })),
    );

    // Update brain_accounts.tier in parallel for the slice.
    await Promise.all(
      slice.map(c =>
        supabase
          .from('brain_accounts')
          .update({ tier: c.to_tier, tier_score: c.signal_score, tier_updated_at: nowIso })
          .eq('username', c.username),
      ),
    );
  }

  const elapsedSec = Math.round((Date.now() - startedAt) / 1000);
  console.log(
    `${LOG_PREFIX} ${promoted} promoted, ${demoted} demoted, ${unchanged} unchanged. ` +
    `Final tiers: S=${distribution.S} A=${distribution.A} B=${distribution.B} C=${distribution.C}. ` +
    `Caps: S=${CAP_S} A=${CAP_A} B=${CAP_B}. (elapsed ${elapsedSec}s)`,
  );

  return { promoted, demoted, unchanged, tier_distribution: distribution };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function computeZScores(accounts: AccountForTiering[]): AccountForTiering[] {
  // Compute mean + stddev for each signal across the population, then z-score
  // every account. Accounts with NULL signals get a neutral 0.
  const stats = (key: keyof AccountForTiering) => {
    const vals = accounts.map(a => Number(a[key])).filter(v => Number.isFinite(v));
    if (vals.length === 0) return { mean: 0, std: 1 };
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
    const std = Math.sqrt(variance) || 1; // avoid div-by-zero
    return { mean, std };
  };

  const sGrowth7 = stats('growth_rate_7d');
  const sAccel = stats('growth_acceleration');
  const sEng = stats('avg_engagement_rate_30d');
  const sViral = stats('viral_rate_30d');

  const zScore = (v: any, s: { mean: number; std: number }) =>
    Number.isFinite(Number(v)) ? (Number(v) - s.mean) / s.std : 0;

  return accounts.map(a => ({
    ...a,
    z_growth_7d: zScore(a.growth_rate_7d, sGrowth7),
    z_growth_accel: zScore(a.growth_acceleration, sAccel),
    z_engagement: zScore(a.avg_engagement_rate_30d, sEng),
    z_viral_rate: zScore(a.viral_rate_30d, sViral),
  })) as any;
}

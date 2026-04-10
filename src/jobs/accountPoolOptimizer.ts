/**
 * Account Pool Optimizer
 *
 * Daily job that promotes, demotes, and boosts curated accounts
 * based on actual reply performance data from reply_account_performance.
 *
 * - Demotes underperformers (lower signal_score or disable)
 * - Promotes high-performing discovered accounts into curated_accounts
 * - Boosts top performers to signal_score = 1.0
 */

import { getSupabaseClient } from '../db/index';

const TAG = '[ACCOUNT_POOL_OPTIMIZER]';

const MIN_ENABLED_ACCOUNTS = 20;
const MAX_PROMOTIONS_PER_RUN = 5;

export async function runAccountPoolOptimizer(): Promise<{
  promoted: number;
  demoted: number;
  boosted: number;
}> {
  const result = { promoted: 0, demoted: 0, boosted: 0 };

  try {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();

    // ---------------------------------------------------------------
    // 1. Load curated accounts and their performance rows
    // ---------------------------------------------------------------
    const { data: curatedAccounts, error: curatedErr } = await supabase
      .from('curated_accounts')
      .select('id, username, enabled, signal_score');

    if (curatedErr || !curatedAccounts) {
      console.error(`${TAG} Failed to load curated_accounts: ${curatedErr?.message}`);
      return result;
    }

    const curatedUsernames = new Set(
      curatedAccounts.map((a: any) => a.username.toLowerCase())
    );

    // Load all performance rows that have at least 3 replies posted
    const { data: perfRows, error: perfErr } = await supabase
      .from('reply_account_performance')
      .select('target_username, replies_posted, avg_reward_24h')
      .gte('replies_posted', 3);

    if (perfErr) {
      console.error(`${TAG} Failed to load reply_account_performance: ${perfErr.message}`);
      return result;
    }

    const perfByUsername = new Map<string, { replies_posted: number; avg_reward_24h: number | null }>();
    for (const row of perfRows ?? []) {
      perfByUsername.set(row.target_username.toLowerCase(), {
        replies_posted: row.replies_posted,
        avg_reward_24h: row.avg_reward_24h != null ? Number(row.avg_reward_24h) : null,
      });
    }

    // Count currently enabled accounts (needed for safety floor)
    const enabledCount = curatedAccounts.filter((a: any) => a.enabled).length;

    // ---------------------------------------------------------------
    // 2. Demote underperformers
    // ---------------------------------------------------------------
    const demotions: { username: string; action: string; old_score: number | null; new_score: number | null; disabled: boolean }[] = [];

    for (const account of curatedAccounts) {
      if (!account.enabled) continue;

      const perf = perfByUsername.get(account.username.toLowerCase());
      if (!perf || perf.avg_reward_24h == null) continue;

      const avgReward = perf.avg_reward_24h;
      const repliesPosted = perf.replies_posted;

      // Hard disable: avg_reward < 2 after 10+ replies
      if (avgReward < 2 && repliesPosted >= 10) {
        // Safety: never go below MIN_ENABLED_ACCOUNTS
        const currentEnabled = enabledCount - demotions.filter(d => d.disabled).length;
        if (currentEnabled <= MIN_ENABLED_ACCOUNTS) {
          console.warn(`${TAG} Skipping disable of @${account.username} - at minimum enabled floor (${MIN_ENABLED_ACCOUNTS})`);
          continue;
        }

        const { error } = await supabase
          .from('curated_accounts')
          .update({ enabled: false, signal_score: 0.1, updated_at: now })
          .eq('id', account.id);

        if (!error) {
          demotions.push({
            username: account.username,
            action: 'disabled',
            old_score: account.signal_score,
            new_score: 0.1,
            disabled: true,
          });
          result.demoted++;
          console.log(`${TAG} DISABLED @${account.username} (avg_reward=${avgReward.toFixed(1)}, n=${repliesPosted})`);
        }
        continue;
      }

      // Soft demote: avg_reward < 5 after 5+ replies -> signal_score = 0.3
      if (avgReward < 5 && repliesPosted >= 5) {
        const currentScore = Number(account.signal_score) || 0;
        if (currentScore <= 0.3) continue; // already demoted

        const { error } = await supabase
          .from('curated_accounts')
          .update({ signal_score: 0.3, updated_at: now })
          .eq('id', account.id);

        if (!error) {
          demotions.push({
            username: account.username,
            action: 'soft_demote',
            old_score: account.signal_score,
            new_score: 0.3,
            disabled: false,
          });
          result.demoted++;
          console.log(`${TAG} DEMOTED @${account.username} signal_score -> 0.3 (avg_reward=${avgReward.toFixed(1)}, n=${repliesPosted})`);
        }
      }
    }

    // ---------------------------------------------------------------
    // 3. Promote high-performing discovered accounts
    // ---------------------------------------------------------------
    const promotions: { username: string; avg_reward: number; replies: number }[] = [];

    for (const [username, perf] of Array.from(perfByUsername.entries())) {
      if (curatedUsernames.has(username)) continue; // already curated
      if (perf.avg_reward_24h == null || perf.avg_reward_24h <= 30) continue;
      if (perf.replies_posted < 3) continue;
      if (promotions.length >= MAX_PROMOTIONS_PER_RUN) break;

      const { error } = await supabase
        .from('curated_accounts')
        .upsert(
          {
            username,
            enabled: true,
            signal_score: 0.9,
            account_type: 'discovered',
            created_at: now,
            updated_at: now,
          },
          { onConflict: 'username' }
        );

      if (!error) {
        promotions.push({
          username,
          avg_reward: perf.avg_reward_24h,
          replies: perf.replies_posted,
        });
        result.promoted++;
        console.log(`${TAG} PROMOTED @${username} to curated (avg_reward=${perf.avg_reward_24h.toFixed(1)}, n=${perf.replies_posted})`);
      }
    }

    // ---------------------------------------------------------------
    // 4. Boost top performers
    // ---------------------------------------------------------------
    const boosts: { username: string; avg_reward: number; old_score: number | null }[] = [];

    for (const account of curatedAccounts) {
      if (!account.enabled) continue;

      const perf = perfByUsername.get(account.username.toLowerCase());
      if (!perf || perf.avg_reward_24h == null) continue;
      if (perf.avg_reward_24h <= 50 || perf.replies_posted < 5) continue;

      const currentScore = Number(account.signal_score) || 0;
      if (currentScore >= 1.0) continue; // already max

      const { error } = await supabase
        .from('curated_accounts')
        .update({ signal_score: 1.0, updated_at: now })
        .eq('id', account.id);

      if (!error) {
        boosts.push({
          username: account.username,
          avg_reward: perf.avg_reward_24h,
          old_score: account.signal_score,
        });
        result.boosted++;
        console.log(`${TAG} BOOSTED @${account.username} signal_score -> 1.0 (avg_reward=${perf.avg_reward_24h.toFixed(1)}, n=${perf.replies_posted})`);
      }
    }

    // ---------------------------------------------------------------
    // 5. Log summary to system_events
    // ---------------------------------------------------------------
    await supabase.from('system_events').insert({
      event_type: 'account_pool_optimizer_run',
      severity: 'info',
      message: `Account pool optimizer: promoted=${result.promoted}, demoted=${result.demoted}, boosted=${result.boosted}`,
      event_data: {
        promoted: result.promoted,
        demoted: result.demoted,
        boosted: result.boosted,
        promotions,
        demotions,
        boosts,
        curated_total: curatedAccounts.length,
        curated_enabled: enabledCount,
        perf_rows_evaluated: perfByUsername.size,
      },
      created_at: now,
    });

    console.log(
      `${TAG} Complete: promoted=${result.promoted}, demoted=${result.demoted}, boosted=${result.boosted} ` +
      `(curated_total=${curatedAccounts.length}, enabled=${enabledCount}, perf_rows=${perfByUsername.size})`
    );
  } catch (err: any) {
    console.error(`${TAG} Fatal error: ${err.message}`, err.stack);
  }

  return result;
}

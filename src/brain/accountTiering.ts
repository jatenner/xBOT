/**
 * Brain: Account Tiering Engine
 *
 * Automatically tiers all brain_accounts by percentile performance.
 * No manual assignment — tiers are computed from rolling 30d engagement data.
 *
 * S-tier: top 5%    — scraped every 2h
 * A-tier: top 5-20% — scraped every 6h
 * B-tier: 20-50%    — scraped every 24h
 * C-tier: bottom 50% — scraped every 48h
 * Dormant: 0 tweets collected in 30d — weekly check
 *
 * Runs daily.
 */

import { getSupabaseClient } from '../db';
import { getAllActiveAccounts, updateAccountTiers } from './db';
import type { AccountTier } from './types';

const LOG_PREFIX = '[brain/tiering]';

// Scrape priority mapping (higher = more frequent)
const TIER_PRIORITY: Record<AccountTier, number> = {
  S: 1.0,
  A: 0.75,
  B: 0.5,
  C: 0.3,
  dormant: 0.05,
};

export async function runAccountTiering(): Promise<{
  total_accounts: number;
  tiers: Record<string, number>;
  promotions: number;
  demotions: number;
}> {
  const supabase = getSupabaseClient();

  // Fetch all active accounts with their performance data
  const accounts = await getAllActiveAccounts();

  if (accounts.length === 0) {
    console.log(`${LOG_PREFIX} No active accounts to tier`);
    return { total_accounts: 0, tiers: {}, promotions: 0, demotions: 0 };
  }

  // Compute tier scores based on available metrics
  // Score = avg_engagement_rate_30d (primary) + bonus for consistency
  const scored = accounts.map(a => {
    const engagement = a.avg_engagement_rate_30d ?? 0;
    const tweetCount = a.tweets_collected_count ?? 0;
    const growthRate = (a as any).growth_rate_7d ?? 0;
    const hasData = tweetCount > 0 || engagement > 0 || growthRate > 0;

    // Score: growth rate + engagement + content volume
    // Growth is weighted heavily — growing accounts are the most valuable to track
    const score = hasData
      ? engagement * 50 + Math.max(growthRate, 0) * 30 + Math.min(tweetCount / 10, 5) + (growthRate > 5 ? 15 : 0)
      : 0.01; // Minimal positive score — keeps unscraped accounts in C-tier

    return {
      username: a.username,
      currentTier: a.tier as AccountTier,
      score,
      isDormant: false, // Never auto-dormant — growth observatory handles status
    };
  });

  // Separate dormant accounts
  const dormant = scored.filter(s => s.isDormant);
  const active = scored.filter(s => !s.isDormant).sort((a, b) => b.score - a.score);

  // Compute percentile-based tiers
  const tierUpdates: { username: string; tier: AccountTier; tier_score: number }[] = [];
  let promotions = 0;
  let demotions = 0;

  if (active.length > 0) {
    const sThreshold = Math.floor(active.length * 0.05);   // Top 5%
    const aThreshold = Math.floor(active.length * 0.20);   // Top 5-20%
    const bThreshold = Math.floor(active.length * 0.50);   // 20-50%

    for (let i = 0; i < active.length; i++) {
      const acc = active[i];
      let newTier: AccountTier;

      if (i < sThreshold) newTier = 'S';
      else if (i < aThreshold) newTier = 'A';
      else if (i < bThreshold) newTier = 'B';
      else newTier = 'C';

      // Normalize score to 0-1 range within tier
      const tierScore = 1 - (i / active.length);

      tierUpdates.push({
        username: acc.username,
        tier: newTier,
        tier_score: Math.round(tierScore * 1000) / 1000,
      });

      // Track promotions/demotions
      const tierOrder: AccountTier[] = ['dormant', 'C', 'B', 'A', 'S'];
      const oldIdx = tierOrder.indexOf(acc.currentTier);
      const newIdx = tierOrder.indexOf(newTier);
      if (newIdx > oldIdx) promotions++;
      else if (newIdx < oldIdx) demotions++;
    }
  }

  // Mark dormant accounts
  for (const acc of dormant) {
    tierUpdates.push({
      username: acc.username,
      tier: 'dormant',
      tier_score: 0,
    });
    if (acc.currentTier !== 'dormant') demotions++;
  }

  // Batch update tiers
  const updated = await updateAccountTiers(tierUpdates);

  // Update scrape priorities based on new tiers
  for (const update of tierUpdates) {
    const priority = TIER_PRIORITY[update.tier];
    await supabase
      .from('brain_accounts')
      .update({ scrape_priority: priority })
      .eq('username', update.username);
  }

  // Propagate tier to brain_tweets.author_tier. This column is set NULL at
  // ingest (discoveryEngine.ts:128) and was never backfilled — which silently
  // disabled every tier-stratified query in phaseAdvisor, tickAdvisor, and
  // the analytics engine. Group the update by tier so each covers many rows.
  let tweetsTiered = 0;
  for (const tier of ['S', 'A', 'B', 'C', 'dormant'] as AccountTier[]) {
    const usernames = tierUpdates.filter(u => u.tier === tier).map(u => u.username);
    if (usernames.length === 0) continue;
    const CHUNK = 500;
    for (let i = 0; i < usernames.length; i += CHUNK) {
      const slice = usernames.slice(i, i + CHUNK);
      const { error, count } = await supabase
        .from('brain_tweets')
        .update({ author_tier: tier }, { count: 'exact' })
        .in('author_username', slice);
      if (!error) tweetsTiered += count ?? 0;
      else console.warn(`${LOG_PREFIX} tier backfill chunk failed: ${error.message}`);
    }
  }
  console.log(`${LOG_PREFIX} Propagated tiers to ${tweetsTiered} brain_tweets rows`);

  // Count tiers
  const tiers: Record<string, number> = {};
  for (const u of tierUpdates) {
    tiers[u.tier] = (tiers[u.tier] ?? 0) + 1;
  }

  console.log(`${LOG_PREFIX} Tiered ${tierUpdates.length} accounts: S=${tiers['S'] ?? 0} A=${tiers['A'] ?? 0} B=${tiers['B'] ?? 0} C=${tiers['C'] ?? 0} dormant=${tiers['dormant'] ?? 0} | +${promotions} promotions, -${demotions} demotions`);

  return {
    total_accounts: tierUpdates.length,
    tiers,
    promotions,
    demotions,
  };
}

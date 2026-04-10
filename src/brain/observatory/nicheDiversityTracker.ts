/**
 * Niche Diversity Tracker
 *
 * DB-only job (no browser). Runs every hour.
 *
 * 1. Queries brain_accounts grouped by niche x follower_range
 * 2. Computes coverage matrix (how many accounts per cell?)
 * 3. Identifies gaps (under-represented niches/ranges)
 * 4. Auto-creates or boosts priority of seed campaigns to fill gaps
 * 5. Stores the coverage matrix in brain_niche_coverage
 *
 * No hardcoded quotas — coverage targets are proportional.
 * The system self-balances toward even coverage across niches.
 */

import { getSupabaseClient } from '../../db';
import { FOLLOWER_RANGE_ORDER, type FollowerRange } from '../types';

const LOG_PREFIX = '[observatory/niche-diversity]';

// Minimum accounts per niche x range cell before we consider it "covered"
// This scales with total account count — the more accounts we have overall,
// the higher the bar for each cell
const MIN_COVERAGE_PER_CELL = 50;

// Niches we actively seed (domain-agnostic — covers all major Twitter verticals)
const TRACKED_NICHES = [
  'health', 'tech', 'crypto', 'finance', 'politics', 'science',
  'business', 'personal_dev', 'fitness', 'humor', 'culture', 'sports',
  'entertainment', 'news', 'other',
];

// Ranges we actively seed (not celebrity — too few to discover by search)
const SEEDED_RANGES: FollowerRange[] = ['nano', 'micro', 'small', 'mid', 'large', 'mega'];

export async function runNicheDiversityTracker(): Promise<{
  cells_computed: number;
  campaigns_created: number;
  campaigns_boosted: number;
}> {
  const supabase = getSupabaseClient();
  let cellsComputed = 0;
  let campaignsCreated = 0;
  let campaignsBoosted = 0;

  // 1. Query current distribution
  const { data: accounts } = await supabase
    .from('brain_accounts')
    .select('niche_cached, primary_domain, follower_range, growth_status')
    .eq('is_active', true)
    .not('follower_range', 'is', null);

  if (!accounts || accounts.length === 0) {
    console.log(`${LOG_PREFIX} No accounts with follower_range yet — run backfill first`);
    return { cells_computed: 0, campaigns_created: 0, campaigns_boosted: 0 };
  }

  // 2. Build coverage matrix
  const matrix: Record<string, Record<string, { total: number; interesting_plus: number; growth_rates: number[] }>> = {};

  for (const acct of accounts) {
    const niche = acct.niche_cached || acct.primary_domain || 'other';
    const range = acct.follower_range;
    if (!range) continue;

    if (!matrix[niche]) matrix[niche] = {};
    if (!matrix[niche][range]) matrix[niche][range] = { total: 0, interesting_plus: 0, growth_rates: [] };

    matrix[niche][range].total++;

    if (['interesting', 'hot', 'explosive'].includes(acct.growth_status)) {
      matrix[niche][range].interesting_plus++;
    }
  }

  // 3. Upsert coverage matrix into brain_niche_coverage
  const now = new Date().toISOString();
  for (const niche of Object.keys(matrix)) {
    for (const range of Object.keys(matrix[niche])) {
      const cell = matrix[niche][range];
      await supabase.from('brain_niche_coverage').upsert({
        niche,
        follower_range: range,
        account_count: cell.total,
        interesting_plus_count: cell.interesting_plus,
        last_computed_at: now,
      }, { onConflict: 'niche,follower_range' });
      cellsComputed++;
    }
  }

  // 4. Identify gaps and manage campaigns
  // Compute the median cell count to set a proportional target
  const allCounts = Object.values(matrix)
    .flatMap(ranges => Object.values(ranges).map(c => c.total));
  allCounts.sort((a, b) => a - b);
  const medianCount = allCounts.length > 0
    ? allCounts[Math.floor(allCounts.length / 2)]
    : MIN_COVERAGE_PER_CELL;

  // Target = max(MIN_COVERAGE_PER_CELL, median / 2)
  // This way the target grows as our total pool grows
  const targetPerCell = Math.max(MIN_COVERAGE_PER_CELL, Math.floor(medianCount / 2));

  // Get existing active campaigns
  const { data: activeCampaigns } = await supabase
    .from('brain_seed_campaigns')
    .select('id, niche, target_follower_range, discovered_count, target_count, priority')
    .eq('status', 'active');

  const campaignMap = new Map<string, any>();
  for (const c of (activeCampaigns ?? [])) {
    campaignMap.set(`${c.niche}:${c.target_follower_range}`, c);
  }

  // Check each niche x range cell
  for (const niche of TRACKED_NICHES) {
    for (const range of SEEDED_RANGES) {
      const current = matrix[niche]?.[range]?.total ?? 0;
      const deficit = targetPerCell - current;

      if (deficit <= 0) continue; // Well covered

      const key = `${niche}:${range}`;
      const existingCampaign = campaignMap.get(key);

      if (existingCampaign) {
        // Boost priority based on deficit size
        const newPriority = Math.min(1.0, deficit / targetPerCell);
        if (newPriority > existingCampaign.priority + 0.1) {
          await supabase
            .from('brain_seed_campaigns')
            .update({
              priority: newPriority,
              target_count: Math.max(existingCampaign.target_count, deficit + existingCampaign.discovered_count),
              updated_at: now,
            })
            .eq('id', existingCampaign.id);
          campaignsBoosted++;
        }
      } else {
        // Create new campaign
        await supabase.from('brain_seed_campaigns').insert({
          niche,
          target_follower_range: range,
          target_count: deficit,
          discovered_count: 0,
          search_queries: [],  // Will use niche defaults from searchSeeder
          seed_accounts: [],
          hop_sources: [],
          status: 'active',
          priority: Math.min(1.0, deficit / targetPerCell),
          created_by: 'system',
        });
        campaignsCreated++;
      }
    }
  }

  if (cellsComputed > 0 || campaignsCreated > 0) {
    console.log(
      `${LOG_PREFIX} Coverage: ${cellsComputed} cells, ` +
      `${campaignsCreated} new campaigns, ${campaignsBoosted} boosted. ` +
      `Target per cell: ${targetPerCell}. Total tracked: ${accounts.length}`
    );
  }

  return { cells_computed: cellsComputed, campaigns_created: campaignsCreated, campaigns_boosted: campaignsBoosted };
}

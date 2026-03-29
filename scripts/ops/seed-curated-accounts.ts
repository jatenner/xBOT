#!/usr/bin/env tsx
/**
 * 🌱 SEED CURATED ACCOUNTS
 *
 * Populates the curated_accounts table with high-engagement health/wellness
 * accounts for the reply discovery pipeline.
 *
 * Usage:
 *   pnpm tsx scripts/ops/seed-curated-accounts.ts
 *
 * Idempotent: Uses ON CONFLICT (username) DO UPDATE to upsert.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

const ACCOUNTS = [
  // Tier 1: Major health/science accounts (1M+ followers)
  { username: 'hubaborhegyi', display_name: 'Andrew Huberman', follower_count: 5_000_000, account_type: 'expert', health_topics: ['neuroscience', 'sleep', 'performance', 'health'], signal_score: 0.95 },
  { username: 'PeterAttiaMD', display_name: 'Peter Attia', follower_count: 1_200_000, account_type: 'expert', health_topics: ['longevity', 'nutrition', 'exercise', 'metabolic_health'], signal_score: 0.95 },
  { username: 'foundmyfitness', display_name: 'Rhonda Patrick', follower_count: 800_000, account_type: 'researcher', health_topics: ['nutrition', 'genetics', 'supplements', 'longevity'], signal_score: 0.90 },
  { username: 'Rainmaker1973', display_name: 'Rainmaker1973', follower_count: 2_000_000, account_type: 'influencer', health_topics: ['science', 'biology', 'nature'], signal_score: 0.85 },

  // Tier 2: Health influencers (100K-1M followers)
  { username: 'DrMarkHyman', display_name: 'Mark Hyman MD', follower_count: 600_000, account_type: 'expert', health_topics: ['functional_medicine', 'nutrition', 'gut_health'], signal_score: 0.88 },
  { username: 'drjasonfung', display_name: 'Jason Fung', follower_count: 400_000, account_type: 'expert', health_topics: ['fasting', 'diabetes', 'metabolic_health'], signal_score: 0.85 },
  { username: 'SleepDiplomat', display_name: 'Sleep Diplomat', follower_count: 150_000, account_type: 'expert', health_topics: ['sleep', 'circadian_rhythm', 'recovery'], signal_score: 0.82 },
  { username: 'LevelsHealth', display_name: 'Levels', follower_count: 200_000, account_type: 'influencer', health_topics: ['metabolic_health', 'glucose', 'nutrition'], signal_score: 0.80 },
  { username: 'mattwalker_pod', display_name: 'Matthew Walker', follower_count: 250_000, account_type: 'researcher', health_topics: ['sleep', 'neuroscience', 'health'], signal_score: 0.90 },
  { username: 'GabrielleLyon', display_name: 'Gabrielle Lyon', follower_count: 300_000, account_type: 'expert', health_topics: ['muscle', 'protein', 'longevity', 'exercise'], signal_score: 0.85 },

  // Tier 3: Wellness/lifestyle (50K-500K followers, high engagement)
  { username: 'BenGreenfield', display_name: 'Ben Greenfield', follower_count: 200_000, account_type: 'influencer', health_topics: ['biohacking', 'fitness', 'nutrition', 'performance'], signal_score: 0.78 },
  { username: 'maxlugavere', display_name: 'Max Lugavere', follower_count: 300_000, account_type: 'influencer', health_topics: ['brain_health', 'nutrition', 'dementia'], signal_score: 0.82 },
  { username: 'DrChatGPT', display_name: 'Dr. AI Health', follower_count: 100_000, account_type: 'influencer', health_topics: ['health', 'wellness', 'longevity'], signal_score: 0.70 },
  { username: 'Nutritionfacts', display_name: 'NutritionFacts.org', follower_count: 400_000, account_type: 'researcher', health_topics: ['nutrition', 'plant_based', 'evidence_based'], signal_score: 0.80 },
  { username: 'drgundry', display_name: 'Steven Gundry MD', follower_count: 300_000, account_type: 'expert', health_topics: ['gut_health', 'nutrition', 'longevity'], signal_score: 0.78 },

  // Tier 4: Fitness/performance (high engagement in our niche)
  { username: 'JeffNippard', display_name: 'Jeff Nippard', follower_count: 500_000, account_type: 'influencer', health_topics: ['fitness', 'exercise_science', 'training'], signal_score: 0.82 },
  { username: 'DrAndrewGalpin', display_name: 'Andy Galpin', follower_count: 300_000, account_type: 'researcher', health_topics: ['exercise_science', 'performance', 'recovery'], signal_score: 0.88 },
  { username: 'EricHelms', display_name: 'Eric Helms', follower_count: 150_000, account_type: 'researcher', health_topics: ['nutrition', 'training', 'evidence_based'], signal_score: 0.80 },
];

async function main() {
  const supabase = getSupabaseClient();
  let inserted = 0;
  let updated = 0;
  let failed = 0;

  console.log(`[SEED_CURATED] Seeding ${ACCOUNTS.length} curated accounts...`);

  for (const account of ACCOUNTS) {
    try {
      const { data, error } = await supabase.from('curated_accounts').upsert(
        {
          username: account.username,
          display_name: account.display_name,
          follower_count: account.follower_count,
          account_type: account.account_type,
          health_topics: account.health_topics,
          signal_score: account.signal_score,
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'username' }
      );

      if (error) {
        console.error(`  ❌ @${account.username}: ${error.message}`);
        failed++;
      } else {
        console.log(`  ✅ @${account.username} (${account.account_type}, signal=${account.signal_score})`);
        inserted++;
      }
    } catch (err: any) {
      console.error(`  ❌ @${account.username}: ${err.message}`);
      failed++;
    }
  }

  // Verify
  const { data: enabled, count } = await supabase
    .from('curated_accounts')
    .select('username, signal_score, enabled', { count: 'exact' })
    .eq('enabled', true)
    .order('signal_score', { ascending: false });

  console.log(`\n[SEED_CURATED] ─── Results ───`);
  console.log(`  Inserted/updated: ${inserted}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total enabled accounts: ${count || enabled?.length || 0}`);
  if (enabled) {
    console.log(`  Top 5 by signal:`);
    enabled.slice(0, 5).forEach((a: any) => console.log(`    @${a.username} signal=${a.signal_score}`));
  }
}

main().catch((err) => {
  console.error('[SEED_CURATED] Fatal:', err);
  process.exit(1);
});

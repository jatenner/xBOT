/**
 * Seed the Brain System v2
 *
 * Populates brain_accounts from existing account tables and
 * brain_keywords with seed keywords across multiple domains.
 *
 * Safe to run multiple times (upserts).
 *
 * Usage: npx tsx scripts/ops/seed-brain-system.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db';

const LOG = '[seed-brain]';

// =============================================================================
// Seed keywords — broad, multi-domain
// =============================================================================

const SEED_KEYWORDS: { keyword: string; domain_hint: string }[] = [
  // Health (existing keywords, keep them)
  { keyword: 'circadian rhythm', domain_hint: 'health' },
  { keyword: 'sleep quality', domain_hint: 'health' },
  { keyword: 'cold exposure', domain_hint: 'health' },
  { keyword: 'intermittent fasting', domain_hint: 'health' },
  { keyword: 'zone 2 cardio', domain_hint: 'health' },
  { keyword: 'VO2 max', domain_hint: 'health' },
  { keyword: 'creatine', domain_hint: 'health' },
  { keyword: 'protein intake', domain_hint: 'health' },
  { keyword: 'gut health', domain_hint: 'health' },
  { keyword: 'blood sugar', domain_hint: 'health' },
  { keyword: 'ozempic', domain_hint: 'health' },
  { keyword: 'insulin resistance', domain_hint: 'health' },
  { keyword: 'supplements', domain_hint: 'health' },
  { keyword: 'magnesium', domain_hint: 'health' },
  { keyword: 'vitamin D', domain_hint: 'health' },
  { keyword: 'omega 3', domain_hint: 'health' },
  { keyword: 'longevity', domain_hint: 'health' },
  { keyword: 'healthspan', domain_hint: 'health' },
  { keyword: 'autophagy', domain_hint: 'health' },
  { keyword: 'sleep hygiene', domain_hint: 'health' },

  // Tech
  { keyword: 'AI agents', domain_hint: 'tech' },
  { keyword: 'open source', domain_hint: 'tech' },
  { keyword: 'machine learning', domain_hint: 'tech' },
  { keyword: 'startup funding', domain_hint: 'tech' },
  { keyword: 'SaaS growth', domain_hint: 'tech' },
  { keyword: 'developer tools', domain_hint: 'tech' },
  { keyword: 'GPT', domain_hint: 'tech' },
  { keyword: 'Claude', domain_hint: 'tech' },
  { keyword: 'coding', domain_hint: 'tech' },
  { keyword: 'tech layoffs', domain_hint: 'tech' },

  // Business / Finance
  { keyword: 'passive income', domain_hint: 'finance' },
  { keyword: 'investing', domain_hint: 'finance' },
  { keyword: 'side hustle', domain_hint: 'finance' },
  { keyword: 'stock market', domain_hint: 'finance' },
  { keyword: 'entrepreneurship', domain_hint: 'business' },
  { keyword: 'marketing strategy', domain_hint: 'business' },
  { keyword: 'personal brand', domain_hint: 'business' },
  { keyword: 'growth hacking', domain_hint: 'business' },
  { keyword: 'e-commerce', domain_hint: 'business' },
  { keyword: 'content creation', domain_hint: 'business' },

  // Personal Development
  { keyword: 'productivity', domain_hint: 'personal_dev' },
  { keyword: 'morning routine', domain_hint: 'personal_dev' },
  { keyword: 'habit stacking', domain_hint: 'personal_dev' },
  { keyword: 'focus', domain_hint: 'personal_dev' },
  { keyword: 'discipline', domain_hint: 'personal_dev' },
  { keyword: 'mental health', domain_hint: 'personal_dev' },
  { keyword: 'burnout', domain_hint: 'personal_dev' },
  { keyword: 'mindset', domain_hint: 'personal_dev' },
  { keyword: 'stoicism', domain_hint: 'personal_dev' },
  { keyword: 'journaling', domain_hint: 'personal_dev' },

  // Culture / Viral
  { keyword: 'hot take', domain_hint: 'culture' },
  { keyword: 'unpopular opinion', domain_hint: 'culture' },
  { keyword: 'controversial', domain_hint: 'culture' },
  { keyword: 'life advice', domain_hint: 'culture' },
  { keyword: 'dating', domain_hint: 'culture' },
  { keyword: 'relationships', domain_hint: 'culture' },
  { keyword: 'parenting', domain_hint: 'culture' },

  // Science
  { keyword: 'new study', domain_hint: 'science' },
  { keyword: 'neuroscience', domain_hint: 'science' },
  { keyword: 'psychology', domain_hint: 'science' },
  { keyword: 'climate change', domain_hint: 'science' },
  { keyword: 'space exploration', domain_hint: 'science' },

  // Crypto
  { keyword: 'bitcoin', domain_hint: 'crypto' },
  { keyword: 'ethereum', domain_hint: 'crypto' },
  { keyword: 'crypto market', domain_hint: 'crypto' },
  { keyword: 'DeFi', domain_hint: 'crypto' },

  // Sports / Entertainment
  { keyword: 'NFL', domain_hint: 'sports' },
  { keyword: 'NBA', domain_hint: 'sports' },
  { keyword: 'MMA', domain_hint: 'sports' },
  { keyword: 'movie review', domain_hint: 'entertainment' },
  { keyword: 'Netflix', domain_hint: 'entertainment' },

  // Humor / Engagement drivers
  { keyword: 'thread', domain_hint: 'other' },
  { keyword: 'ratio', domain_hint: 'other' },
  { keyword: 'worst take', domain_hint: 'other' },
];

async function main() {
  const supabase = getSupabaseClient();

  console.log(`${LOG} Starting brain system seed...`);

  // ==========================================================================
  // 1. Seed brain_accounts from existing tables
  // ==========================================================================
  let totalAccounts = 0;

  // From curated_accounts
  try {
    const { data: curated } = await supabase
      .from('curated_accounts')
      .select('username, follower_count, display_name, health_topics')
      .eq('enabled', true);

    if (curated && curated.length > 0) {
      const accounts = curated.map(a => ({
        username: a.username.toLowerCase().replace(/^@/, ''),
        display_name: a.display_name,
        followers_count: a.follower_count,
        primary_domain: 'health',
        domain_confidence: 0.9,
        discovery_method: 'seed',
        tier: 'B' as const,
        scrape_priority: 0.6,
        is_active: true,
      }));

      const { data } = await supabase
        .from('brain_accounts')
        .upsert(accounts, { onConflict: 'username', ignoreDuplicates: true })
        .select('username');

      const count = data?.length ?? 0;
      totalAccounts += count;
      console.log(`${LOG} Seeded ${count} accounts from curated_accounts`);
    }
  } catch (e: any) {
    console.warn(`${LOG} curated_accounts seed error:`, e.message);
  }

  // From vi_scrape_targets
  try {
    const { data: targets } = await supabase
      .from('vi_scrape_targets')
      .select('username, followers_count, bio_text')
      .eq('is_active', true);

    if (targets && targets.length > 0) {
      const accounts = targets.map(a => ({
        username: a.username.toLowerCase().replace(/^@/, ''),
        followers_count: a.followers_count,
        bio_text: a.bio_text,
        discovery_method: 'seed',
        tier: 'C' as const,
        scrape_priority: 0.4,
        is_active: true,
      }));

      const { data } = await supabase
        .from('brain_accounts')
        .upsert(accounts, { onConflict: 'username', ignoreDuplicates: true })
        .select('username');

      const count = data?.length ?? 0;
      totalAccounts += count;
      console.log(`${LOG} Seeded ${count} accounts from vi_scrape_targets`);
    }
  } catch (e: any) {
    console.warn(`${LOG} vi_scrape_targets seed error:`, e.message);
  }

  // From discovered_accounts
  try {
    const { data: discovered } = await supabase
      .from('discovered_accounts')
      .select('username, follower_count');

    if (discovered && discovered.length > 0) {
      const accounts = discovered.map(a => ({
        username: a.username.toLowerCase().replace(/^@/, ''),
        followers_count: a.follower_count,
        discovery_method: 'seed',
        tier: 'C' as const,
        scrape_priority: 0.3,
        is_active: true,
      }));

      const { data } = await supabase
        .from('brain_accounts')
        .upsert(accounts, { onConflict: 'username', ignoreDuplicates: true })
        .select('username');

      const count = data?.length ?? 0;
      totalAccounts += count;
      console.log(`${LOG} Seeded ${count} accounts from discovered_accounts`);
    }
  } catch (e: any) {
    console.warn(`${LOG} discovered_accounts seed error:`, e.message);
  }

  // Peer accounts (hardcoded in peer_scraper)
  const peerAccounts = [
    { username: 'hubermanlab', domain: 'health' },
    { username: 'rhondapatrick', domain: 'health' },
    { username: 'bengreenfield', domain: 'health' },
    { username: 'drmarkhyman', domain: 'health' },
    { username: 'davidasinclair', domain: 'health' },
    { username: 'foundmyfitness', domain: 'health' },
    { username: 'lairdhamillon', domain: 'health' },
    { username: 'drdavinaguilera', domain: 'health' },
  ];

  try {
    const accounts = peerAccounts.map(p => ({
      username: p.username.toLowerCase(),
      primary_domain: p.domain,
      domain_confidence: 1.0,
      discovery_method: 'seed',
      tier: 'A' as const,
      scrape_priority: 0.8,
      is_active: true,
    }));

    const { data } = await supabase
      .from('brain_accounts')
      .upsert(accounts, { onConflict: 'username', ignoreDuplicates: true })
      .select('username');

    const count = data?.length ?? 0;
    totalAccounts += count;
    console.log(`${LOG} Seeded ${count} peer accounts`);
  } catch (e: any) {
    console.warn(`${LOG} peer accounts seed error:`, e.message);
  }

  console.log(`${LOG} Total accounts seeded: ${totalAccounts}`);

  // ==========================================================================
  // 2. Seed brain_keywords
  // ==========================================================================
  try {
    const keywords = SEED_KEYWORDS.map(kw => ({
      keyword: kw.keyword.toLowerCase().trim(),
      source: 'seed',
      domain_hint: kw.domain_hint,
      priority: 0.5,
      is_active: true,
    }));

    const { data } = await supabase
      .from('brain_keywords')
      .upsert(keywords, { onConflict: 'keyword', ignoreDuplicates: true })
      .select('keyword');

    const count = data?.length ?? 0;
    console.log(`${LOG} Seeded ${count} keywords across ${new Set(SEED_KEYWORDS.map(k => k.domain_hint)).size} domains`);
  } catch (e: any) {
    console.warn(`${LOG} keyword seed error:`, e.message);
  }

  // ==========================================================================
  // 3. Ensure self_model_state singleton exists
  // ==========================================================================
  try {
    const { data: existing } = await supabase
      .from('self_model_state')
      .select('id')
      .eq('id', 1)
      .single();

    if (!existing) {
      await supabase.from('self_model_state').insert({ id: 1, follower_count: 0, growth_phase: 'cold_start' });
      console.log(`${LOG} Created self_model_state singleton`);
    } else {
      console.log(`${LOG} self_model_state already exists`);
    }
  } catch (e: any) {
    console.warn(`${LOG} self_model_state check:`, e.message);
  }

  // ==========================================================================
  // Summary
  // ==========================================================================
  const { count: accountCount } = await supabase.from('brain_accounts').select('id', { count: 'exact', head: true });
  const { count: keywordCount } = await supabase.from('brain_keywords').select('id', { count: 'exact', head: true }).eq('is_active', true);

  console.log(`\n${LOG} ✅ Brain system seeded successfully!`);
  console.log(`${LOG}   Accounts: ${accountCount ?? 0}`);
  console.log(`${LOG}   Keywords: ${keywordCount ?? 0}`);
  console.log(`${LOG}   Self-model: initialized`);
  console.log(`\n${LOG} To enable brain feeds, set BRAIN_FEEDS_ENABLED=true`);
}

main().catch(err => {
  console.error(`${LOG} Fatal error:`, err);
  process.exit(1);
});

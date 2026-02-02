#!/usr/bin/env tsx
/**
 * 🌾 Harvest Public-Only Loop
 * 
 * Runs ONLY public queries in a loop until strict_count >= 25.
 * Uses P1_STORE_ALL_STATUS_URLS=true to boost yield.
 * 
 * Usage:
 *   P1_STORE_ALL_STATUS_URLS=true pnpm exec tsx scripts/ops/harvest-public-only-loop.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { realTwitterDiscovery } from '../../src/ai/realTwitterDiscovery';

const HEALTH_KEYWORDS = '(health OR wellness OR fitness OR nutrition OR diet OR protein OR sleep OR exercise OR workout OR running OR lifting OR cardio OR metabolism OR longevity OR supplement OR creatine OR testosterone OR cortisol OR inflammation OR recovery OR fasting OR glucose OR insulin OR gut OR microbiome OR immune OR vitamin OR mineral OR hydration)';
const SPAM_EXCLUSION = ' -airdrop -giveaway -crypto -nft -betting -casino -OnlyFans -porn';
const POLITICS_EXCLUSION = ' -trump -biden -election -gaza -ukraine -war -breaking -celebrity -shooting -killed -died';

const PUBLIC_QUERIES = [
  { 
    label: 'PUBLIC_HEALTH_LOW', 
    minLikes: 300, 
    maxReplies: 150, 
    maxAgeHours: 12,
    query: `${HEALTH_KEYWORDS} min_faves:300 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}`,
    discovery_source: 'public_search_health_low' 
  },
  { 
    label: 'PUBLIC_FITNESS_LOW', 
    minLikes: 300, 
    maxReplies: 150, 
    maxAgeHours: 12,
    query: `(fitness OR workout OR exercise OR gym OR running) min_faves:300 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}`,
    discovery_source: 'public_search_fitness_low' 
  },
  { 
    label: 'PUBLIC_HEALTH_MED', 
    minLikes: 1000, 
    maxReplies: 200, 
    maxAgeHours: 24,
    query: `${HEALTH_KEYWORDS} min_faves:1000 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}`,
    discovery_source: 'public_search_health_med' 
  },
];

async function getPublicCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%')
    .neq('discovery_source', 'public_search_manual')
    .eq('replied_to', false)
    .gte('created_at', threeHoursAgo);
  return count || 0;
}

async function runPublicQuery(queryConfig: typeof PUBLIC_QUERIES[0]): Promise<{ urlsFound: number; stored: number }> {
  const { withBrowserLock, BrowserPriority } = await import('../../src/browser/BrowserSemaphore');
  
  const opportunities = await withBrowserLock(
    `harvest_public_${queryConfig.label}`,
    BrowserPriority.HARVESTING,
    async () => {
      const opps = await realTwitterDiscovery.findViralTweetsViaSearch(
        queryConfig.minLikes,
        queryConfig.maxReplies,
        queryConfig.label,
        queryConfig.maxAgeHours,
        queryConfig.query
      );
      
      // Add discovery_source to all opportunities
      return opps.map((opp: any) => ({
        ...opp,
        discovery_source: queryConfig.discovery_source,
      }));
    }
  );
  
  const urlsFound = opportunities.length;
  
  if (opportunities.length > 0) {
    await realTwitterDiscovery.storeOpportunities(opportunities);
  }
  
  // Wait for DB writes
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return { urlsFound, stored: opportunities.length };
}

async function main() {
  console.log('🌾 Harvest Public-Only Loop');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Set P1_STORE_ALL_STATUS_URLS if not already set
  if (!process.env.P1_STORE_ALL_STATUS_URLS) {
    process.env.P1_STORE_ALL_STATUS_URLS = 'true';
    console.log('[CONFIG] P1_STORE_ALL_STATUS_URLS=true (storing all status URLs, skipping AI filter)');
  }
  
  process.env.EXECUTION_MODE = 'control';
  process.env.HARVESTING_ENABLED = 'true';
  process.env.P1_MODE = 'true';
  process.env.P1_TARGET_MAX_AGE_HOURS = '12';
  
  const TARGET_COUNT = 25;
  const MAX_CYCLES = 30;
  
  let currentCount = await getPublicCount();
  console.log(`Initial public candidates: ${currentCount}`);
  
  if (currentCount >= TARGET_COUNT) {
    console.log(`✅ Already have ${currentCount} >= ${TARGET_COUNT} public candidates`);
    process.exit(0);
  }
  
  let cycleNum = 0;
  let totalUrlsFound = 0;
  let totalStored = 0;
  let queryIdx = 0;
  
  while (currentCount < TARGET_COUNT && cycleNum < MAX_CYCLES) {
    cycleNum++;
    const queryConfig = PUBLIC_QUERIES[queryIdx % PUBLIC_QUERIES.length];
    queryIdx++;
    
    console.log(`\n[Cycle ${cycleNum}/${MAX_CYCLES}] Running ${queryConfig.label}...`);
    console.log(`  Query: ${queryConfig.query.substring(0, 80)}...`);
    
    try {
      const { urlsFound, stored } = await runPublicQuery(queryConfig);
      totalUrlsFound += urlsFound;
      totalStored += stored;
      
      console.log(`  [PUBLIC_EXTRACT] urls_found=${urlsFound}`);
      console.log(`  [PUBLIC_STORE] stored=${stored}`);
      
      // Check new count
      await new Promise(resolve => setTimeout(resolve, 1000));
      currentCount = await getPublicCount();
      console.log(`  Current strict_count: ${currentCount}`);
      
      if (currentCount >= TARGET_COUNT) {
        console.log(`\n✅ SUCCESS: Reached target (${currentCount} >= ${TARGET_COUNT})`);
        break;
      }
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }
    
    // Delay between cycles
    if (cycleNum < MAX_CYCLES) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  const avgUrlsFound = cycleNum > 0 ? (totalUrlsFound / cycleNum).toFixed(1) : '0';
  const avgStored = cycleNum > 0 ? (totalStored / cycleNum).toFixed(1) : '0';
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`📊 Summary:`);
  console.log(`   Cycles run: ${cycleNum}`);
  console.log(`   Urls found (avg): ${avgUrlsFound}`);
  console.log(`   Stored (avg): ${avgStored}`);
  console.log(`   Final strict_count: ${currentCount}`);
  console.log(`═══════════════════════════════════════════════════════════`);
  
  // Run check-public-count.ts
  console.log(`\n[VERIFY] Running check-public-count.ts...`);
  const { execSync } = await import('child_process');
  try {
    const output = execSync('pnpm exec tsx scripts/ops/check-public-count.ts', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    console.log(output);
  } catch (error: any) {
    const output = (error.stdout || error.stderr || '').toString();
    console.log(output);
  }
  
  if (currentCount < TARGET_COUNT) {
    console.log(`\n⚠️  WARNING: Stopped after ${MAX_CYCLES} cycles`);
    console.log(`   Final count: ${currentCount} (target: ${TARGET_COUNT})`);
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

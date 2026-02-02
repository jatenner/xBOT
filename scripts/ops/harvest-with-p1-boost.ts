#!/usr/bin/env tsx
/**
 * 🌾 Harvest With P1 Boost
 * 
 * Runs harvest cycles with P1_STORE_ALL_STATUS_URLS=true to boost yield.
 * Skips AI filtering and stores all extracted status URLs.
 * 
 * Usage:
 *   pnpm exec tsx scripts/ops/harvest-with-p1-boost.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

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

async function runHarvestCycle(cycleNum: number): Promise<number> {
  console.log(`\n[Cycle ${cycleNum}] Running harvest with P1_STORE_ALL_STATUS_URLS=true...`);
  
  const { execSync } = await import('child_process');
  try {
    // Set P1_STORE_ALL_STATUS_URLS=true
    process.env.P1_STORE_ALL_STATUS_URLS = 'true';
    process.env.EXECUTION_MODE = 'control';
    process.env.HARVESTING_ENABLED = 'true';
    process.env.P1_MODE = 'true';
    process.env.P1_TARGET_MAX_AGE_HOURS = '12';
    
    const output = execSync(
      'pnpm exec tsx scripts/ops/run-harvester-local-prod.ts',
      { 
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, P1_STORE_ALL_STATUS_URLS: 'true' }
      }
    );
    
    // Extract stored count from output
    const storedMatch = output.match(/stored_public_candidates=(\d+)/);
    const stored = storedMatch ? parseInt(storedMatch[1], 10) : 0;
    
    // Extract PUBLIC_EXTRACT and PUBLIC_STORE logs
    const extractMatch = output.match(/\[PUBLIC_EXTRACT\] urls_found=(\d+)/);
    const storeMatch = output.match(/\[PUBLIC_STORE\] attempted=(\d+) stored=(\d+) skipped=(\d+) errors=(\d+)/);
    
    if (extractMatch) {
      console.log(`  [PUBLIC_EXTRACT] urls_found=${extractMatch[1]}`);
    }
    if (storeMatch) {
      console.log(`  [PUBLIC_STORE] attempted=${storeMatch[1]} stored=${storeMatch[2]} skipped=${storeMatch[3]} errors=${storeMatch[4]}`);
    }
    
    return stored;
  } catch (error: any) {
    const output = (error.stdout || error.stderr || error.message || '').toString();
    const extractMatch = output.match(/\[PUBLIC_EXTRACT\] urls_found=(\d+)/);
    const storeMatch = output.match(/\[PUBLIC_STORE\] attempted=(\d+) stored=(\d+) skipped=(\d+) errors=(\d+)/);
    
    if (extractMatch) {
      console.log(`  [PUBLIC_EXTRACT] urls_found=${extractMatch[1]}`);
    }
    if (storeMatch) {
      console.log(`  [PUBLIC_STORE] attempted=${storeMatch[1]} stored=${storeMatch[2]} skipped=${storeMatch[3]} errors=${storeMatch[4]}`);
    }
    
    const storedMatch = output.match(/stored_public_candidates=(\d+)/);
    return storedMatch ? parseInt(storedMatch[1], 10) : 0;
  }
}

async function main() {
  console.log('🌾 Harvest With P1 Boost (P1_STORE_ALL_STATUS_URLS=true)');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const TARGET_COUNT = 25;
  const MAX_CYCLES = 20;
  
  let currentCount = await getPublicCount();
  console.log(`Initial public candidates: ${currentCount}`);
  
  if (currentCount >= TARGET_COUNT) {
    console.log(`✅ Already have ${currentCount} >= ${TARGET_COUNT} public candidates`);
    process.exit(0);
  }
  
  let cycleNum = 1;
  let totalStored = 0;
  let totalUrlsFound = 0;
  let totalStoredSum = 0;
  
  while (currentCount < TARGET_COUNT && cycleNum <= MAX_CYCLES) {
    console.log(`\n[Cycle ${cycleNum}/${MAX_CYCLES}] Current count: ${currentCount}, Target: ${TARGET_COUNT}`);
    
    const stored = await runHarvestCycle(cycleNum);
    totalStored += stored;
    totalStoredSum += stored;
    
    // Wait for DB writes
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check new count
    currentCount = await getPublicCount();
    console.log(`[Cycle ${cycleNum}] After harvest: ${currentCount} public candidates (stored this cycle: ${stored})`);
    
    if (currentCount >= TARGET_COUNT) {
      console.log(`\n✅ SUCCESS: Reached target (${currentCount} >= ${TARGET_COUNT})`);
      console.log(`   Total stored across cycles: ${totalStored}`);
      break;
    }
    
    cycleNum++;
    
    // Delay between cycles
    if (cycleNum <= MAX_CYCLES) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  const avgStored = cycleNum > 1 ? (totalStoredSum / (cycleNum - 1)).toFixed(1) : '0';
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`📊 Summary:`);
  console.log(`   Cycles run: ${cycleNum - 1}`);
  console.log(`   Total stored: ${totalStored}`);
  console.log(`   Avg stored per cycle: ${avgStored}`);
  console.log(`   Final strict_count: ${currentCount}`);
  console.log(`═══════════════════════════════════════════════════════════`);
  
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

#!/usr/bin/env tsx
/**
 * 🌾 Harvest Until Public Ready
 * 
 * Runs harvest cycles until we have >=25 public_search_* candidates
 * or after 20 cycles max.
 * 
 * Usage:
 *   pnpm exec tsx scripts/ops/harvest-until-public-ready.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function getPublicCount(): Promise<number> {
  const supabase = getSupabaseClient();
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%')
    .eq('replied_to', false)
    .gte('created_at', twoHoursAgo);
  return count || 0;
}

async function runHarvestCycle(cycleNum: number): Promise<number> {
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`Cycle ${cycleNum}: Running harvest...`);
  console.log(`═══════════════════════════════════════════════════════════\n`);
  
  const { execSync } = await import('child_process');
  try {
    const output = execSync(
      'pnpm exec tsx scripts/ops/run-harvester-local-prod.ts',
      { 
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
        maxBuffer: 10 * 1024 * 1024
      }
    );
    
    // Extract stored count from output
    const storedMatch = output.match(/stored_public_candidates=(\d+)/);
    const stored = storedMatch ? parseInt(storedMatch[1], 10) : 0;
    
    // Print key lines (last 30 lines)
    const lines = output.split('\n').filter(l => l.trim());
    const keyLines = lines.slice(-30);
    keyLines.forEach(line => {
      if (line.includes('[HARVEST]') || line.includes('stored_public_candidates') || line.includes('✅') || line.includes('⚠️')) {
        console.log(line);
      }
    });
    
    return stored;
  } catch (error: any) {
    const output = (error.stdout || error.stderr || error.message || '').toString();
    const lines = output.split('\n').filter(l => l.trim());
    const keyLines = lines.slice(-20);
    keyLines.forEach(line => {
      if (line.includes('[HARVEST]') || line.includes('ERROR') || line.includes('error') || line.includes('❌')) {
        console.log(line);
      }
    });
    
    // Extract stored count even from error output
    const storedMatch = output.match(/stored_public_candidates=(\d+)/);
    return storedMatch ? parseInt(storedMatch[1], 10) : 0;
  }
}

async function main() {
  console.log('🌾 Harvest Until Public Ready');
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
  
  while (currentCount < TARGET_COUNT && cycleNum <= MAX_CYCLES) {
    console.log(`\n[Cycle ${cycleNum}/${MAX_CYCLES}] Current count: ${currentCount}, Target: ${TARGET_COUNT}`);
    
    const stored = await runHarvestCycle(cycleNum);
    totalStored += stored;
    
    // Wait a moment for DB writes
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check new count
    currentCount = await getPublicCount();
    console.log(`\n[Cycle ${cycleNum}] After harvest: ${currentCount} public candidates (stored this cycle: ${stored})`);
    
    if (currentCount >= TARGET_COUNT) {
      console.log(`\n✅ SUCCESS: Reached target (${currentCount} >= ${TARGET_COUNT})`);
      console.log(`   Total stored across cycles: ${totalStored}`);
      process.exit(0);
    }
    
    cycleNum++;
    
    // Small delay between cycles
    if (cycleNum <= MAX_CYCLES) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (currentCount < TARGET_COUNT) {
    console.log(`\n⚠️  WARNING: Stopped after ${MAX_CYCLES} cycles`);
    console.log(`   Final count: ${currentCount} (target: ${TARGET_COUNT})`);
    console.log(`   Total stored: ${totalStored}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

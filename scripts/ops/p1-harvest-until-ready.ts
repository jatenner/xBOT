#!/usr/bin/env tsx
/**
 * P1 Harvest Loop - Build public candidates until ready
 * 
 * Runs harvest cycles until we have at least 25 unreplied public_search_* 
 * opportunities created within the last 2 hours.
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

const TARGET_COUNT = 25;
const MAX_AGE_HOURS = 2;
const MAX_CYCLES = 10;

async function checkPublicCandidates(): Promise<number> {
  const supabase = getSupabaseClient();
  const twoHoursAgo = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
  
  const { count, error } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%')
    .eq('replied_to', false)
    .gte('created_at', twoHoursAgo);
  
  if (error) {
    throw new Error(`Failed to check candidates: ${error.message}`);
  }
  
  return count || 0;
}

async function runHarvestCycle(): Promise<void> {
  const { execSync } = await import('child_process');
  
  console.log('\n🌾 Running harvest cycle...');
  try {
    const output = execSync(
      'railway run --service serene-cat pnpm exec tsx scripts/ops/run-harvester-single-cycle.ts',
      {
        stdio: 'pipe',
        encoding: 'utf8',
        timeout: 300000, // 5 minutes
        cwd: process.cwd(),
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      }
    );
    
    // Print key lines
    const lines = output.split('\n');
    const keyLines = lines.filter(line => 
      line.includes('[HARVESTER') || 
      line.includes('public_search') || 
      line.includes('stored') ||
      line.includes('opportunities') ||
      line.includes('logged_in')
    );
    
    if (keyLines.length > 0) {
      console.log('Harvest output:');
      keyLines.slice(0, 20).forEach(line => console.log(`  ${line}`));
    } else {
      console.log('  (No key output lines found)');
    }
  } catch (error: any) {
    const output = (error.stdout || error.stderr || error.message || '').toString();
    const lines = output.split('\n');
    const keyLines = lines.filter(line => 
      line.includes('[HARVESTER') || 
      line.includes('public_search') || 
      line.includes('stored') ||
      line.includes('opportunities') ||
      line.includes('logged_in') ||
      line.includes('error') ||
      line.includes('ERROR')
    );
    
    if (keyLines.length > 0) {
      console.log('Harvest output (may have errors):');
      keyLines.slice(0, 20).forEach(line => console.log(`  ${line}`));
    } else {
      console.log('  (Harvest cycle completed, checking count...)');
    }
    
    // Don't throw - continue checking count
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🌾 P1 Harvest Loop - Building Public Candidates');
  console.log('═══════════════════════════════════════════════════════════\n');
  console.log(`Target: ${TARGET_COUNT} unreplied public_search_* opportunities (last ${MAX_AGE_HOURS}h)`);
  console.log(`Max cycles: ${MAX_CYCLES}\n`);

  let cycle = 0;
  let currentCount = await checkPublicCandidates();
  
  console.log(`📊 Initial count: ${currentCount} public_search_* opportunities\n`);

  while (currentCount < TARGET_COUNT && cycle < MAX_CYCLES) {
    cycle++;
    console.log(`\n🔄 Cycle ${cycle}/${MAX_CYCLES}`);
    
    await runHarvestCycle();
    
    // Wait a moment for DB to update
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    currentCount = await checkPublicCandidates();
    console.log(`\n📊 Current count: ${currentCount}/${TARGET_COUNT}`);
    
    if (currentCount >= TARGET_COUNT) {
      console.log(`\n✅ TARGET REACHED: ${currentCount} public_search_* opportunities`);
      break;
    }
    
    // Wait between cycles
    if (cycle < MAX_CYCLES) {
      console.log(`⏳ Waiting 10s before next cycle...`);
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }

  if (currentCount < TARGET_COUNT) {
    console.log(`\n⚠️  Stopped after ${cycle} cycles: ${currentCount}/${TARGET_COUNT} opportunities`);
    process.exit(1);
  } else {
    console.log(`\n✅ SUCCESS: ${currentCount} public_search_* opportunities ready`);
    
    // Show breakdown
    const supabase = getSupabaseClient();
    const twoHoursAgo = new Date(Date.now() - MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();
    
    const { data: breakdown } = await supabase
      .from('reply_opportunities')
      .select('discovery_source')
      .like('discovery_source', 'public_search_%')
      .eq('replied_to', false)
      .gte('created_at', twoHoursAgo);
    
    if (breakdown) {
      const counts: Record<string, number> = {};
      breakdown.forEach(opp => {
        counts[opp.discovery_source] = (counts[opp.discovery_source] || 0) + 1;
      });
      
      console.log('\n📊 Breakdown by discovery_source:');
      Object.entries(counts).forEach(([source, count]) => {
        console.log(`   ${source}: ${count}`);
      });
    }
    
    process.exit(0);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

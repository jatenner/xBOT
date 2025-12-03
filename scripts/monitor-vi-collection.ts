#!/usr/bin/env tsx
/**
 * Monitor VI collection progress and ensure it keeps running
 * Auto-triggers collection if it stalls until target (10k-100k tweets) is reached
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

const TARGET_MIN = 10000;  // 10k tweets minimum
const TARGET_MAX = 100000; // 100k tweets maximum
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour
const STALL_THRESHOLD_HOURS = 6; // If no new tweets in 6 hours, trigger collection

async function monitorCollection() {
  console.log('📊 VI Collection Monitor Started');
  console.log(`   Target: ${TARGET_MIN.toLocaleString()} - ${TARGET_MAX.toLocaleString()} tweets\n`);

  while (true) {
    try {
      const supabase = getSupabaseClient();

      // Get current count
      const { count: totalCount } = await supabase
        .from('vi_collected_tweets')
        .select('*', { count: 'exact', head: true });

      const currentCount = totalCount || 0;
      const progress = Math.min(100, (currentCount / TARGET_MIN) * 100);

      console.log(`\n⏰ ${new Date().toLocaleString()}`);
      console.log(`📈 Progress: ${currentCount.toLocaleString()} / ${TARGET_MIN.toLocaleString()} tweets (${progress.toFixed(1)}%)`);

      // Check if we've reached target
      if (currentCount >= TARGET_MIN) {
        console.log(`✅ Target reached! (${currentCount.toLocaleString()} tweets)`);
        
        if (currentCount >= TARGET_MAX) {
          console.log(`🎉 Maximum target reached! (${currentCount.toLocaleString()} tweets)`);
          console.log('   Collection complete - monitor can stop');
          break;
        }
        
        console.log(`   Continuing until ${TARGET_MAX.toLocaleString()} tweets...\n`);
      }

      // Check for stalls (no new tweets in last N hours)
      const stallThreshold = new Date(Date.now() - STALL_THRESHOLD_HOURS * 60 * 60 * 1000);
      const { count: recentCount } = await supabase
        .from('vi_collected_tweets')
        .select('*', { count: 'exact', head: true })
        .gte('scraped_at', stallThreshold.toISOString());

      if (recentCount === 0 && currentCount < TARGET_MIN) {
        console.log(`⚠️  Collection stalled - no tweets in last ${STALL_THRESHOLD_HOURS} hours`);
        console.log(`   Triggering manual collection...`);
        
        // Trigger collection via job manager if possible
        try {
          // Try to trigger via script
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);
          
          await execAsync('pnpm tsx scripts/trigger-vi-collection.ts');
          console.log(`   ✅ Collection triggered`);
        } catch (error: any) {
          console.error(`   ❌ Failed to trigger: ${error.message}`);
        }
      } else if (recentCount && recentCount > 0) {
        console.log(`   ✅ Recent activity: ${recentCount} tweets in last ${STALL_THRESHOLD_HOURS}h`);
      }

      // Wait for next check
      console.log(`   Next check in 1 hour...\n`);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));

    } catch (error: any) {
      console.error(`❌ Monitor error: ${error.message}`);
      console.log(`   Retrying in 1 hour...\n`);
      await new Promise(resolve => setTimeout(resolve, CHECK_INTERVAL_MS));
    }
  }
}

// Run monitor
monitorCollection().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});





#!/usr/bin/env tsx
/**
 * Analyze system capacity for VI collection
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function analyzeSystemCapacity() {
  const supabase = getSupabaseClient();

  console.log('🔍 Analyzing system capacity for VI collection...\n');

  try {
    // Check environment variables
    const viEnabled = process.env.VISUAL_INTELLIGENCE_ENABLED === 'true';
    const viConcurrency = Number.parseInt(process.env.VI_SCRAPER_CONCURRENCY || '8', 10);
    const browserMaxContexts = Number.parseInt(process.env.BROWSER_MAX_CONTEXTS || '2', 10);
    const browserMaxOps = Number.parseInt(process.env.BROWSER_MAX_OPERATIONS || '25', 10);

    console.log('⚙️  SYSTEM CONFIGURATION:\n');
    console.log(`  VISUAL_INTELLIGENCE_ENABLED: ${viEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`  VI_SCRAPER_CONCURRENCY: ${viConcurrency} accounts in parallel`);
    console.log(`  BROWSER_MAX_CONTEXTS: ${browserMaxContexts} concurrent contexts`);
    console.log(`  BROWSER_MAX_OPERATIONS: ${browserMaxOps} ops per context\n`);

    // Check active accounts
    const { data: targets, error: targetsError } = await supabase
      .from('vi_scrape_targets')
      .select('username, is_active')
      .eq('is_active', true);

    if (targetsError) throw targetsError;
    const activeAccounts = (targets || []).length;

    // Calculate job schedule
    const peerScraperInterval = 8 * 60; // 8 hours in minutes
    const runsPerDay = (24 * 60) / peerScraperInterval; // 3 runs/day
    const runsPerWeek = runsPerDay * 7; // 21 runs/week

    // Estimate time per account
    const timePerAccount = 30; // seconds (conservative: navigation + scroll + extract)
    const totalTimePerRun = (activeAccounts / viConcurrency) * timePerAccount; // seconds
    const totalTimePerRunMinutes = totalTimePerRun / 60;

    // Check current job load
    console.log('📅 JOB SCHEDULE ANALYSIS:\n');
    console.log('  Peer Scraper (VI collection):');
    console.log(`    - Frequency: Every 8 hours (${runsPerDay} runs/day, ${runsPerWeek} runs/week)`);
    console.log(`    - Active accounts: ${activeAccounts}`);
    console.log(`    - Concurrency: ${viConcurrency} parallel`);
    console.log(`    - Estimated time per run: ~${Math.round(totalTimePerRunMinutes)} minutes`);
    console.log(`    - Time between runs: 8 hours (480 minutes)`);
    console.log(`    - Capacity utilization: ${((totalTimePerRunMinutes / 480) * 100).toFixed(1)}%\n`);

    // Check other browser jobs
    console.log('  Other Browser Jobs:');
    console.log('    - Metrics scraper: Every 20 minutes');
    console.log('    - Reply metrics: Every 30 minutes');
    console.log('    - News scraping: Every 12 hours');
    console.log('    - Viral scraper: Every 4 hours');
    console.log('    - Peer scraper: Every 8 hours (includes VI)\n');

    // Calculate browser pool usage
    const maxConcurrentJobs = browserMaxContexts;
    const viJobDuration = totalTimePerRunMinutes;
    const otherJobsPerHour = 3 + 2 + 0.08 + 0.25; // metrics + reply_metrics + news + viral
    const avgOtherJobDuration = 5; // minutes average

    const hourlyBrowserUsage = (otherJobsPerHour * avgOtherJobDuration) + (viJobDuration / 8); // VI runs every 8 hours
    const hourlyCapacity = maxConcurrentJobs * 60; // contexts * minutes

    console.log('🌐 BROWSER POOL CAPACITY:\n');
    console.log(`  Max contexts: ${browserMaxContexts}`);
    console.log(`  Estimated hourly usage: ~${hourlyBrowserUsage.toFixed(1)} context-minutes`);
    console.log(`  Hourly capacity: ${hourlyCapacity} context-minutes`);
    console.log(`  Utilization: ${((hourlyBrowserUsage / hourlyCapacity) * 100).toFixed(1)}%\n`);

    // Check if we can increase collection
    const canIncreaseFrequency = totalTimePerRunMinutes < 60; // Less than 1 hour per run
    const canIncreaseAccounts = activeAccounts < 200; // Room for more accounts
    const canIncreaseConcurrency = viConcurrency < browserMaxContexts * 2; // Can use more contexts

    console.log('💡 CAPACITY ASSESSMENT:\n');
    
    if (canIncreaseFrequency) {
      console.log('  ✅ Can increase collection frequency:');
      console.log(`     Current: 8 hours (${((totalTimePerRunMinutes / 480) * 100).toFixed(1)}% utilization)`);
      console.log(`     Could run: Every 4 hours (still < 50% utilization)`);
      console.log(`     Would collect: ~${runsPerWeek * 2} runs/week (${runsPerWeek * 2 * activeAccounts * 5} tweets/week)\n`);
    } else {
      console.log('  ⚠️  Collection frequency is optimal (high utilization)\n');
    }

    if (canIncreaseAccounts) {
      console.log('  ✅ Can add more accounts:');
      console.log(`     Current: ${activeAccounts} accounts`);
      console.log(`     Could add: Up to 200 accounts (${200 - activeAccounts} more)`);
      console.log(`     Would collect: ~${runsPerWeek * 200 * 5} tweets/week\n`);
    } else {
      console.log('  ⚠️  Account count is at recommended limit\n');
    }

    if (canIncreaseConcurrency) {
      console.log('  ✅ Can increase concurrency:');
      console.log(`     Current: ${viConcurrency} parallel`);
      console.log(`     Could use: Up to ${browserMaxContexts * 2} parallel`);
      console.log(`     Would speed up: ~${((browserMaxContexts * 2) / viConcurrency).toFixed(1)}x faster\n`);
    } else {
      console.log('  ⚠️  Concurrency is at safe limit\n');
    }

    // Recommendations
    console.log('📈 RECOMMENDATIONS:\n');
    
    if (!viEnabled) {
      console.log('1. ⚠️  CRITICAL: Enable VI system');
      console.log('   Set VISUAL_INTELLIGENCE_ENABLED=true in .env\n');
    }

    if (viEnabled && canIncreaseFrequency) {
      console.log('2. ✅ Increase collection frequency:');
      console.log('   Change peer_scraper interval from 8 hours to 4 hours');
      console.log('   Would double collection rate with minimal impact\n');
    }

    if (viEnabled && canIncreaseAccounts && activeAccounts < 150) {
      console.log('3. ✅ Add more accounts:');
      console.log('   System can handle up to 200 accounts');
      console.log('   More accounts = more diverse data\n');
    }

    if (viEnabled && canIncreaseConcurrency && viConcurrency < 12) {
      console.log('4. ✅ Increase concurrency:');
      console.log(`   Set VI_SCRAPER_CONCURRENCY=12 (current: ${viConcurrency})`);
      console.log('   Would speed up collection without overloading\n');
    }

    if (viEnabled) {
      const currentWeekly = runsPerWeek * activeAccounts * 5; // 5 tweets per account per run
      const optimizedWeekly = (runsPerWeek * 2) * Math.min(activeAccounts + 50, 200) * 5;
      
      console.log('5. 📊 PROJECTED COLLECTION:\n');
      console.log(`   Current (if enabled): ~${currentWeekly} tweets/week`);
      console.log(`   Optimized: ~${optimizedWeekly} tweets/week`);
      console.log(`   Improvement: ${((optimizedWeekly / currentWeekly - 1) * 100).toFixed(0)}% more\n`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

analyzeSystemCapacity();


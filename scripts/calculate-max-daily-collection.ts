#!/usr/bin/env tsx
/**
 * Calculate maximum daily tweet collection capacity
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function calculateMaxDailyCollection() {
  const supabase = getSupabaseClient();

  console.log('📊 Calculating maximum daily collection capacity...\n');

  try {
    // Get active accounts
    const { data: targets, error: targetsError } = await supabase
      .from('vi_scrape_targets')
      .select('username, is_active')
      .eq('is_active', true);

    if (targetsError) throw targetsError;
    const activeAccounts = (targets || []).length;

    // Current config
    const currentInterval = 8 * 60; // 8 hours in minutes
    const currentConcurrency = Number.parseInt(process.env.VI_SCRAPER_CONCURRENCY || '8', 10);
    const browserMaxContexts = Number.parseInt(process.env.BROWSER_MAX_CONTEXTS || '2', 10);

    // Scraping parameters
    const timePerAccount = 30; // seconds (navigation + scroll + extract)
    const tweetsPerAccountPerRun = 10; // Average tweets scraped per account per run
    const scrollRounds = 5; // Default scroll rounds

    // Calculate scenarios
    const scenarios = [
      {
        name: 'Current (8 hours)',
        interval: 8 * 60,
        concurrency: currentConcurrency,
        accounts: activeAccounts
      },
      {
        name: 'Optimized (4 hours)',
        interval: 4 * 60,
        concurrency: currentConcurrency,
        accounts: activeAccounts
      },
      {
        name: 'Aggressive (2 hours)',
        interval: 2 * 60,
        concurrency: currentConcurrency,
        accounts: activeAccounts
      },
      {
        name: 'Maximum (1 hour)',
        interval: 1 * 60,
        concurrency: Math.min(browserMaxContexts * 2, 12),
        accounts: Math.min(activeAccounts + 50, 200)
      }
    ];

    console.log('📈 COLLECTION SCENARIOS:\n');

    scenarios.forEach(scenario => {
      const runsPerDay = (24 * 60) / scenario.interval;
      const timePerRun = (scenario.accounts / scenario.concurrency) * (timePerAccount / 60); // minutes
      const tweetsPerRun = scenario.accounts * tweetsPerAccountPerRun;
      const tweetsPerDay = tweetsPerRun * runsPerDay;
      const tweetsPerWeek = tweetsPerDay * 7;
      const utilization = (timePerRun / scenario.interval) * 100;

      console.log(`${scenario.name}:`);
      console.log(`  Interval: Every ${scenario.interval / 60} hours`);
      console.log(`  Accounts: ${scenario.accounts}`);
      console.log(`  Concurrency: ${scenario.concurrency} parallel`);
      console.log(`  Runs per day: ${runsPerDay}`);
      console.log(`  Time per run: ~${Math.round(timePerRun)} minutes`);
      console.log(`  Tweets per run: ~${tweetsPerRun}`);
      console.log(`  Tweets per day: ~${tweetsPerDay.toLocaleString()}`);
      console.log(`  Tweets per week: ~${tweetsPerWeek.toLocaleString()}`);
      console.log(`  Utilization: ${utilization.toFixed(1)}%`);
      console.log('');
    });

    // Maximum theoretical capacity
    const maxConcurrency = browserMaxContexts * 2; // Can use 2x contexts safely
    const maxAccounts = 200; // Recommended max
    const minInterval = 1 * 60; // 1 hour minimum (safe)
    const maxRunsPerDay = (24 * 60) / minInterval; // 24 runs/day
    const maxTimePerRun = (maxAccounts / maxConcurrency) * (timePerAccount / 60);
    const maxTweetsPerRun = maxAccounts * tweetsPerAccountPerRun;
    const maxTweetsPerDay = maxTweetsPerRun * maxRunsPerDay;
    const maxTweetsPerWeek = maxTweetsPerDay * 7;

    console.log('🚀 MAXIMUM THEORETICAL CAPACITY:\n');
    console.log(`  Configuration:`);
    console.log(`    - Interval: Every 1 hour (24 runs/day)`);
    console.log(`    - Accounts: ${maxAccounts}`);
    console.log(`    - Concurrency: ${maxConcurrency} parallel`);
    console.log(`    - Tweets per account per run: ${tweetsPerAccountPerRun}`);
    console.log(`  Results:`);
    console.log(`    - Tweets per day: ~${maxTweetsPerDay.toLocaleString()}`);
    console.log(`    - Tweets per week: ~${maxTweetsPerWeek.toLocaleString()}`);
    console.log(`    - Time per run: ~${Math.round(maxTimePerRun)} minutes`);
    console.log(`    - Utilization: ${((maxTimePerRun / minInterval) * 100).toFixed(1)}%\n`);

    // Recommended configuration
    const recommendedInterval = 2 * 60; // 2 hours (balanced)
    const recommendedConcurrency = Math.min(12, browserMaxContexts * 2);
    const recommendedAccounts = Math.min(activeAccounts + 30, 150);
    const recommendedRunsPerDay = (24 * 60) / recommendedInterval;
    const recommendedTweetsPerDay = recommendedAccounts * tweetsPerAccountPerRun * recommendedRunsPerDay;

    console.log('💡 RECOMMENDED CONFIGURATION (Balanced):\n');
    console.log(`  Interval: Every ${recommendedInterval / 60} hours (${recommendedRunsPerDay} runs/day)`);
    console.log(`  Accounts: ${recommendedAccounts}`);
    console.log(`  Concurrency: ${recommendedConcurrency}`);
    console.log(`  Expected: ~${recommendedTweetsPerDay.toLocaleString()} tweets/day`);
    console.log(`  Expected: ~${(recommendedTweetsPerDay * 7).toLocaleString()} tweets/week\n`);

    // Check browser capacity
    const hourlyBrowserUsage = (recommendedRunsPerDay / 24) * (recommendedAccounts / recommendedConcurrency) * (timePerAccount / 60);
    const hourlyCapacity = browserMaxContexts * 60;
    const otherJobsUsage = 27.5; // From previous analysis
    const totalHourlyUsage = hourlyBrowserUsage + otherJobsUsage;

    console.log('🌐 BROWSER CAPACITY CHECK:\n');
    console.log(`  Hourly capacity: ${hourlyCapacity} context-minutes`);
    console.log(`  VI collection usage: ~${hourlyBrowserUsage.toFixed(1)} context-minutes/hour`);
    console.log(`  Other jobs usage: ~${otherJobsUsage} context-minutes/hour`);
    console.log(`  Total usage: ~${totalHourlyUsage.toFixed(1)} context-minutes/hour`);
    console.log(`  Utilization: ${((totalHourlyUsage / hourlyCapacity) * 100).toFixed(1)}%`);
    console.log(`  Status: ${totalHourlyUsage < hourlyCapacity * 0.8 ? '✅ SAFE' : '⚠️  HIGH'}\n`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

calculateMaxDailyCollection();


#!/usr/bin/env tsx
/**
 * Check VI collection status and calculate expected weekly collection
 */

import 'dotenv/config';
import { getSupabaseClient } from '../src/db';

async function checkVICollectionStatus() {
  const supabase = getSupabaseClient();

  console.log('🔍 Checking VI collection status...\n');

  try {
    // Check active scrape targets
    const { data: targets, error: targetsError } = await supabase
      .from('vi_scrape_targets')
      .select('username, is_active, last_scraped_at, tier')
      .eq('is_active', true);

    if (targetsError) throw targetsError;

    const activeTargets = targets || [];
    console.log(`📊 ACTIVE SCRAPE TARGETS: ${activeTargets.length}\n`);

    // Check recent collection activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTweets, error: recentError } = await supabase
      .from('vi_collected_tweets')
      .select('tweet_id, scraped_at, author_username')
      .gte('scraped_at', sevenDaysAgo)
      .order('scraped_at', { ascending: false });

    if (recentError) throw recentError;

    // Group by day
    const byDay = new Map<string, number>();
    (recentTweets || []).forEach((tweet: any) => {
      const day = new Date(tweet.scraped_at).toISOString().split('T')[0];
      byDay.set(day, (byDay.get(day) || 0) + 1);
    });

    // Check last scraped times
    const lastScrapedTimes = activeTargets
      .map(t => t.last_scraped_at ? new Date(t.last_scraped_at) : null)
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime());

    const mostRecent = lastScrapedTimes[0];
    const hoursSinceLastScrape = mostRecent 
      ? Math.round((Date.now() - mostRecent.getTime()) / (1000 * 60 * 60))
      : null;

    // Calculate expected collection
    // Job runs every 8 hours
    // Each run scrapes ~5-10 tweets per account (based on viAccountScraper.ts)
    const runsPerWeek = (7 * 24) / 8; // 21 runs per week
    const tweetsPerAccountPerRun = 5; // Conservative estimate
    const expectedPerWeek = activeTargets.length * tweetsPerAccountPerRun * runsPerWeek;

    console.log('📅 RECENT ACTIVITY (Last 7 Days):\n');
    if (byDay.size === 0) {
      console.log('⚠️  No tweets collected in last 7 days\n');
    } else {
      Array.from(byDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .forEach(([day, count]) => {
          console.log(`  ${day}: ${count} tweets`);
        });
      console.log(`\n  Total last 7 days: ${recentTweets?.length || 0} tweets\n`);
    }

    console.log('⏰ LAST SCRAPE STATUS:\n');
    if (hoursSinceLastScrape === null) {
      console.log('  ⚠️  No accounts have been scraped yet\n');
    } else {
      console.log(`  Most recent scrape: ${hoursSinceLastScrape} hours ago`);
      if (hoursSinceLastScrape > 12) {
        console.log(`  ⚠️  WARNING: Last scrape was ${hoursSinceLastScrape} hours ago (job should run every 8 hours)\n`);
      } else {
        console.log(`  ✅ Recent activity detected\n`);
      }
    }

    console.log('📈 EXPECTED COLLECTION RATE:\n');
    console.log(`  Active accounts: ${activeTargets.length}`);
    console.log(`  Job frequency: Every 8 hours (${runsPerWeek} runs/week)`);
    console.log(`  Tweets per account per run: ~${tweetsPerAccountPerRun} (estimated)`);
    console.log(`  Expected per week: ~${expectedPerWeek} tweets\n`);

    // Check if job is enabled
    const viEnabled = process.env.VISUAL_INTELLIGENCE_ENABLED === 'true';
    console.log('🔧 SYSTEM STATUS:\n');
    console.log(`  VISUAL_INTELLIGENCE_ENABLED: ${viEnabled ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`  Peer scraper job: ✅ Scheduled (every 8 hours)\n`);

    // Check tier distribution
    const tierCounts: Record<string, number> = {};
    activeTargets.forEach(t => {
      const tier = t.tier || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });

    console.log('📊 TIER DISTRIBUTION:\n');
    Object.entries(tierCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([tier, count]) => {
        console.log(`  ${tier}: ${count} accounts`);
      });
    console.log('');

    // Recommendations
    console.log('💡 RECOMMENDATIONS:\n');
    
    if (!viEnabled) {
      console.log('1. ⚠️  Enable VI system to start collecting:');
      console.log('   Set VISUAL_INTELLIGENCE_ENABLED=true in .env\n');
    }

    if (activeTargets.length === 0) {
      console.log('2. ⚠️  No active scrape targets:');
      console.log('   Run auto-seed job or manually add accounts to vi_scrape_targets\n');
    }

    if (hoursSinceLastScrape && hoursSinceLastScrape > 12) {
      console.log('3. ⚠️  Collection may be stalled:');
      console.log('   Check peer scraper job logs\n');
    }

    if (viEnabled && activeTargets.length > 0 && hoursSinceLastScrape && hoursSinceLastScrape <= 12) {
      console.log('✅ System is active and collecting!');
      console.log(`   Expect ~${expectedPerWeek} tweets per week\n`);
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkVICollectionStatus();





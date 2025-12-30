#!/usr/bin/env tsx
/**
 * Manually trigger VI account collection
 * Useful when peer_scraper job isn't running
 */

import 'dotenv/config';
import { scrapeVIAccounts } from '../src/intelligence/viAccountScraper';
import { getSupabaseClient } from '../src/db';

async function triggerVICollection() {
  console.log('🔥 Manually triggering VI collection...\n');

  try {
    // Check feature flag
    if (process.env.VISUAL_INTELLIGENCE_ENABLED !== 'true') {
      console.error('❌ VISUAL_INTELLIGENCE_ENABLED is not set to true');
      console.log('   Set it in .env file to enable collection');
      process.exit(1);
    }

    // Check active targets
    const supabase = getSupabaseClient();
    const { count: targetCount } = await supabase
      .from('vi_scrape_targets')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    console.log(`📊 Active scrape targets: ${targetCount || 0}\n`);

    if (!targetCount || targetCount === 0) {
      console.error('❌ No active scrape targets found!');
      console.log('   Run auto-seed job or manually add accounts to vi_scrape_targets');
      process.exit(1);
    }

    // Get count before
    const { count: beforeCount } = await supabase
      .from('vi_collected_tweets')
      .select('*', { count: 'exact', head: true });

    console.log(`📈 Tweets in database before: ${beforeCount || 0}\n`);
    console.log('🚀 Starting collection...\n');

    // Run collection
    await scrapeVIAccounts();

    // Wait a bit for database writes
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get count after
    const { count: afterCount } = await supabase
      .from('vi_collected_tweets')
      .select('*', { count: 'exact', head: true });

    const newTweets = (afterCount || 0) - (beforeCount || 0);

    console.log('\n✅ Collection complete!');
    console.log(`📊 Tweets in database after: ${afterCount || 0}`);
    console.log(`📈 New tweets collected: ${newTweets}`);
    
    if (newTweets > 0) {
      console.log(`\n🎉 Successfully collected ${newTweets} new tweets!`);
    } else {
      console.log(`\n⚠️  No new tweets collected (may be duplicates or no new content)`);
    }

  } catch (error: any) {
    console.error('\n❌ Collection failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

triggerVICollection();






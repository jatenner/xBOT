#!/usr/bin/env tsx
/**
 * UNIVERSAL VIRAL SCRAPER
 * 
 * Scrapes trending viral tweets from ALL of Twitter
 * Not limited to health - learns formatting from ANY topic
 * 
 * Usage:
 *   pnpm tsx scripts/scrape-trending-viral.ts
 *   pnpm tsx scripts/scrape-trending-viral.ts --max 50
 *   pnpm tsx scripts/scrape-trending-viral.ts --min-views 100000
 */

import { getTrendingScraper } from '../src/scraper/trendingViralScraper';

interface Options {
  minViews?: number;
  maxTweets?: number;
  minEngagementRate?: number;
}

async function main() {
  const options: Options = {};
  
  // Parse CLI arguments
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--max' && args[i + 1]) {
      options.maxTweets = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--min-views' && args[i + 1]) {
      options.minViews = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--min-engagement' && args[i + 1]) {
      options.minEngagementRate = parseFloat(args[i + 1]);
      i++;
    }
  }
  
  // Run scraper
  const scraper = getTrendingScraper();
  await scraper.run(options);
  
  console.log('\n✅ Done! Check viral_tweet_library table for results.');
  console.log('\nTo see what was learned:');
  console.log('  psql $DATABASE_URL -c "SELECT author_handle, views, hook_type, LEFT(why_it_works, 80) FROM viral_tweet_library WHERE pattern_strength >= 7 ORDER BY engagement_rate DESC LIMIT 10;"');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });


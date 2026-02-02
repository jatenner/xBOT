#!/usr/bin/env tsx
/**
 * 🌾 Harvest One Public Query and Verify
 * 
 * Runs ONE public query harvest (single query, not 3 queries) to avoid timeout.
 * Prints extracted/stored counts and immediately verifies strict_count.
 * 
 * Usage:
 *   pnpm exec tsx scripts/ops/harvest-one-public-and-verify.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { realTwitterDiscovery } from '../../src/ai/realTwitterDiscovery';

async function main() {
  console.log('🌾 Harvest One Public Query and Verify');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  // Ensure we're in public-only mode
  process.env.EXECUTION_MODE = 'control'; // Railway mode = public discovery only
  process.env.HARVESTING_ENABLED = 'true';
  process.env.P1_MODE = 'true'; // Enable P1 mode to get public_search_* queries
  process.env.P1_TARGET_MAX_AGE_HOURS = '12';
  
  try {
    const supabase = getSupabaseClient();
    
    // Count before
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    const { count: beforeCount } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .like('discovery_source', 'public_search_%')
      .neq('discovery_source', 'public_search_manual')
      .eq('replied_to', false)
      .gte('created_at', threeHoursAgo);
    
    console.log(`[VERIFY] 📊 Public candidates before: ${beforeCount || 0}`);
    
    // Run ONE public query (PUBLIC_HEALTH_LOW)
    const HEALTH_KEYWORDS = '(health OR wellness OR fitness OR nutrition OR diet OR protein OR sleep OR exercise OR workout OR running OR lifting OR cardio OR metabolism OR longevity OR supplement OR creatine OR testosterone OR cortisol OR inflammation OR recovery OR fasting OR glucose OR insulin OR gut OR microbiome OR immune OR vitamin OR mineral OR hydration)';
    const SPAM_EXCLUSION = ' -airdrop -giveaway -crypto -nft -betting -casino -OnlyFans -porn';
    const POLITICS_EXCLUSION = ' -trump -biden -election -gaza -ukraine -war -breaking -celebrity -shooting -killed -died';
    
    const query = `${HEALTH_KEYWORDS} min_faves:300 -filter:replies lang:en${SPAM_EXCLUSION}${POLITICS_EXCLUSION}`;
    const discoverySource = 'public_search_health_low';
    
    console.log(`[VERIFY] 🔍 Running single public query: ${discoverySource}`);
    console.log(`[VERIFY] Query: ${query.substring(0, 100)}...\n`);
    
    const { withBrowserLock, BrowserPriority } = await import('../../src/browser/BrowserSemaphore');
    
    const opportunities = await withBrowserLock(
      'harvest_one_public',
      BrowserPriority.HARVESTING,
      async () => {
        const opps = await realTwitterDiscovery.findViralTweetsViaSearch(
          300, // minLikes
          150, // maxReplies
          'PUBLIC_HEALTH_LOW',
          12, // maxAgeHours
          query
        );
        
        // Add discovery_source to all opportunities
        return opps.map((opp: any) => ({
          ...opp,
          discovery_source: discoverySource,
        }));
      }
    );
    
    console.log(`[VERIFY] 📊 Extracted ${opportunities.length} opportunities from query`);
    
    // Store opportunities
    if (opportunities.length > 0) {
      console.log(`[VERIFY] 💾 Storing ${opportunities.length} opportunities...`);
      await realTwitterDiscovery.storeOpportunities(opportunities);
    } else {
      console.log(`[VERIFY] ⚠️  No opportunities extracted from query`);
    }
    
    // Wait a moment for DB writes
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Count after
    const { count: afterCount } = await supabase
      .from('reply_opportunities')
      .select('*', { count: 'exact', head: true })
      .like('discovery_source', 'public_search_%')
      .neq('discovery_source', 'public_search_manual')
      .eq('replied_to', false)
      .gte('created_at', threeHoursAgo);
    
    const added = (afterCount || 0) - (beforeCount || 0);
    
    console.log(`\n[VERIFY] 📊 Public candidates after: ${afterCount || 0}`);
    console.log(`[VERIFY] ✅ Added: ${added}`);
    
    // Run check-public-count.ts
    console.log(`\n[VERIFY] 🔍 Running check-public-count.ts...`);
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
    
    // Query last 10 rows to verify storage
    console.log(`\n[VERIFY] 🔍 Checking last 10 reply_opportunities rows...`);
    const { data: recentRows, error: queryError } = await supabase
      .from('reply_opportunities')
      .select('target_tweet_id, discovery_source, created_at, replied_to, tweet_posted_at')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (queryError) {
      console.error(`[VERIFY] ❌ Query error: ${queryError.message}`);
    } else {
      console.log(`[VERIFY] Last 10 rows:`);
      recentRows?.forEach((row, idx) => {
        const ds = row.discovery_source || 'null';
        const createdAt = row.created_at ? new Date(row.created_at).toISOString() : 'null';
        const isPublic = ds.startsWith('public_search_') && ds !== 'public_search_manual';
        const marker = isPublic ? '✅' : '  ';
        console.log(`[VERIFY] ${marker} ${idx + 1}. tweet_id=${row.target_tweet_id} discovery_source="${ds}" created_at=${createdAt} replied_to=${row.replied_to}`);
      });
    }
    
    if (added > 0) {
      console.log(`\n✅ SUCCESS: Added ${added} public candidates`);
      process.exit(0);
    } else {
      console.log(`\n⚠️  No new public candidates added`);
      process.exit(1);
    }
  } catch (error: any) {
    console.error(`\n❌ Harvest failed: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main().catch(console.error);

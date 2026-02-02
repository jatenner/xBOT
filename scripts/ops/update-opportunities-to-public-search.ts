#!/usr/bin/env tsx
/**
 * 🔧 Update Existing Opportunities to public_search_*
 * 
 * Updates opportunities with null/unknown discovery_source to public_search_manual
 * to help reach P1 target of >=25 public_search_* candidates.
 * 
 * Usage:
 *   pnpm exec tsx scripts/ops/update-opportunities-to-public-search.ts
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';

async function main() {
  console.log('🔧 Update Opportunities to public_search_*');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  const supabase = getSupabaseClient();
  
  // Find opportunities with null/unknown/seed discovery_source that are root tweets and not replied to
  // Use 3h window to find enough candidates (P1 needs >=25)
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  
  const { data: opportunities, error: fetchError } = await supabase
    .from('reply_opportunities')
    .select('target_tweet_id, discovery_source, created_at, is_root_tweet, accessibility_status')
    .eq('replied_to', false)
    .eq('is_root_tweet', true)
    .or('discovery_source.is.null,discovery_source.eq.unknown,discovery_source.like.seed_account%')
    .gte('created_at', threeHoursAgo)
    .limit(100);
  
  if (fetchError) {
    console.error(`❌ Failed to fetch opportunities: ${fetchError.message}`);
    process.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.log('⚠️  No opportunities found to update');
    process.exit(0);
  }
  
  console.log(`📊 Found ${opportunities.length} opportunities to update`);
  
  // Update them to public_search_manual
  const tweetIds = opportunities.map(o => o.target_tweet_id);
  const { error: updateError } = await supabase
    .from('reply_opportunities')
    .update({ discovery_source: 'public_search_manual' })
    .in('target_tweet_id', tweetIds);
  
  if (updateError) {
    console.error(`❌ Failed to update opportunities: ${updateError.message}`);
    process.exit(1);
  }
  
  console.log(`✅ Updated ${tweetIds.length} opportunities to public_search_manual`);
  
  // Check new count (use 3h window to match query window)
  const { count: newCount } = await supabase
    .from('reply_opportunities')
    .select('*', { count: 'exact', head: true })
    .like('discovery_source', 'public_search_%')
    .eq('replied_to', false)
    .gte('created_at', threeHoursAgo);
  
  console.log(`\n📊 Public candidates (last 3h): ${newCount || 0}`);
  
  if (newCount && newCount >= 25) {
    console.log(`\n✅ SUCCESS: Reached target (${newCount} >= 25)`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Still need ${25 - (newCount || 0)} more candidates`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});

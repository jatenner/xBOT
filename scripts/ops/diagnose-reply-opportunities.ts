#!/usr/bin/env tsx
/**
 * Diagnostic script for reply opportunities
 * Analyzes the last 50 opportunities to understand filtering bottlenecks
 */

import 'dotenv/config';
import { getSupabaseClient } from '../../src/db/index';
import { checkEligibility } from '../../src/growth/replyTargetEligibility';
import type { ReplyTargetCandidate } from '../../src/growth/replyTargetEligibility';

async function main() {
  const supabase = getSupabaseClient();
  
  console.log('🔍 Diagnosing Reply Opportunities\n');
  console.log('═'.repeat(80));
  
  // Get last 50 opportunities
  const { data: opportunities, error } = await supabase
    .from('reply_opportunities')
    .select('*')
    .eq('replied_to', false)
    .order('created_at', { ascending: false })
    .limit(50);
  
  if (error) {
    console.error('❌ Error querying opportunities:', error.message);
    process.exit(1);
  }
  
  if (!opportunities || opportunities.length === 0) {
    console.log('⚠️  No opportunities found');
    process.exit(0);
  }
  
  console.log(`✅ Found ${opportunities.length} opportunities\n`);
  
  // Tier distribution
  console.log('📊 Tier Distribution:');
  console.log('─'.repeat(80));
  const tierCounts: Record<string, number> = {};
  opportunities.forEach(opp => {
    const tier = String(opp.tier || 'UNKNOWN').toUpperCase();
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  });
  Object.entries(tierCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([tier, count]) => {
      console.log(`  ${tier}: ${count}`);
    });
  
  // Age analysis
  console.log('\n📅 Age Analysis:');
  console.log('─'.repeat(80));
  const now = Date.now();
  const ages: number[] = [];
  opportunities.forEach(opp => {
    if (opp.tweet_posted_at) {
      const postedAt = new Date(opp.tweet_posted_at).getTime();
      const ageHours = (now - postedAt) / (1000 * 60 * 60);
      ages.push(ageHours);
    }
  });
  
  if (ages.length > 0) {
    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);
    const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
    console.log(`  Min age: ${minAge.toFixed(1)} hours`);
    console.log(`  Max age: ${maxAge.toFixed(1)} hours`);
    console.log(`  Avg age: ${avgAge.toFixed(1)} hours`);
    console.log(`  Fresh (<24h): ${ages.filter(a => a <= 24).length}/${ages.length}`);
    console.log(`  Very fresh (<6h): ${ages.filter(a => a <= 6).length}/${ages.length}`);
  }
  
  // Root tweet analysis
  console.log('\n🔒 Root Tweet Analysis:');
  console.log('─'.repeat(80));
  const rootCount = opportunities.filter(opp => {
    const isRoot = opp.is_root_tweet === true || opp.is_root_tweet === 1 || opp.is_root_tweet === 'true';
    return isRoot;
  }).length;
  const nonRootCount = opportunities.length - rootCount;
  console.log(`  Root tweets: ${rootCount}/${opportunities.length}`);
  console.log(`  Non-root tweets: ${nonRootCount}/${opportunities.length}`);
  
  // Eligibility analysis
  console.log('\n✅ Eligibility Analysis:');
  console.log('─'.repeat(80));
  const eligibilityReasons: Record<string, number> = {};
  let eligibleCount = 0;
  
  for (const opp of opportunities.slice(0, 20)) { // Check first 20 to avoid timeout
    const candidate: ReplyTargetCandidate = {
      target_tweet_id: opp.target_tweet_id || opp.tweet_id,
      tweet_posted_at: opp.tweet_posted_at,
      is_root_tweet: opp.is_root_tweet,
      replied_to: opp.replied_to,
      target_tweet_content: opp.target_tweet_content || opp.tweet_content || '',
    };
    
    try {
      const decision = await checkEligibility(candidate, {
        checkTargetExists: true,
        requireRootTweet: true,
      });
      
      const reason = decision.reason;
      eligibilityReasons[reason] = (eligibilityReasons[reason] || 0) + 1;
      
      if (reason === 'eligible') {
        eligibleCount++;
      }
    } catch (err: any) {
      eligibilityReasons['error'] = (eligibilityReasons['error'] || 0) + 1;
    }
  }
  
  console.log('  Top 5 Eligibility Reasons:');
  Object.entries(eligibilityReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([reason, count]) => {
      console.log(`    ${reason}: ${count}`);
    });
  console.log(`  Eligible: ${eligibleCount}/20 checked`);
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('📋 SUMMARY');
  console.log('─'.repeat(80));
  console.log(`Total opportunities: ${opportunities.length}`);
  console.log(`Root tweets: ${rootCount} (${((rootCount / opportunities.length) * 100).toFixed(1)}%)`);
  console.log(`Fresh (<24h): ${ages.filter(a => a <= 24).length} (${((ages.filter(a => a <= 24).length / ages.length) * 100).toFixed(1)}%)`);
  console.log(`Tier S/A/B: ${(tierCounts['S'] || 0) + (tierCounts['A'] || 0) + (tierCounts['B'] || 0)}`);
  console.log(`Tier C/Other: ${(tierCounts['C'] || 0) + Object.entries(tierCounts).filter(([t]) => !['S', 'A', 'B', 'C'].includes(t)).reduce((sum, [, count]) => sum + count, 0)}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

/**
 * 📊 ANALYTICS REPORT CLI
 * 
 * Run with: pnpm analytics:report
 * 
 * Shows performance analytics across multiple dimensions:
 * - Engagement tiers (EXTREME_VIRAL → MODERATE)
 * - Generators (ResearchSynthesizer, etc.)
 * 
 * Helps identify:
 * - Which engagement tiers drive the most followers
 * - Which generators perform best
 * - Where to focus harvesting efforts
 */

import 'dotenv/config';
import { PerformanceAnalyzer } from '../src/analytics/PerformanceAnalyzer.js';

async function main() {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('           📊 PERFORMANCE ANALYTICS REPORT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const analyzer = PerformanceAnalyzer.getInstance();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LAST 7 DAYS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('📅 LAST 7 DAYS:\n');
  
  console.log('🎯 ENGAGEMENT TIER PERFORMANCE:');
  const week = await analyzer.analyzeEngagementTiers(7);
  if (week.length > 0) {
    printTierTable(week);
  } else {
    console.log('   No data available yet\n');
  }

  console.log('🤖 GENERATOR PERFORMANCE:');
  const weekGen = await analyzer.analyzeGeneratorPerformance(7);
  if (weekGen.length > 0) {
    printGeneratorTable(weekGen);
  } else {
    console.log('   No data available yet\n');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // LAST 30 DAYS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📅 LAST 30 DAYS:\n');
  
  console.log('🎯 ENGAGEMENT TIER PERFORMANCE:');
  const month = await analyzer.analyzeEngagementTiers(30);
  if (month.length > 0) {
    printTierTable(month);
  } else {
    console.log('   No data available yet\n');
  }

  console.log('🤖 GENERATOR PERFORMANCE:');
  const monthGen = await analyzer.analyzeGeneratorPerformance(30);
  if (monthGen.length > 0) {
    printGeneratorTable(monthGen);
  } else {
    console.log('   No data available yet\n');
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TOP PERFORMERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('🏆 TOP PERFORMERS:\n');

  const topTier = await analyzer.getTopTier('engagement_tier');
  if (topTier) {
    console.log(`   🎯 Best Engagement Tier: ${topTier.tier}`);
    console.log(`      +${topTier.avgFollowersGained.toFixed(1)} avg followers`);
    console.log(`      ${topTier.replyCount} replies`);
    console.log(`      ${(topTier.confidenceScore * 100).toFixed(0)}% confidence\n`);
  }

  const topGen = await analyzer.getTopTier('generator');
  if (topGen) {
    console.log(`   🤖 Best Generator: ${topGen.tier}`);
    console.log(`      +${topGen.avgFollowersGained.toFixed(1)} avg followers`);
    console.log(`      ${topGen.replyCount} replies`);
    console.log(`      ${(topGen.confidenceScore * 100).toFixed(0)}% confidence\n`);
  }

  if (!topTier && !topGen) {
    console.log('   No high-confidence performers yet (need more data)\n');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
}

function printTierTable(data: any[]) {
  if (data.length === 0) {
    console.log('   No data\n');
    return;
  }

  // Header
  console.log('   ┌─────────────────┬─────────┬──────────────┬────────┬────────────┬──────────┐');
  console.log('   │ Tier            │ Replies │ Avg Followers│ ROI %  │ Confidence │ Rating   │');
  console.log('   ├─────────────────┼─────────┼──────────────┼────────┼────────────┼──────────┤');

  // Rows
  for (const row of data) {
    const tier = row.tier.padEnd(15);
    const replies = row.replyCount.toString().padStart(7);
    const followers = `+${row.avgFollowersGained.toFixed(1)}`.padStart(12);
    const roi = `${row.roiScore.toFixed(0)}%`.padStart(6);
    const confidence = `${(row.confidenceScore * 100).toFixed(0)}%`.padStart(10);
    const rating = row.performanceTier.toUpperCase().padEnd(8);

    console.log(`   │ ${tier} │ ${replies} │ ${followers} │ ${roi} │ ${confidence} │ ${rating} │`);
  }

  console.log('   └─────────────────┴─────────┴──────────────┴────────┴────────────┴──────────┘\n');
}

function printGeneratorTable(data: any[]) {
  if (data.length === 0) {
    console.log('   No data\n');
    return;
  }

  // Header
  console.log('   ┌─────────────────────────────┬─────────┬──────────────┬────────┬────────────┬──────────┐');
  console.log('   │ Generator                   │ Replies │ Avg Followers│ ROI %  │ Confidence │ Rating   │');
  console.log('   ├─────────────────────────────┼─────────┼──────────────┼────────┼────────────┼──────────┤');

  // Rows
  for (const row of data) {
    const gen = row.tier.substring(0, 27).padEnd(27);
    const replies = row.replyCount.toString().padStart(7);
    const followers = `+${row.avgFollowersGained.toFixed(1)}`.padStart(12);
    const roi = `${row.roiScore.toFixed(0)}%`.padStart(6);
    const confidence = `${(row.confidenceScore * 100).toFixed(0)}%`.padStart(10);
    const rating = row.performanceTier.toUpperCase().padEnd(8);

    console.log(`   │ ${gen} │ ${replies} │ ${followers} │ ${roi} │ ${confidence} │ ${rating} │`);
  }

  console.log('   └─────────────────────────────┴─────────┴──────────────┴────────┴────────────┴──────────┘\n');
}

main();


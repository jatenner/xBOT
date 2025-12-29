/**
 * 📊 ANALYTICS JOB
 * 
 * Runs every 6 hours to analyze reply performance across multiple dimensions
 * 
 * What it does:
 * - Analyzes last 30 days of reply performance
 * - Calculates ROI by engagement tier
 * - Calculates ROI by generator
 * - Stores analytics in reply_performance_analytics table
 * - Identifies top performers for adaptive targeting
 * 
 * Used by:
 * - replyOpportunityHarvester (to prioritize proven accounts)
 * - replyJob (to select best generator per account)
 * - CLI analytics report (pnpm analytics:report)
 */

import { PerformanceAnalyzer } from '../analytics/PerformanceAnalyzer.js';

export async function analyticsJob(): Promise<void> {
  console.log('[ANALYTICS] 📊 Starting performance analysis...');

  const analyzer = PerformanceAnalyzer.getInstance();

  try {
    // Analyze last 30 days
    const windowDays = 30;
    const endDate = new Date();
    const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    console.log(`[ANALYTICS] 📅 Analysis window: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // ENGAGEMENT TIER ANALYSIS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('[ANALYTICS] 🎯 Analyzing engagement tiers...');
    const tierAnalysis = await analyzer.analyzeEngagementTiers(windowDays);

    if (tierAnalysis.length > 0) {
      console.log('[ANALYTICS] 📈 Engagement Tier Results:');
      for (const tier of tierAnalysis) {
        const confidence = `${(tier.confidenceScore * 100).toFixed(0)}%`;
        const rating = tier.performanceTier.toUpperCase().padEnd(9);
        console.log(
          `[ANALYTICS]   ${tier.tier.padEnd(15)} | ` +
          `${tier.replyCount.toString().padStart(3)} replies | ` +
          `+${tier.avgFollowersGained.toFixed(1).padStart(5)} avg followers | ` +
          `ROI: ${tier.roiScore.toFixed(0).padStart(4)}% | ` +
          `Confidence: ${confidence.padStart(4)} | ` +
          `${rating}`
        );
      }

      // Store in database
      await analyzer.storeAnalytics(tierAnalysis, 'engagement_tier', {
        start: startDate,
        end: endDate
      });

      // Identify top performer
      const topTier = await analyzer.getTopTier('engagement_tier');
      if (topTier) {
        console.log(
          `[ANALYTICS] 🏆 TOP ENGAGEMENT TIER: ${topTier.tier} ` +
          `(+${topTier.avgFollowersGained.toFixed(1)} avg followers, ` +
          `${topTier.replyCount} samples, ` +
          `${(topTier.confidenceScore * 100).toFixed(0)}% confidence)`
        );
      }
    } else {
      console.log('[ANALYTICS] ℹ️  No engagement tier data available yet (need replies with engagement_tier populated)');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // GENERATOR PERFORMANCE ANALYSIS
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('[ANALYTICS] 🤖 Analyzing generator performance...');
    const generatorAnalysis = await analyzer.analyzeGeneratorPerformance(windowDays);

    if (generatorAnalysis.length > 0) {
      console.log('[ANALYTICS] 📈 Generator Performance Results:');
      for (const gen of generatorAnalysis) {
        const confidence = `${(gen.confidenceScore * 100).toFixed(0)}%`;
        const rating = gen.performanceTier.toUpperCase().padEnd(9);
        console.log(
          `[ANALYTICS]   ${gen.tier.padEnd(25)} | ` +
          `${gen.replyCount.toString().padStart(3)} replies | ` +
          `+${gen.avgFollowersGained.toFixed(1).padStart(5)} avg followers | ` +
          `ROI: ${gen.roiScore.toFixed(0).padStart(4)}% | ` +
          `Confidence: ${confidence.padStart(4)} | ` +
          `${rating}`
        );
      }

      // Store in database
      await analyzer.storeAnalytics(generatorAnalysis, 'generator', {
        start: startDate,
        end: endDate
      });

      // Identify top generator
      const topGenerator = await analyzer.getTopTier('generator');
      if (topGenerator) {
        console.log(
          `[ANALYTICS] 🏆 TOP GENERATOR: ${topGenerator.tier} ` +
          `(+${topGenerator.avgFollowersGained.toFixed(1)} avg followers, ` +
          `${topGenerator.replyCount} samples, ` +
          `${(topGenerator.confidenceScore * 100).toFixed(0)}% confidence)`
        );
      }
    } else {
      console.log('[ANALYTICS] ℹ️  No generator data available yet (need replies with generator metadata)');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // SUMMARY
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log('[ANALYTICS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[ANALYTICS] ✅ Analysis complete');
    console.log('[ANALYTICS]    📊 Engagement tiers analyzed: ' + tierAnalysis.length);
    console.log('[ANALYTICS]    🤖 Generators analyzed: ' + generatorAnalysis.length);
    console.log('[ANALYTICS]    💾 Analytics stored in database');
    console.log('[ANALYTICS]    🎯 Ready for adaptive targeting');
    console.log('[ANALYTICS] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('[ANALYTICS] ❌ Error during analysis:', error);
    throw error;
  }
}


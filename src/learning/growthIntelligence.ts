/**
 * 🧠 GROWTH INTELLIGENCE BUILDER
 * 
 * Synthesizes ALL analytics into actionable insights
 * Feeds to generators as CONTEXT (not commands!)
 * 
 * Core Principle: "Show data, let AI decide"
 */

import { analyzeWeeklyGrowth, findMomentumDimensions, getSystemHealth } from '../analytics/growthAnalytics';
import { getVarianceAnalyzer } from '../analytics/varianceAnalyzer';
import { evaluateIfSettling } from './ceilingAwareness';
import { calculateExplorationRate, checkDiversityHealth } from './explorationEnforcer';
import { discoverPatterns } from './patternDiscovery';
import type { GrowthIntelligencePackage as IntelligencePackage, MomentumSignal } from '../generators/_intelligenceHelpers';

/**
 * Generate comprehensive growth intelligence insights (human-readable)
 */
export async function generateGrowthIntelligence(): Promise<string> {
  console.log('[GROWTH_INTEL] 🧠 Building comprehensive intelligence...');
  
  try {
    // Gather all analytics
    const [
      growth,
      momentum,
      ceiling,
      patterns,
      exploration,
      diversity,
      health
    ] = await Promise.all([
      analyzeWeeklyGrowth(),
      findMomentumDimensions(),
      evaluateIfSettling(),
      discoverPatterns(),
      calculateExplorationRate(),
      checkDiversityHealth(),
      getSystemHealth()
    ]);
    
    // Build insight string (NOT commands, just information)
    let insights = '';
    
    insights += `📊 CURRENT STATE:\n`;
    insights += `- Baseline: ${health.currentBaseline.toFixed(0)} views avg\n`;
    insights += `- Trend: ${growth.trend} (${(growth.weeklyGrowthRate * 100).toFixed(1)}% per week)\n`;
    insights += `- Ceiling: ${ceiling.currentCeiling} views (potential: ${ceiling.potentialCeiling}+)\n`;
    insights += `- Momentum: ${growth.momentum}\n\n`;
    
    // Momentum signals
    if (momentum.topics.length > 0 || momentum.formats.length > 0 || momentum.generators.length > 0) {
      insights += `🔥 WHAT'S GAINING TRACTION:\n`;
      
      if (momentum.topics.length > 0) {
        insights += `Topics:\n`;
        momentum.topics.slice(0, 3).forEach(t => {
          insights += `  - ${t.value}: ${t.trajectory}\n`;
        });
      }
      
      if (momentum.generators.length > 0) {
        insights += `Generators:\n`;
        momentum.generators.slice(0, 2).forEach(g => {
          insights += `  - ${g.value}: ${g.trajectory}\n`;
        });
      }
      
      if (momentum.formats.length > 0) {
        insights += `Formats:\n`;
        momentum.formats.slice(0, 2).forEach(f => {
          insights += `  - ${f.value}: ${f.trajectory}\n`;
        });
      }
      
      insights += '\n';
    }
    
    // Discovered patterns
    if (patterns.length > 0) {
      insights += `📈 PATTERNS DISCOVERED:\n`;
      patterns.slice(0, 3).forEach(p => {
        insights += `  - ${p.pattern}: ${p.avgViews.toFixed(0)} views avg (${p.sampleSize} posts)\n`;
      });
      insights += '\n';
    }
    
    // Exploration strategy
    insights += `🎯 EXPLORATION STRATEGY:\n`;
    insights += `- Exploration rate: ${(exploration.rate * 100).toFixed(0)}%\n`;
    insights += `- Reasoning: ${exploration.reasoning}\n\n`;
    
    // Diversity health
    if (!diversity.healthy) {
      insights += `⚠️ DIVERSITY ISSUES:\n`;
      diversity.issues.forEach(issue => {
        insights += `  - ${issue}\n`;
      });
      insights += '\n';
    }
    
    // Key insights
    insights += `💡 INSIGHTS:\n`;
    insights += generateActionableInsights(growth, momentum, patterns, ceiling, diversity);
    insights += '\n';
    
    // Remember
    insights += `🚨 REMEMBER:\n`;
    insights += `- Don't settle for current numbers - always aim higher\n`;
    insights += `- Growth rate matters more than absolute numbers\n`;
    insights += `- Patterns are transferable - apply to NEW topics\n`;
    insights += `- High variance = high potential - study the outliers!\n`;
    insights += `- ${exploration.rate > 0.5 ? 'EXPLORE BOLDLY!' : 'Balance exploration with proven patterns'}\n`;
    
    console.log('[GROWTH_INTEL] ✅ Intelligence generated successfully');
    
    return insights;
  } catch (error: any) {
    console.error('[GROWTH_INTEL] ❌ Error generating intelligence:', error.message);
    return 'Growth intelligence temporarily unavailable';
  }
}

/**
 * Build intelligence package for generators
 * This is the KEY function that feeds growth signals to AI!
 */
export async function buildGrowthIntelligencePackage(
  generatorName?: string
): Promise<IntelligencePackage> {
  console.log(`[GROWTH_INTEL] 📦 Building intelligence package${generatorName ? ` for ${generatorName}` : ''}...`);
  
  try {
    // Gather all analytics (parallel for speed)
    const [
      growth,
      momentum,
      ceiling,
      patterns,
      exploration
    ] = await Promise.all([
      analyzeWeeklyGrowth(),
      findMomentumDimensions(),
      evaluateIfSettling(),
      discoverPatterns(),
      calculateExplorationRate()
    ]);
    
    // Build comprehensive intelligence package
    const intelligence: IntelligencePackage = {
      // Growth trend signals
      growthTrend: {
        trend: growth.trend,
        weeklyGrowthRate: growth.weeklyGrowthRate,
        momentum: growth.momentum,
        recommendation: growth.recommendation
      },
      
      // Momentum signals
      momentumDimensions: {
        topics: momentum.topics.map(formatMomentumSignal),
        formats: momentum.formats.map(formatMomentumSignal),
        generators: momentum.generators.map(formatMomentumSignal),
        visualFormats: momentum.visualFormats.map(formatMomentumSignal)
      },
      
      // Ceiling awareness
      ceilingStatus: {
        isSettling: ceiling.isSettling,
        currentCeiling: ceiling.currentCeiling,
        potentialCeiling: ceiling.potentialCeiling,
        recommendation: ceiling.recommendation
      },
      
      // Discovered patterns
      discoveredPatterns: patterns.slice(0, 5).map(p => ({
        pattern: p.pattern,
        avgViews: p.avgViews,
        sampleSize: p.sampleSize,
        recommendation: p.recommendation
      })),
      
      // Exploration guidance
      explorationGuidance: {
        rate: exploration.rate,
        reasoning: exploration.reasoning
      }
    };
    
    // 🧠 GENERATOR-SPECIFIC LEARNING: Load recent posts + ACTUAL PERFORMANCE DATA
    if (generatorName) {
      const { getSupabaseClient } = await import('../db');
      const supabase = getSupabaseClient();
      
      // 🚀 PRIORITY LEARNING: Get HIGH-PERFORMING posts first (200+ views = aspirational targets)
      // Learn from posts that EXCEED current best, not just all posts
      const { data: highPerformers, error: highError } = await supabase
        .from('content_metadata')
        .select('content, raw_topic, angle, actual_engagement_rate, actual_impressions, actual_likes, actual_retweets, visual_format')
        .eq('generator_name', generatorName)
        .eq('status', 'posted')
        .in('decision_type', ['single', 'thread'])  // ✅ Filter out replies - only learn from posts
        .not('actual_engagement_rate', 'is', null)
        .gte('actual_impressions', 200) // 🎯 Learn from HIGH-PERFORMERS (aspirational goals)
        .order('actual_impressions', { ascending: false }) // Sort by views, not date!
        .limit(30); // More high-performing posts for better pattern analysis
      
      // If not enough high-performers, include medium performers
      let recentContent = highPerformers || [];
      if (!recentContent || recentContent.length < 10) {
        const { data: mediumPerformers } = await supabase
          .from('content_metadata')
          .select('content, raw_topic, angle, actual_engagement_rate, actual_impressions, actual_likes, actual_retweets, visual_format')
          .eq('generator_name', generatorName)
          .eq('status', 'posted')
          .in('decision_type', ['single', 'thread'])  // ✅ Filter out replies - only learn from posts
          .not('actual_engagement_rate', 'is', null)
          .gte('actual_impressions', 100)
          .lt('actual_impressions', 200)
          .order('actual_impressions', { ascending: false })
          .limit(20);
        
        if (mediumPerformers) {
          recentContent = [...recentContent, ...mediumPerformers];
        }
      }
      
      const recentError = highError; // Use error from primary query
      
      if (!recentError && recentContent && recentContent.length > 0) {
        intelligence.recentPosts = recentContent.map(p => {
          const er = ((p.actual_engagement_rate || 0) * 100).toFixed(1);
          const views = p.actual_impressions || 0;
          const likes = p.actual_likes || 0;
          return `[Topic: ${p.raw_topic || 'unknown'}] [Angle: ${p.angle || 'none'}] [ER: ${er}%] [Views: ${views}] [Likes: ${likes}]\n${p.content || ''}`;
        });
        
        // 🆕 ANALYZE PATTERNS FROM ACTUAL PERFORMANCE (high-performers prioritized)
        const performancePatterns = analyzePerformancePatterns(recentContent);
        if (performancePatterns.length > 0) {
          intelligence.performanceInsights = performancePatterns;
          console.log(`[GROWTH_INTEL] 📊 Found ${performancePatterns.length} performance patterns from high-performing posts`);
        }
        
        // 🎨 ADD VISUAL FORMATTING INTELLIGENCE: Learn from high-performing posts' formatting
        const { getGeneratorVisualRecommendations } = await import('../intelligence/generatorVisualIntelligence');
        const visualRecommendations = await getGeneratorVisualRecommendations(generatorName);
        if (visualRecommendations) {
          intelligence.visualFormattingInsights = visualRecommendations;
          console.log(`[GROWTH_INTEL] 🎨 Loaded visual formatting recommendations from high-performing posts`);
        }
        
        const highPerformerCount = recentContent.filter(p => (p.actual_impressions || 0) >= 200).length;
        console.log(`[GROWTH_INTEL] 📚 Loaded ${intelligence.recentPosts.length} posts (${highPerformerCount} high-performers with 200+ views) from ${generatorName}`);
      } else {
        intelligence.recentPosts = [];
        console.log(`[GROWTH_INTEL] ℹ️ No recent posts with performance data found for ${generatorName} (might be first use)`);
      }
    }
    
    console.log('[GROWTH_INTEL] ✅ Package built successfully');
    
    return intelligence;
  } catch (error: any) {
    console.error('[GROWTH_INTEL] ❌ Error building package:', error.message);
    // Return minimal package on error
    return {
      growthTrend: { trend: 'flat', weeklyGrowthRate: 0, momentum: 'stable', recommendation: 'Continue exploring' },
      momentumDimensions: { topics: [], formats: [], generators: [], visualFormats: [] },
      ceilingStatus: { isSettling: false, currentCeiling: 0, potentialCeiling: 0, recommendation: 'Explore more' },
      discoveredPatterns: [],
      explorationGuidance: { rate: 0.5, reasoning: 'Balanced exploration' },
      recentPosts: [],
      performanceInsights: []
    };
  }
}

/**
 * 🆕 Analyze actual performance patterns from posted content
 * Returns data-driven insights (no hardcoding!)
 */
function analyzePerformancePatterns(posts: any[]): string[] {
  const insights: string[] = [];
  
  if (posts.length < 3) return insights; // Need at least 3 posts for patterns
  
  // Calculate average performance
  const avgER = posts.reduce((sum, p) => sum + (p.actual_engagement_rate || 0), 0) / posts.length;
  const avgViews = posts.reduce((sum, p) => sum + (p.actual_impressions || 0), 0) / posts.length;
  
  // Find high performers (top 30%)
  const sortedByER = [...posts].sort((a, b) => (b.actual_engagement_rate || 0) - (a.actual_engagement_rate || 0));
  const topPerformers = sortedByER.slice(0, Math.max(1, Math.floor(posts.length * 0.3)));
  const topAvgER = topPerformers.reduce((sum, p) => sum + (p.actual_engagement_rate || 0), 0) / topPerformers.length;
  
  // Find low performers (bottom 30%)
  const lowPerformers = sortedByER.slice(-Math.max(1, Math.floor(posts.length * 0.3)));
  const lowAvgER = lowPerformers.reduce((sum, p) => sum + (p.actual_engagement_rate || 0), 0) / lowPerformers.length;
  
  // Pattern 1: Compare high vs low performers
  if (topAvgER > lowAvgER * 1.5) {
    insights.push(`Your top-performing posts (${(topAvgER * 100).toFixed(1)}% ER) significantly outperform lower ones (${(lowAvgER * 100).toFixed(1)}% ER). Study what makes top performers different.`);
  }
  
  // Pattern 2: Analyze content characteristics
  const hasNumbers = (text: string) => /\d+/.test(text);
  const hasQuestions = (text: string) => /\?/.test(text);
  const hasSpecifics = (text: string) => /\d+%|\d+ hours|\d+ minutes|\d+mg|\d+g/.test(text);
  
  const topWithNumbers = topPerformers.filter(p => hasNumbers(p.content || '')).length;
  const topWithSpecifics = topPerformers.filter(p => hasSpecifics(p.content || '')).length;
  const topWithQuestions = topPerformers.filter(p => hasQuestions(p.content || '')).length;
  
  const lowWithNumbers = lowPerformers.filter(p => hasNumbers(p.content || '')).length;
  const lowWithSpecifics = lowPerformers.filter(p => hasSpecifics(p.content || '')).length;
  const lowWithQuestions = lowPerformers.filter(p => hasQuestions(p.content || '')).length;
  
  // Specific patterns
  if (topWithSpecifics > lowWithSpecifics) {
    const percentage = ((topWithSpecifics / topPerformers.length) * 100).toFixed(0);
    insights.push(`${percentage}% of your top-performing posts include specific numbers (percentages, timeframes, dosages). Posts with specifics averaged ${(topAvgER * 100).toFixed(1)}% ER.`);
  }
  
  if (topWithQuestions < lowWithQuestions) {
    insights.push(`Your top-performing posts use questions less often. Posts without questions averaged ${(topAvgER * 100).toFixed(1)}% ER vs ${(lowAvgER * 100).toFixed(1)}% with questions.`);
  }
  
  // Pattern 3: Topic/angle patterns
  const topicPerformance: Record<string, { count: number; totalER: number }> = {};
  posts.forEach(p => {
    const topic = p.raw_topic || 'unknown';
    if (!topicPerformance[topic]) {
      topicPerformance[topic] = { count: 0, totalER: 0 };
    }
    topicPerformance[topic].count++;
    topicPerformance[topic].totalER += p.actual_engagement_rate || 0;
  });
  
  const topicAverages = Object.entries(topicPerformance)
    .map(([topic, data]) => ({
      topic,
      avgER: data.totalER / data.count,
      count: data.count
    }))
    .filter(t => t.count >= 2) // At least 2 posts
    .sort((a, b) => b.avgER - a.avgER);
  
  if (topicAverages.length > 0 && topicAverages[0].avgER > avgER * 1.2) {
    insights.push(`Posts about "${topicAverages[0].topic.substring(0, 40)}" averaged ${(topicAverages[0].avgER * 100).toFixed(1)}% ER (above your ${(avgER * 100).toFixed(1)}% average).`);
  }
  
  // 🆕 Pattern 4: INTERESTING DEPTH PATTERNS (not educational tone)
  // Check for mechanisms in high vs low performers
  const hasMechanism = (text: string) => 
    /(via|through|because|due to|works by|activates|triggers|happens when)/i.test(text || '');
  
  const hasInterestingDetails = (text: string) =>
    /\d+%|\d+x|\d+Hz|vs|compared to|instead of/.test(text || '') || 
    /(blood flow|brain waves|alpha|beta|cortex|hormone|dopamine|serotonin)/i.test(text || '');
  
  const topWithMechanisms = topPerformers.filter(p => hasMechanism(p.content || ''));
  const topWithDetails = topPerformers.filter(p => hasInterestingDetails(p.content || ''));
  const lowWithMechanisms = lowPerformers.filter(p => hasMechanism(p.content || ''));
  const lowWithDetails = lowPerformers.filter(p => hasInterestingDetails(p.content || ''));
  
  if (topWithMechanisms.length > topPerformers.length * 0.5) {
    const percentage = ((topWithMechanisms.length / topPerformers.length) * 100).toFixed(0);
    const avgViewsWithMechanisms = topPerformers
      .filter(p => hasMechanism(p.content || ''))
      .reduce((sum, p) => sum + (p.actual_impressions || 0), 0) / topWithMechanisms.length;
    insights.push(`${percentage}% of your top-performing posts include mechanisms (HOW/WHY it works). Posts with mechanisms averaged ${avgViewsWithMechanisms.toFixed(0)} views. Interesting depth performs better than shallow quotes.`);
  }
  
  if (topWithDetails.length > topPerformers.length * 0.5) {
    const percentage = ((topWithDetails.length / topPerformers.length) * 100).toFixed(0);
    insights.push(`${percentage}% of your top-performing posts include interesting details (numbers, comparisons, biological specifics). Specific depth beats generic statements.`);
  }
  
  // Compare mechanism rates between top and low performers
  const topMechanismRate = topWithMechanisms.length / topPerformers.length;
  const lowMechanismRate = lowWithMechanisms.length / lowPerformers.length;
  if (topMechanismRate > lowMechanismRate * 1.3) {
    insights.push(`Your top performers are ${((topMechanismRate / lowMechanismRate) * 100).toFixed(0)}% more likely to include mechanisms. Deep content with explanations outperforms shallow quotes.`);
  }
  
  return insights;
}

/**
 * PRIVATE: Generate actionable insights WITHOUT commanding
 */
function generateActionableInsights(
  growth: any,
  momentum: any,
  patterns: any[],
  ceiling: any,
  diversity: any
): string {
  const insights: string[] = [];
  
  // Insight 1: Growth status
  if (growth.trend === 'accelerating') {
    insights.push("- Growth is accelerating - current experiments are working! Continue pushing boundaries.");
  } else if (growth.trend === 'flat' || ceiling.isSettling) {
    insights.push("- Performance plateauing - need NEW approaches to break through ceiling.");
  } else if (growth.trend === 'declining') {
    insights.push("- Performance declining - pivot to completely different approaches.");
  }
  
  // Insight 2: Momentum opportunities
  if (momentum.topics.length > 0) {
    const top = momentum.topics[0];
    insights.push(`- "${top.value}" showing momentum - gaining traction even if absolute numbers still low.`);
  }
  
  if (momentum.generators.length > 0) {
    const top = momentum.generators[0];
    insights.push(`- ${top.value} generator trending up - ${top.recommendation}`);
  }
  
  // Insight 3: Pattern discoveries
  if (patterns.length > 0) {
    const topPattern = patterns[0];
    insights.push(`- Pattern "${topPattern.pattern}" performing well - could be transferable to new topics.`);
  }
  
  // Insight 4: Potential gap
  if (ceiling.currentCeiling < ceiling.potentialCeiling / 3) {
    insights.push(`- Huge gap between current (${ceiling.currentCeiling}) and potential (${ceiling.potentialCeiling}+) - opportunity for breakthrough!`);
  }
  
  // Insight 5: Diversity health
  if (!diversity.healthy) {
    insights.push(`- Diversity issues detected: ${diversity.issues[0]}`);
  }
  
  return insights.join('\n');
}

/**
 * PRIVATE: Format momentum signal for intelligence package
 */
function formatMomentumSignal(signal: any): MomentumSignal {
  return {
    value: signal.value,
    trajectory: signal.trajectory,
    momentum: signal.momentum,
    recommendation: signal.recommendation,
    confidence: signal.confidence,
    firstAvg: signal.firstAvg,
    secondAvg: signal.secondAvg,
    growthRate: signal.growthRate
  };
}


/**
 * 🧠 INTELLIGENCE BUILDER
 * 
 * Combines temporal and variance analysis to build strategic intelligence:
 * - What factors matter most?
 * - What's gaining/losing traction?
 * - What works across all combinations?
 * - Strategic recommendations for human decision-making
 */

import { getTemporalAnalytics, FactorMomentum, AccountGrowth } from './temporalAnalytics';
import { getVarianceAnalyzer, FactorAggregate, FactorImportance, Synergy } from './varianceAnalyzer';

export interface SystemIntelligence {
  // Overall account health
  accountHealth: {
    totalPosts: number;
    currentAvgViews: number;
    weekOverWeekGrowth: number;
    trend: 'GROWING' | 'DECLINING' | 'FLAT';
    status: string;
  };

  // Factor importance rankings
  factorImportance: FactorImportance[];

  // Temporal patterns
  momentum: {
    visualFormats: {
      rising: FactorMomentum[];
      declining: FactorMomentum[];
      stable: FactorMomentum[];
    };
    tones: {
      rising: FactorMomentum[];
      declining: FactorMomentum[];
      stable: FactorMomentum[];
    };
    generators: {
      rising: FactorMomentum[];
      declining: FactorMomentum[];
      stable: FactorMomentum[];
    };
  };

  // Aggregate insights (CRITICAL - your key insight!)
  aggregates: {
    visualFormats: FactorAggregate[];
    tones: FactorAggregate[];
    generators: FactorAggregate[];
    topics: FactorAggregate[];
  };

  // Synergies
  synergies: {
    positive: Synergy[];
    negative: Synergy[];
  };

  // Strategic recommendations
  recommendations: string[];

  // Sample size assessment
  readiness: {
    totalPosts: number;
    recommendedForOptimization: number;
    status: 'INSUFFICIENT_DATA' | 'PATTERNS_EMERGING' | 'READY_FOR_OPTIMIZATION';
    confidence: 'LOW' | 'MEDIUM' | 'HIGH';
    recommendation: string;
  };

  // Generated timestamp
  generatedAt: string;
}

export class IntelligenceBuilder {
  private static instance: IntelligenceBuilder;

  private constructor() {}

  public static getInstance(): IntelligenceBuilder {
    if (!IntelligenceBuilder.instance) {
      IntelligenceBuilder.instance = new IntelligenceBuilder();
    }
    return IntelligenceBuilder.instance;
  }

  /**
   * Build complete system intelligence from all data
   */
  async buildSystemIntelligence(): Promise<SystemIntelligence> {
    console.log('[INTELLIGENCE] 🧠 Building system intelligence...');

    const temporal = getTemporalAnalytics();
    const variance = getVarianceAnalyzer();

    // Gather all analyses
    const [
      accountGrowth,
      factorImportance,
      visualMomentum,
      toneMomentum,
      generatorMomentum,
      visualAggregates,
      toneAggregates,
      generatorAggregates,
      topicAggregates,
      synergies
    ] = await Promise.all([
      temporal.analyzeAccountGrowth(),
      variance.calculateFactorImportance(),
      temporal.analyzeFactorMomentum('visual_format'),
      temporal.analyzeFactorMomentum('tone'),
      temporal.analyzeFactorMomentum('generator_name'),
      variance.analyzeFactorAggregates('visual_format'),
      variance.analyzeFactorAggregates('tone'),
      variance.analyzeFactorAggregates('generator_name'),
      variance.analyzeFactorAggregates('raw_topic'),
      variance.findSynergies(5)
    ]);

    // Categorize momentum
    const categorizeMomentum = (momentum: FactorMomentum[]) => ({
      rising: momentum.filter(m => m.status === 'ACCELERATING' || m.status === 'GROWING'),
      declining: momentum.filter(m => m.status === 'DECLINING' || m.status === 'DEAD'),
      stable: momentum.filter(m => m.status === 'STABLE')
    });

    // Build readiness assessment
    const readiness = this.assessReadiness(accountGrowth.totalPosts);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      accountGrowth,
      factorImportance,
      momentum: { visualMomentum, toneMomentum, generatorMomentum },
      aggregates: { visualAggregates, toneAggregates, generatorAggregates },
      readiness
    });

    const intelligence: SystemIntelligence = {
      accountHealth: {
        totalPosts: accountGrowth.totalPosts,
        currentAvgViews: accountGrowth.weekly[accountGrowth.weekly.length - 1]?.avgViews || 0,
        weekOverWeekGrowth: accountGrowth.weekOverWeekChange,
        trend: accountGrowth.trend,
        status: this.determineAccountStatus(accountGrowth)
      },

      factorImportance,

      momentum: {
        visualFormats: categorizeMomentum(visualMomentum),
        tones: categorizeMomentum(toneMomentum),
        generators: categorizeMomentum(generatorMomentum)
      },

      aggregates: {
        visualFormats: visualAggregates,
        tones: toneAggregates,
        generators: generatorAggregates,
        topics: topicAggregates
      },

      synergies: {
        positive: synergies.filter(s => s.multiplier > 1.3),
        negative: synergies.filter(s => s.multiplier < 0.7)
      },

      recommendations,

      readiness,

      generatedAt: new Date().toISOString()
    };

    console.log('[INTELLIGENCE] ✅ Intelligence built successfully');
    console.log(`[INTELLIGENCE] 📊 Status: ${readiness.status}`);
    console.log(`[INTELLIGENCE] 🎯 Top factor: ${factorImportance[0].factor} (${factorImportance[0].percentExplained.toFixed(0)}%)`);

    return intelligence;
  }

  // ═══════════════════════════════════════════════════════════
  // HELPER METHODS
  // ═══════════════════════════════════════════════════════════

  private assessReadiness(totalPosts: number): SystemIntelligence['readiness'] {
    let status: SystemIntelligence['readiness']['status'];
    let confidence: SystemIntelligence['readiness']['confidence'];
    let recommendation: string;

    if (totalPosts < 200) {
      status = 'INSUFFICIENT_DATA';
      confidence = 'LOW';
      recommendation = 'Keep collecting diverse data. Need 500+ posts for confident patterns.';
    } else if (totalPosts < 500) {
      status = 'PATTERNS_EMERGING';
      confidence = 'MEDIUM';
      recommendation = 'Patterns starting to emerge. Review insights but wait for 500+ posts before major optimizations.';
    } else {
      status = 'READY_FOR_OPTIMIZATION';
      confidence = 'HIGH';
      recommendation = 'Sample size sufficient. Review patterns and make strategic adjustments.';
    }

    return {
      totalPosts,
      recommendedForOptimization: 500,
      status,
      confidence,
      recommendation
    };
  }

  private determineAccountStatus(growth: AccountGrowth): string {
    const current = growth.weekly[growth.weekly.length - 1]?.avgViews || 0;
    
    if (current > 1000) return 'viral_potential';
    if (current > 500) return 'strong_growth';
    if (current > 200) return 'growing_well';
    if (current > 100) return 'improving';
    if (growth.trend === 'GROWING') return 'improving_but_not_viral';
    if (growth.trend === 'DECLINING') return 'declining';
    return 'stagnant';
  }

  private generateRecommendations(context: any): string[] {
    const recommendations: string[] = [];

    // Sample size check
    if (context.readiness.status === 'INSUFFICIENT_DATA') {
      recommendations.push('⏳ Keep collecting data - sample size too small for optimization');
      return recommendations;
    }

    // Factor importance insights
    const topFactor = context.factorImportance[0];
    if (topFactor) {
      recommendations.push(`🎯 ${topFactor.factor} explains ${topFactor.percentExplained.toFixed(0)}% of variance - focus optimization here`);
    }

    // Rising patterns
    if (context.momentum.visualMomentum.rising.length > 0) {
      const top = context.momentum.visualMomentum.rising[0];
      recommendations.push(`🚀 ${top.value} is accelerating (+${top.growth.toFixed(0)}% growth) - consider increasing usage`);
    }

    // Declining patterns
    if (context.momentum.visualMomentum.declining.length > 0) {
      const declining = context.momentum.visualMomentum.declining[0];
      recommendations.push(`📉 ${declining.value} is declining (${declining.growth.toFixed(0)}%) - consider reducing usage`);
    }

    // Account health
    if (context.accountGrowth.trend === 'GROWING') {
      recommendations.push(`✅ Overall account growing (+${context.accountGrowth.growthRate.toFixed(0)}%) - something is working`);
    } else if (context.accountGrowth.trend === 'DECLINING') {
      recommendations.push(`⚠️ Overall account declining - need strategic changes`);
    }

    // Aggregate insights
    if (context.aggregates.visualAggregates.length > 0) {
      const top = context.aggregates.visualAggregates[0];
      const bottom = context.aggregates.visualAggregates[context.aggregates.visualAggregates.length - 1];
      
      if (top.avgViews > bottom.avgViews * 2) {
        recommendations.push(`💡 ${top.value} outperforms ${bottom.value} by ${(top.avgViews / bottom.avgViews).toFixed(1)}x across all combinations`);
      }
    }

    // Sample size warning
    if (context.readiness.status === 'PATTERNS_EMERGING') {
      recommendations.push(`📊 ${context.accountGrowth.totalPosts} posts analyzed - patterns emerging but not fully confident yet`);
    }

    return recommendations;
  }
}

/**
 * Singleton getter
 */
export function getIntelligenceBuilder(): IntelligenceBuilder {
  return IntelligenceBuilder.getInstance();
}

/**
 * Quick access function
 */
export async function buildSystemIntelligence(): Promise<SystemIntelligence> {
  return getIntelligenceBuilder().buildSystemIntelligence();
}


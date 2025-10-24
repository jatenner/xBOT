/**
 * 🔍 COMPETITOR INTELLIGENCE MONITOR
 * 
 * Monitors top health accounts to identify:
 * - Trending topics before they peak
 * - Content gaps we can fill
 * - Optimal posting patterns
 * - Viral content strategies
 */

import { getSupabaseClient } from '../db/index';

export interface CompetitorProfile {
  username: string;
  follower_count: number;
  avg_engagement_rate: number;
  posting_frequency: number; // posts per day
  top_topics: string[];
  optimal_posting_hours: number[];
  viral_content_patterns: string[];
}

export interface TrendingOpportunity {
  topic: string;
  trending_score: number; // 0-1
  competition_level: number; // 0-1, lower = less competition
  viral_potential: number; // 0-1
  content_gap_identified: boolean;
  suggested_angle: string;
  timing_window: string;
}

export interface CompetitorInsights {
  trending_opportunities: TrendingOpportunity[];
  content_gaps: Array<{
    topic: string;
    gap_description: string;
    opportunity_score: number;
  }>;
  optimal_timing: {
    best_hours: number[];
    avoid_hours: number[];
    reasoning: string;
  };
  competitor_performance: Array<{
    username: string;
    recent_viral_content: string;
    engagement_rate: number;
    posting_pattern: string;
  }>;
}

export class CompetitorIntelligenceMonitor {
  private static instance: CompetitorIntelligenceMonitor;
  
  private topHealthAccounts = [
    'hubermanlab',
    'drmarkhyman', 
    'bengreenfield',
    'drdavinagustafson',
    'drweils',
    'thefoodbabe',
    'draxe',
    'drfunctionalmed',
    'thebiohacker',
    'drruscio'
  ];
  
  public static getInstance(): CompetitorIntelligenceMonitor {
    if (!CompetitorIntelligenceMonitor.instance) {
      CompetitorIntelligenceMonitor.instance = new CompetitorIntelligenceMonitor();
    }
    return CompetitorIntelligenceMonitor.instance;
  }

  /**
   * 🎯 Get comprehensive competitor insights
   */
  public async getCompetitorInsights(): Promise<CompetitorInsights> {
    console.log('🔍 COMPETITOR_INTELLIGENCE: Analyzing top health accounts for opportunities...');
    
    try {
      const [
        trendingTopics,
        contentGaps,
        timingInsights,
        performanceData
      ] = await Promise.all([
        this.identifyTrendingOpportunities(),
        this.identifyContentGaps(),
        this.analyzeOptimalTiming(),
        this.getCompetitorPerformance()
      ]);

      const insights: CompetitorInsights = {
        trending_opportunities: trendingTopics,
        content_gaps: contentGaps,
        optimal_timing: timingInsights,
        competitor_performance: performanceData
      };

      console.log(`✅ COMPETITOR_ANALYSIS: Found ${trendingTopics.length} trending opportunities, ${contentGaps.length} content gaps`);
      
      // Store insights for historical analysis
      await this.storeCompetitorInsights(insights);
      
      return insights;

    } catch (error: any) {
      console.error('❌ COMPETITOR_INTELLIGENCE_ERROR:', error.message);
      return this.getDefaultInsights();
    }
  }

  /**
   * 📈 Identify trending opportunities
   */
  private async identifyTrendingOpportunities(): Promise<TrendingOpportunity[]> {
    try {
      // Simulate trending topic detection
      // In production, this would analyze real competitor content via Twitter API
      
      // 🔥 FIX: Check recent posts to avoid topic repetition
      const supabase = getSupabaseClient();
      const { data: recentPosts } = await supabase
        .from('content_metadata')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(10);
      
      const recentContent = recentPosts?.map(p => String(p.content || '').toLowerCase()).join(' ') || '';
      
      // Expanded topic pool for more diversity
      const allTrends = [
        {
          topic: 'NAD+ supplementation',
          trending_score: 0.8,
          competition_level: 0.4,
          viral_potential: 0.7,
          suggested_angle: 'Natural ways to boost NAD+ without expensive supplements',
          timing_window: 'Next 24-48 hours',
          keywords: ['nad', 'nad+', 'nicotinamide']
        },
        {
          topic: 'Circadian light therapy',
          trending_score: 0.7,
          competition_level: 0.3,
          viral_potential: 0.8,
          suggested_angle: 'DIY circadian optimization with household items',
          timing_window: 'Next 12 hours',
          keywords: ['circadian', 'light therapy', 'blue light', 'rhythm']
        },
        {
          topic: 'Metabolic flexibility training',
          trending_score: 0.6,
          competition_level: 0.5,
          viral_potential: 0.6,
          suggested_angle: 'Simple metabolic flexibility tests you can do at home',
          timing_window: 'Next 3 days',
          keywords: ['metabolic', 'flexibility', 'ketone']
        },
        {
          topic: 'Microplastic detox protocols',
          trending_score: 0.9,
          competition_level: 0.2,
          viral_potential: 0.9,
          suggested_angle: 'Evidence-based methods to reduce microplastic exposure',
          timing_window: 'URGENT - Next 6 hours',
          keywords: ['microplastic', 'detox', 'plastic']
        },
        {
          topic: 'Zone 2 cardio optimization',
          trending_score: 0.75,
          competition_level: 0.35,
          viral_potential: 0.8,
          suggested_angle: 'Why elite athletes spend 80% of training in Zone 2',
          timing_window: 'Next 2 days',
          keywords: ['zone 2', 'cardio', 'aerobic', 'endurance']
        },
        {
          topic: 'Protein timing myths',
          trending_score: 0.7,
          competition_level: 0.4,
          viral_potential: 0.75,
          suggested_angle: 'The anabolic window is longer than you think',
          timing_window: 'Next 48 hours',
          keywords: ['protein', 'timing', 'anabolic', 'window']
        },
        {
          topic: 'Cold exposure protocols',
          trending_score: 0.65,
          competition_level: 0.5,
          viral_potential: 0.7,
          suggested_angle: 'Cold showers vs ice baths: what science actually says',
          timing_window: 'Next 3 days',
          keywords: ['cold', 'exposure', 'ice', 'bath', 'shower']
        },
        {
          topic: 'Glucose monitoring insights',
          trending_score: 0.8,
          competition_level: 0.3,
          viral_potential: 0.85,
          suggested_angle: 'What CGMs reveal about "healthy" foods',
          timing_window: 'Next 24 hours',
          keywords: ['glucose', 'cgm', 'monitor', 'blood sugar']
        },
        {
          topic: 'Sauna benefits beyond heat',
          trending_score: 0.7,
          competition_level: 0.4,
          viral_potential: 0.75,
          suggested_angle: 'Sauna protocols for longevity and brain health',
          timing_window: 'Next 2 days',
          keywords: ['sauna', 'heat', 'infrared']
        },
        {
          topic: 'Electrolyte optimization',
          trending_score: 0.65,
          competition_level: 0.45,
          viral_potential: 0.7,
          suggested_angle: 'Why you need more than water for hydration',
          timing_window: 'Next 3 days',
          keywords: ['electrolyte', 'sodium', 'potassium', 'magnesium', 'hydration']
        }
      ];
      
      // Filter out topics we've recently covered
      const freshTrends = allTrends.filter(trend => {
        const hasRecentCoverage = trend.keywords.some(keyword => 
          recentContent.includes(keyword.toLowerCase())
        );
        if (hasRecentCoverage) {
          console.log(`[COMPETITOR_INTEL] 🔄 Skipping recently covered topic: ${trend.topic}`);
        }
        return !hasRecentCoverage;
      });
      
      console.log(`[COMPETITOR_INTEL] ✅ Filtered ${allTrends.length} → ${freshTrends.length} fresh topics`);
      
      // If all topics were recently covered, shuffle and take top 4 anyway
      const selectedTrends = freshTrends.length > 0 
        ? freshTrends.slice(0, 4)
        : allTrends.sort(() => Math.random() - 0.5).slice(0, 4);

      // Add content gap identification
      return selectedTrends.map(trend => ({
        topic: trend.topic,
        trending_score: trend.trending_score,
        competition_level: trend.competition_level,
        viral_potential: trend.viral_potential,
        suggested_angle: trend.suggested_angle,
        timing_window: trend.timing_window,
        content_gap_identified: trend.competition_level < 0.4
      }));

    } catch (error) {
      return [];
    }
  }

  /**
   * 🎯 Identify content gaps
   */
  private async identifyContentGaps(): Promise<Array<{
    topic: string;
    gap_description: string;
    opportunity_score: number;
  }>> {
    try {
      // Simulate content gap analysis
      // In production, this would analyze what competitors are NOT talking about
      
      return [
        {
          topic: 'Epigenetic lifestyle factors',
          gap_description: 'No one is explaining how daily habits affect gene expression in simple terms',
          opportunity_score: 0.85
        },
        {
          topic: 'Mitochondrial health for beginners',
          gap_description: 'Complex topic needs accessible, actionable content',
          opportunity_score: 0.78
        },
        {
          topic: 'Seasonal eating patterns',
          gap_description: 'Most content focuses on year-round diets, seasonal approach underexplored',
          opportunity_score: 0.72
        },
        {
          topic: 'Technology-free wellness',
          gap_description: 'Everyone talks about health tech, no one covers low-tech solutions',
          opportunity_score: 0.82
        }
      ];

    } catch (error) {
      return [];
    }
  }

  /**
   * ⏰ Analyze optimal timing based on competitor patterns
   */
  private async analyzeOptimalTiming(): Promise<{
    best_hours: number[];
    avoid_hours: number[];
    reasoning: string;
  }> {
    try {
      // Simulate competitor posting pattern analysis
      // In production, this would analyze when competitors post and their engagement
      
      const competitorPostingHours = [
        { hour: 6, competitor_count: 2, avg_engagement: 0.04 },
        { hour: 7, competitor_count: 3, avg_engagement: 0.05 },
        { hour: 8, competitor_count: 5, avg_engagement: 0.03 }, // High competition
        { hour: 9, competitor_count: 4, avg_engagement: 0.06 },
        { hour: 10, competitor_count: 2, avg_engagement: 0.07 }, // Low competition, high engagement
        { hour: 11, competitor_count: 3, avg_engagement: 0.05 },
        { hour: 12, competitor_count: 6, avg_engagement: 0.04 }, // High competition
        { hour: 13, competitor_count: 4, avg_engagement: 0.05 },
        { hour: 14, competitor_count: 2, avg_engagement: 0.06 },
        { hour: 15, competitor_count: 1, avg_engagement: 0.08 }, // Very low competition
        { hour: 16, competitor_count: 3, avg_engagement: 0.05 },
        { hour: 17, competitor_count: 5, avg_engagement: 0.04 },
        { hour: 18, competitor_count: 4, avg_engagement: 0.06 },
        { hour: 19, competitor_count: 6, avg_engagement: 0.05 }, // High competition
        { hour: 20, competitor_count: 3, avg_engagement: 0.07 },
        { hour: 21, competitor_count: 2, avg_engagement: 0.06 }
      ];

      // Find best hours (low competition + high engagement)
      const bestHours = competitorPostingHours
        .filter(h => h.competitor_count <= 3 && h.avg_engagement >= 0.06)
        .map(h => h.hour)
        .sort();

      // Find hours to avoid (high competition)
      const avoidHours = competitorPostingHours
        .filter(h => h.competitor_count >= 5)
        .map(h => h.hour)
        .sort();

      return {
        best_hours: bestHours,
        avoid_hours: avoidHours,
        reasoning: `Best hours have <3 competitors posting with >6% engagement. Avoid hours have 5+ competitors active.`
      };

    } catch (error) {
      return {
        best_hours: [10, 15, 20],
        avoid_hours: [8, 12, 19],
        reasoning: 'Default timing based on general health audience patterns'
      };
    }
  }

  /**
   * 📊 Get competitor performance data
   */
  private async getCompetitorPerformance(): Promise<Array<{
    username: string;
    recent_viral_content: string;
    engagement_rate: number;
    posting_pattern: string;
  }>> {
    try {
      // Simulate competitor performance analysis
      // In production, this would track actual competitor metrics
      
      return [
        {
          username: 'hubermanlab',
          recent_viral_content: 'Cold exposure protocol for dopamine optimization (2.3M views)',
          engagement_rate: 0.08,
          posting_pattern: '1-2 long-form posts per day, heavy on research citations'
        },
        {
          username: 'drmarkhyman',
          recent_viral_content: 'Functional medicine approach to autoimmune conditions',
          engagement_rate: 0.06,
          posting_pattern: '3-4 posts per day, mix of educational and promotional'
        },
        {
          username: 'bengreenfield',
          recent_viral_content: 'Biohacking tools for cognitive enhancement',
          engagement_rate: 0.07,
          posting_pattern: '2-3 posts per day, focus on cutting-edge protocols'
        }
      ];

    } catch (error) {
      return [];
    }
  }

  /**
   * 💾 Store competitor insights for historical analysis
   */
  private async storeCompetitorInsights(insights: CompetitorInsights): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      await supabase.from('competitor_intelligence').insert({
        analysis_timestamp: new Date().toISOString(),
        trending_opportunities: insights.trending_opportunities,
        content_gaps: insights.content_gaps,
        optimal_timing: insights.optimal_timing,
        competitor_performance: insights.competitor_performance,
        total_opportunities: insights.trending_opportunities.length,
        total_gaps: insights.content_gaps.length
      });

      console.log('💾 COMPETITOR_INSIGHTS_STORED: Analysis saved for historical tracking');

    } catch (error: any) {
      console.error('❌ INSIGHTS_STORAGE_ERROR:', error.message);
    }
  }

  /**
   * 🎯 Get actionable recommendations based on insights
   */
  public async getActionableRecommendations(): Promise<{
    urgent_opportunities: string[];
    content_suggestions: string[];
    timing_recommendations: string[];
  }> {
    const insights = await this.getCompetitorInsights();
    
    const urgentOpportunities = insights.trending_opportunities
      .filter(op => op.trending_score > 0.7 && op.competition_level < 0.4)
      .map(op => `🚨 URGENT: ${op.topic} - ${op.suggested_angle} (${op.timing_window})`)
      .slice(0, 3);

    const contentSuggestions = insights.content_gaps
      .filter(gap => gap.opportunity_score > 0.75)
      .map(gap => `💡 CONTENT GAP: ${gap.topic} - ${gap.gap_description}`)
      .slice(0, 3);

    const timingRecommendations = [
      `⏰ OPTIMAL HOURS: ${insights.optimal_timing.best_hours.join(', ')}`,
      `❌ AVOID HOURS: ${insights.optimal_timing.avoid_hours.join(', ')}`,
      `📊 REASONING: ${insights.optimal_timing.reasoning}`
    ];

    return {
      urgent_opportunities: urgentOpportunities,
      content_suggestions: contentSuggestions,
      timing_recommendations: timingRecommendations
    };
  }

  /**
   * 📊 Get default insights when analysis fails
   */
  private getDefaultInsights(): CompetitorInsights {
    return {
      trending_opportunities: [],
      content_gaps: [],
      optimal_timing: {
        best_hours: [9, 13, 20],
        avoid_hours: [8, 12, 19],
        reasoning: 'Default timing pattern'
      },
      competitor_performance: []
    };
  }
}

// Export singleton
export const competitorIntelligenceMonitor = CompetitorIntelligenceMonitor.getInstance();

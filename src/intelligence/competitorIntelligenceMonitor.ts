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
   * 📈 Identify trending opportunities - 100% AI-GENERATED (NO HARDCODED TOPICS)
   */
  private async identifyTrendingOpportunities(): Promise<TrendingOpportunity[]> {
    try {
      console.log('[COMPETITOR_INTEL] 🤖 Using AI to generate trending topics (no hardcoded lists)...');
      
      // Get recent posts to avoid repetition (TEMPORARY 20-post window)
      const supabase = getSupabaseClient();
      const { data: recentPosts } = await supabase
        .from('content_metadata')
        .select('content, topic_cluster')
        .order('created_at', { ascending: false })
        .limit(20); // Check last 20 posts for TEMPORARY avoidance
      
      // Extract KEY KEYWORDS from content (not full text)
      const recentKeywords = recentPosts?.map(p => {
        const content = String(p.content || '').toLowerCase();
        // Extract important health/wellness keywords
        const keywords = content.match(/\b(microbiome|gut|circadian|rhythm|nad\+|fasting|sleep|exercise|protein|ketone|glucose|inflammation|longevity|mitochondria|autophagy|hormone|thyroid|testosterone|estrogen|cortisol|insulin|serotonin|dopamine|meditation|breathwork|cold|heat|sauna|supplement|vitamin|mineral|fiber|probiotic|prebiotic|polyphenol|antioxidant|metabolic|cardiovascular|cognitive|brain|mental|anxiety|depression|stress|recovery|muscle|strength|endurance|vo2|hrv|zone 2|hiit|carb|fat|omega|keto|carnivore|vegan|plant-based|paleo|16:8|intermittent)\b/g);
        return keywords || [];
      }).flat() || [];
      
      // Get unique keywords
      const uniqueKeywords = [...new Set(recentKeywords)];
      console.log(`[COMPETITOR_INTEL] 📚 Keywords to avoid (for next 20 posts): ${uniqueKeywords.slice(0, 10).join(', ')}${uniqueKeywords.length > 10 ? '...' : ''}`);
      
      // Pass keywords to AI (these will be avoided for next ~20 posts, then fair game again)
      const recentTopics = uniqueKeywords;
      
      // 🔥 USE AI TO GENERATE TRENDING TOPICS DYNAMICALLY
      const { DynamicTopicGenerator } = await import('./dynamicTopicGenerator');
      const topicGenerator = DynamicTopicGenerator.getInstance();
      
      // Generate 4 unique trending topics using AI
      const aiTopics: TrendingOpportunity[] = [];
      
      for (let i = 0; i < 4; i++) {
        try {
          const dynamicTopic = await topicGenerator.generateTopic({
            recentTopics: [
              ...recentTopics,
              ...aiTopics.map(t => t.topic) // Also avoid duplicates within this batch
            ],
            preferTrending: true // Focus on viral potential
          });
          
          aiTopics.push({
            topic: dynamicTopic.topic,
            trending_score: dynamicTopic.viral_potential,
            competition_level: Math.random() * 0.5, // Simulate competition (0-50%)
            viral_potential: dynamicTopic.viral_potential,
            suggested_angle: dynamicTopic.angle,
            timing_window: 'Next 24-48 hours',
            content_gap_identified: dynamicTopic.viral_potential > 0.7
          });
          
          console.log(`[COMPETITOR_INTEL] ✅ AI generated topic ${i + 1}/4: "${dynamicTopic.topic}"`);
          
        } catch (topicError: any) {
          console.warn(`[COMPETITOR_INTEL] ⚠️ Failed to generate topic ${i + 1}:`, topicError.message);
        }
      }
      
      console.log(`[COMPETITOR_INTEL] 🎯 Generated ${aiTopics.length} AI-driven topics (0 hardcoded)`);
      
      return aiTopics;

    } catch (error: any) {
      console.error('[COMPETITOR_INTEL] ❌ AI topic generation failed:', error.message);
      
      // If AI fails completely, return empty array (no hardcoded fallbacks!)
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

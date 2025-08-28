import OpenAI from 'openai';
import { admin } from '../lib/supabaseClients';

interface CompetitorPost {
  content: string;
  engagement: {
    likes: number;
    retweets: number;
    replies: number;
  };
  timestamp: string;
  account: string;
  viral_score: number;
  content_type: 'educational' | 'controversial' | 'personal' | 'news' | 'thread';
}

interface ViralPattern {
  pattern_type: 'hook' | 'structure' | 'topic' | 'timing' | 'format';
  description: string;
  examples: string[];
  success_rate: number;
  avg_engagement: number;
  recommended_use: string;
  confidence: number;
}

interface CompetitorInsights {
  top_performing_patterns: ViralPattern[];
  emerging_topics: string[];
  optimal_timing: {
    best_hours: number[];
    best_days: string[];
    posting_frequency: string;
  };
  content_gaps: string[];
  strategic_opportunities: string[];
  threat_analysis: string[];
}

interface TrendAnalysis {
  trending_topics: Array<{
    topic: string;
    momentum: number;
    opportunity_score: number;
    saturation_level: number;
  }>;
  content_formats: Array<{
    format: string;
    performance_trend: 'rising' | 'stable' | 'declining';
    recommendation: string;
  }>;
  timing_insights: {
    peak_engagement_windows: string[];
    low_competition_windows: string[];
  };
}

/**
 * 🔍 COMPETITOR INTELLIGENCE ENGINE
 * Advanced AI system that analyzes competitor content, identifies viral patterns,
 * and provides strategic recommendations for competitive advantage
 */
export class CompetitorIntelligenceEngine {
  private static instance: CompetitorIntelligenceEngine;
  private openai: OpenAI;
  private competitorData: CompetitorPost[] = [];
  private viralPatterns: ViralPattern[] = [];
  private lastAnalysis: Date | null = null;

  // Target competitors in health/optimization space
  private competitors = [
    'EricTopol', 'VinodKhosla', 'andrewyng', 'DrDavidFeinberg',
    'AlexHormozi', 'hubermanlab', 'RhondaPatrickPhD', 'foundmyfitness',
    'DrMarkHyman', 'drdavindersingh', 'bengreenfield', 'PeterAttiaMD'
  ];

  private constructor() {
    this.openai = new OpenAI({ 
      apiKey: process.env.OPENAI_API_KEY 
    });
  }

  public static getInstance(): CompetitorIntelligenceEngine {
    if (!CompetitorIntelligenceEngine.instance) {
      CompetitorIntelligenceEngine.instance = new CompetitorIntelligenceEngine();
    }
    return CompetitorIntelligenceEngine.instance;
  }

  /**
   * 🎯 MAIN INTELLIGENCE: Analyze competitors and extract strategic insights
   */
  public async analyzeCompetitorLandscape(): Promise<CompetitorInsights> {
    console.log('🔍 COMPETITOR_AI: Beginning competitive intelligence analysis...');

    try {
      // 1. Gather competitor data (simulated - would connect to real APIs)
      await this.gatherCompetitorData();
      
      // 2. Identify viral patterns
      const viralPatterns = await this.identifyViralPatterns();
      
      // 3. Analyze trends and opportunities
      const trendAnalysis = await this.analyzeTrends();
      
      // 4. Generate strategic insights
      const insights = await this.generateStrategicInsights(viralPatterns, trendAnalysis);
      
      this.lastAnalysis = new Date();
      console.log(`✅ COMPETITOR_AI: Analysis complete - found ${viralPatterns.length} viral patterns`);
      
      return insights;

    } catch (error: any) {
      console.error('❌ COMPETITOR_AI: Analysis failed:', error.message);
      
      return this.generateFallbackInsights();
    }
  }

  /**
   * 📊 COMPETITOR DATA GATHERING: Collect recent competitor posts
   */
  private async gatherCompetitorData(): Promise<void> {
    console.log('📊 COMPETITOR_AI: Gathering competitor data...');

    // In a real implementation, this would scrape or use APIs
    // For now, we'll simulate with realistic health optimization content
    const simulatedPosts: CompetitorPost[] = [
      {
        content: "🚨 BREAKING: New study shows intermittent fasting can reverse type 2 diabetes in 90% of patients within 6 months. The protocol they used:",
        engagement: { likes: 2847, retweets: 892, replies: 423 },
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        account: 'EricTopol',
        viral_score: 94,
        content_type: 'news'
      },
      {
        content: "Unpopular opinion: Your sleep tracker is making your sleep worse. Here's why I threw mine away and slept better immediately:",
        engagement: { likes: 1923, retweets: 445, replies: 678 },
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        account: 'hubermanlab',
        viral_score: 87,
        content_type: 'controversial'
      },
      {
        content: "3 years ago I was exhausted every morning. Today I wake up energized without an alarm. Here's exactly what changed (thread):",
        engagement: { likes: 3412, retweets: 1203, replies: 834 },
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        account: 'AlexHormozi',
        viral_score: 96,
        content_type: 'personal'
      },
      {
        content: "The supplement industry doesn't want you to know this: 97% of vitamin D supplements are synthetic garbage. Here's what works:",
        engagement: { likes: 1567, retweets: 389, replies: 234 },
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
        account: 'bengreenfield',
        viral_score: 82,
        content_type: 'controversial'
      },
      {
        content: "Complete guide to optimizing your circadian rhythm for better sleep, mood, and metabolism:",
        engagement: { likes: 892, retweets: 267, replies: 156 },
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
        account: 'RhondaPatrickPhD',
        viral_score: 71,
        content_type: 'educational'
      }
    ];

    this.competitorData = simulatedPosts;
    console.log(`📊 Loaded ${this.competitorData.length} competitor posts for analysis`);
  }

  /**
   * 🔥 VIRAL PATTERN IDENTIFICATION: Use AI to identify what makes content viral
   */
  private async identifyViralPatterns(): Promise<ViralPattern[]> {
    console.log('🔥 COMPETITOR_AI: Identifying viral patterns...');

    const highPerformingPosts = this.competitorData
      .filter(post => post.viral_score > 80)
      .sort((a, b) => b.viral_score - a.viral_score);

    const prompt = `Analyze these high-performing competitor posts and identify the viral patterns that make them successful.

HIGH-PERFORMING POSTS:
${highPerformingPosts.map((post, i) => 
  `${i+1}. "${post.content}" (${post.engagement.likes} likes, ${post.engagement.retweets} retweets) - ${post.content_type}`
).join('\n')}

Identify the specific patterns that make these posts viral. Look for:
- Hook patterns (how they start)
- Structural elements (numbering, lists, threads)
- Topic approaches (controversial, educational, personal)
- Timing strategies
- Format choices

For each pattern, analyze:
- What makes it work
- How often it succeeds
- When to use it
- Examples from the data

Return as JSON array of patterns:
{
  "patterns": [
    {
      "pattern_type": "hook|structure|topic|timing|format",
      "description": "Clear description of the pattern",
      "examples": ["example1", "example2"],
      "success_rate": 0.85,
      "avg_engagement": 2500,
      "recommended_use": "When and how to use this pattern",
      "confidence": 0.9
    }
  ]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
        max_tokens: 1500
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{"patterns":[]}');
      this.viralPatterns = result.patterns || [];
      
      console.log(`✅ Identified ${this.viralPatterns.length} viral patterns`);
      return this.viralPatterns;

    } catch (error: any) {
      console.error('❌ Viral pattern analysis failed:', error.message);
      
      // Fallback patterns based on the data
      return this.generateFallbackPatterns();
    }
  }

  /**
   * 📈 TREND ANALYSIS: Analyze content trends and opportunities
   */
  private async analyzeTrends(): Promise<TrendAnalysis> {
    const recentPosts = this.competitorData
      .filter(post => new Date(post.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000);

    const prompt = `Analyze these recent competitor posts to identify trends and opportunities in the health optimization space.

RECENT POSTS (24h):
${recentPosts.map(post => 
  `"${post.content}" (${post.engagement.likes} likes) - ${post.account}`
).join('\n')}

Analyze:
1. What topics are trending and gaining momentum?
2. Which content formats are performing best?
3. What timing patterns do you see?
4. What opportunities exist for differentiation?

Return JSON:
{
  "trending_topics": [
    {
      "topic": "topic name",
      "momentum": 0.85,
      "opportunity_score": 0.7,
      "saturation_level": 0.3
    }
  ],
  "content_formats": [
    {
      "format": "format name",
      "performance_trend": "rising|stable|declining",
      "recommendation": "strategic advice"
    }
  ],
  "timing_insights": {
    "peak_engagement_windows": ["time ranges"],
    "low_competition_windows": ["opportunity times"]
  }
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' },
        max_tokens: 800
      });

      const trends = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        trending_topics: trends.trending_topics || [],
        content_formats: trends.content_formats || [],
        timing_insights: trends.timing_insights || {
          peak_engagement_windows: ['7-9 AM', '6-8 PM'],
          low_competition_windows: ['2-4 PM', '9-11 PM']
        }
      };

    } catch (error: any) {
      console.error('❌ Trend analysis failed:', error.message);
      
      return {
        trending_topics: [
          { topic: 'sleep optimization', momentum: 0.8, opportunity_score: 0.7, saturation_level: 0.4 },
          { topic: 'intermittent fasting', momentum: 0.9, opportunity_score: 0.6, saturation_level: 0.6 }
        ],
        content_formats: [
          { format: 'controversial takes', performance_trend: 'rising', recommendation: 'High engagement but use carefully' },
          { format: 'personal stories', performance_trend: 'stable', recommendation: 'Reliable engagement builder' }
        ],
        timing_insights: {
          peak_engagement_windows: ['7-9 AM', '6-8 PM'],
          low_competition_windows: ['2-4 PM', '9-11 PM']
        }
      };
    }
  }

  /**
   * 🎯 STRATEGIC INSIGHTS: Generate actionable competitive intelligence
   */
  private async generateStrategicInsights(patterns: ViralPattern[], trends: TrendAnalysis): Promise<CompetitorInsights> {
    const prompt = `Based on the viral patterns and trend analysis, generate strategic insights for our health optimization Twitter account (@SignalAndSynapse).

VIRAL PATTERNS IDENTIFIED:
${patterns.map(p => `- ${p.pattern_type}: ${p.description} (${p.success_rate * 100}% success rate)`).join('\n')}

TRENDING TOPICS:
${trends.trending_topics.map(t => `- ${t.topic} (momentum: ${t.momentum}, opportunity: ${t.opportunity_score})`).join('\n')}

Generate strategic recommendations:
1. What are the top opportunities to differentiate?
2. Which patterns should we adopt vs avoid?
3. What content gaps exist in the market?
4. What are the biggest competitive threats?
5. What timing strategies should we use?

Return JSON:
{
  "top_performing_patterns": [patterns to adopt],
  "emerging_topics": ["topic1", "topic2"],
  "optimal_timing": {
    "best_hours": [7, 8, 18, 19],
    "best_days": ["Monday", "Wednesday"],
    "posting_frequency": "2-3 times per day"
  },
  "content_gaps": ["gap1", "gap2"],
  "strategic_opportunities": ["opportunity1", "opportunity2"],
  "threat_analysis": ["threat1", "threat2"]
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        response_format: { type: 'json_object' },
        max_tokens: 1000
      });

      const insights = JSON.parse(response.choices[0]?.message?.content || '{}');
      
      return {
        top_performing_patterns: patterns.slice(0, 5),
        emerging_topics: insights.emerging_topics || ['metabolic health', 'longevity protocols'],
        optimal_timing: insights.optimal_timing || {
          best_hours: [7, 8, 18, 19],
          best_days: ['Monday', 'Wednesday', 'Friday'],
          posting_frequency: '2-3 times per day'
        },
        content_gaps: insights.content_gaps || ['practical implementation guides', 'cost-effective optimization'],
        strategic_opportunities: insights.strategic_opportunities || ['evidence-based contrarian takes', 'actionable protocols'],
        threat_analysis: insights.threat_analysis || ['increasing competition', 'algorithm changes']
      };

    } catch (error: any) {
      console.error('❌ Strategic insights generation failed:', error.message);
      return this.generateFallbackInsights();
    }
  }

  /**
   * 🎪 Get viral content recommendations based on competitor analysis
   */
  public async getViralContentRecommendations(topic?: string): Promise<{
    recommended_approach: string;
    content_hooks: string[];
    viral_elements: string[];
    differentiation_strategy: string;
    timing_recommendation: string;
  }> {
    if (this.viralPatterns.length === 0) {
      await this.analyzeCompetitorLandscape();
    }

    const topPatterns = this.viralPatterns
      .filter(p => p.success_rate > 0.7)
      .sort((a, b) => b.success_rate - a.success_rate)
      .slice(0, 3);

    return {
      recommended_approach: topPatterns[0]?.description || 'Evidence-based contrarian approach',
      content_hooks: topPatterns.flatMap(p => p.examples).slice(0, 5),
      viral_elements: [
        'Specific data points',
        'Controversial angle',
        'Personal transformation story',
        'Industry secret reveal',
        'Actionable protocol'
      ],
      differentiation_strategy: 'Combine scientific rigor with practical implementation and contrarian perspectives',
      timing_recommendation: 'Post during low-competition windows (2-4 PM) for unique content, peak windows (7-9 AM, 6-8 PM) for viral content'
    };
  }

  /**
   * 📊 Get competitor performance benchmark
   */
  public getCompetitorBenchmark(): { avg_likes: number; avg_retweets: number; viral_threshold: number } {
    if (this.competitorData.length === 0) {
      return { avg_likes: 1000, avg_retweets: 200, viral_threshold: 2000 };
    }

    const avgLikes = this.competitorData.reduce((sum, post) => sum + post.engagement.likes, 0) / this.competitorData.length;
    const avgRetweets = this.competitorData.reduce((sum, post) => sum + post.engagement.retweets, 0) / this.competitorData.length;
    const viralThreshold = Math.max(...this.competitorData.map(p => p.engagement.likes)) * 0.5;

    return {
      avg_likes: Math.round(avgLikes),
      avg_retweets: Math.round(avgRetweets),
      viral_threshold: Math.round(viralThreshold)
    };
  }

  /**
   * 🔄 Fallback methods
   */
  private generateFallbackPatterns(): ViralPattern[] {
    return [
      {
        pattern_type: 'hook',
        description: 'Breaking news with data hooks',
        examples: ['🚨 BREAKING: New study shows...', '📊 DATA: 90% of people don\'t know...'],
        success_rate: 0.85,
        avg_engagement: 2500,
        recommended_use: 'Use with recent research or surprising statistics',
        confidence: 0.8
      },
      {
        pattern_type: 'topic',
        description: 'Controversial contrarian takes',
        examples: ['Unpopular opinion:', 'Hot take:', 'Everyone\'s wrong about:'],
        success_rate: 0.78,
        avg_engagement: 2200,
        recommended_use: 'Challenge conventional wisdom with evidence',
        confidence: 0.85
      }
    ];
  }

  private generateFallbackInsights(): CompetitorInsights {
    return {
      top_performing_patterns: this.generateFallbackPatterns(),
      emerging_topics: ['sleep optimization', 'metabolic health', 'cognitive enhancement'],
      optimal_timing: {
        best_hours: [7, 8, 18, 19],
        best_days: ['Monday', 'Wednesday', 'Friday'],
        posting_frequency: '2-3 times per day'
      },
      content_gaps: ['practical implementation guides', 'budget-friendly optimization'],
      strategic_opportunities: ['evidence-based contrarian content', 'actionable health protocols'],
      threat_analysis: ['increasing competition in health space', 'algorithm preference changes']
    };
  }

  /**
   * ⏰ Check if analysis needs refresh
   */
  public needsRefresh(): boolean {
    if (!this.lastAnalysis) return true;
    
    const hoursSinceAnalysis = (Date.now() - this.lastAnalysis.getTime()) / (1000 * 60 * 60);
    return hoursSinceAnalysis > 6; // Refresh every 6 hours
  }
}

export const getCompetitorIntelligence = () => CompetitorIntelligenceEngine.getInstance();

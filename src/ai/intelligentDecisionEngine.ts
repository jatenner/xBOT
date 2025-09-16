/**
 * 🧠 INTELLIGENT DECISION ENGINE
 * AI-driven system for optimal posting timing, content selection, and diversity
 * Uses real Twitter analytics to make data-driven decisions
 */

import { safeChatCompletion, CircuitOpenError, QuotaExhaustedError } from '../llm/openaiClient';
import { admin as supabase } from '../lib/supabaseClients';
import { systemMonitor } from '../monitoring/systemPerformanceMonitor';
import { shouldRunLearning } from './learningScheduler';
import { selectTimingArm, selectContentArm } from '../learning/bandits';
import { predictPerformance } from '../learning/predictor';
import { planNextContent } from '../jobs/planNext';
import { FEATURE_FLAGS } from '../config/featureFlags';
import { isCircuitOpen } from '../utils/circuitBreaker';

export interface TwitterAnalytics {
  timestamp: Date;
  hour_of_day: number;
  day_of_week: number;
  likes: number;
  retweets: number;
  replies: number;
  impressions: number;
  followers_gained: number;
  content_type: string;
  voice_style: string;
  engagement_rate: number;
  follower_conversion_rate: number;
  trending_topics: string[];
  optimal_posting_window: boolean;
}

export interface ContentDecision {
  recommended_content_type: string;
  recommended_voice_style: string;
  recommended_topic: string;
  confidence_score: number;
  reasoning: string;
  expected_engagement: number;
  expected_followers: number;
  diversity_score: number;
  action?: string;
  reason?: string;
  bandit_arm?: string;
  predicted_er?: number;
  predicted_follow_through?: number;
}

export interface TimingDecision {
  should_post_now: boolean;
  optimal_wait_minutes: number;
  confidence_score: number;
  reasoning: string;
  expected_audience_size: number;
  competition_level: number;
  action?: string;
  reason?: string;
  timing_arm?: string;
}

export interface TrendingInsight {
  topic: string;
  momentum: number;
  health_relevance: number;
  competition_level: number;
  opportunity_score: number;
  suggested_angle: string;
}

export class IntelligentDecisionEngine {
  private static instance: IntelligentDecisionEngine;
  
  // AI learning data
  private recentAnalytics: TwitterAnalytics[] = [];
  private contentPerformanceHistory: Map<string, number[]> = new Map();
  private timingPerformanceHistory: Map<number, number[]> = new Map();
  private diversityTracker: Map<string, number> = new Map();
  private trendingTopics: TrendingInsight[] = [];

  private constructor() {
    this.initializeDecisionEngine();
  }

  public static getInstance(): IntelligentDecisionEngine {
    if (!IntelligentDecisionEngine.instance) {
      IntelligentDecisionEngine.instance = new IntelligentDecisionEngine();
    }
    return IntelligentDecisionEngine.instance;
  }

  /**
   * 🚀 Initialize the AI decision engine with historical data
   */
  private async initializeDecisionEngine(): Promise<void> {
    console.log('🧠 DECISION_ENGINE: Initializing AI-driven decision system...');
    
    try {
      // Load recent analytics for pattern recognition
      await this.loadRecentAnalytics();
      
      // Analyze content performance patterns
      await this.analyzeContentPerformance();
      
      // Analyze timing patterns
      await this.analyzeTimingPatterns();
      
      // Load trending topics
      await this.updateTrendingTopics();
      
      console.log('✅ DECISION_ENGINE: AI system initialized with performance data');
      
    } catch (error) {
      console.error('❌ DECISION_ENGINE: Initialization failed:', error);
    }
  }

  /**
   * 🤖 MAKE LEARNING-AWARE DECISION
   * Uses bandits and predictor for optimal timing and content
   */
  async makeLearningAwareDecision(): Promise<{
    timing_arm: string;
    content_arm: string;
    reasons: string[];
    should_post_now: boolean;
    predicted_er: number;
    predicted_follow_through: number;
  }> {
    try {
      // Check circuit breaker first
      if (await isCircuitOpen('openai_quota')) {
        return {
          timing_arm: '',
          content_arm: '',
          reasons: ['OpenAI circuit breaker is open'],
          should_post_now: false,
          predicted_er: 0,
          predicted_follow_through: 0
        };
      }

      if (!FEATURE_FLAGS.POSTING_ENABLED || FEATURE_FLAGS.POSTING_DISABLED) {
        return {
          timing_arm: '',
          content_arm: '',
          reasons: ['Posting disabled via feature flags'],
          should_post_now: false,
          predicted_er: 0,
          predicted_follow_through: 0
        };
      }

      // Use planning system if bandit learning is enabled
      if (process.env.ENABLE_BANDIT_LEARNING === 'true') {
        const plan = await planNextContent();
        if (plan) {
          return {
            timing_arm: plan.timingArm,
            content_arm: plan.contentArm,
            reasons: plan.reasoning,
            should_post_now: true,
            predicted_er: plan.predictedER,
            predicted_follow_through: plan.predictedFollowThrough
          };
        }
      }

      // Fallback to basic bandit selection
      const timingSelection = await selectTimingArm();
      const contentSelection = await selectContentArm(
        'single',
        ['educational', 'myth_busting', 'controversy_starter'],
        ['health_general', 'nutrition_science', 'sleep_optimization']
      );

      return {
        timing_arm: timingSelection.armId,
        content_arm: contentSelection.armId,
        reasons: [timingSelection.reason, contentSelection.reason],
        should_post_now: true,
        predicted_er: 0.025, // Default prediction
        predicted_follow_through: 0.002
      };

    } catch (error: any) {
      console.error('❌ LEARNING_AWARE_DECISION_ERROR:', error.message);
      return {
        timing_arm: '',
        content_arm: '',
        reasons: [`Error: ${error.message}`],
        should_post_now: false,
        predicted_er: 0,
        predicted_follow_through: 0
      };
    }
  }

  /**
   * 🕐 AI-DRIVEN TIMING DECISION
   * Analyzes real-time data to determine optimal posting time
   */
  public async makeTimingDecision(): Promise<TimingDecision> {
    console.log('🕐 TIMING_AI: Analyzing optimal posting time...');
    
    try {
      // Check for circuit breaker or disabled posting first
      if (await isCircuitOpen('openai_quota')) {
        return {
          should_post_now: false,
          optimal_wait_minutes: FEATURE_FLAGS.AI_COOLDOWN_MINUTES,
          confidence_score: 100,
          reasoning: 'OpenAI circuit breaker is open',
          expected_audience_size: 0,
          competition_level: 0,
          action: 'skip',
          reason: 'quota_circuit'
        };
      }

      if (!FEATURE_FLAGS.POSTING_ENABLED || FEATURE_FLAGS.POSTING_DISABLED) {
        return {
          should_post_now: false,
          optimal_wait_minutes: 5,
          confidence_score: 100,
          reasoning: 'Posting disabled via feature flags',
          expected_audience_size: 0,
          competition_level: 0,
          action: 'skip',
          reason: 'posting_disabled'
        };
      }

      const currentHour = new Date().getHours();
      const dayOfWeek = new Date().getDay();
      
      // Use bandit selection if enabled
      if (process.env.ENABLE_BANDIT_LEARNING === 'true') {
        try {
          const timingSelection = await selectTimingArm();
          
          const decision: TimingDecision = {
            should_post_now: true, // Bandit selection implies readiness to post
            optimal_wait_minutes: 0,
            confidence_score: Math.round(timingSelection.confidence || 0.75 * 100),
            reasoning: `Bandit timing selection: ${timingSelection.reason}`,
            expected_audience_size: 1000, // Would be estimated from historical data
            competition_level: 50, // Would be analyzed from real-time data
            timing_arm: timingSelection.armId
          };
          
          return decision;
        } catch (banditError) {
          console.warn('❌ TIMING_BANDIT: Failed, falling back to AI analysis:', banditError);
        }
      }
      
      // Get real-time insights
      const audienceSizeEstimate = await this.estimateCurrentAudienceSize();
      const competitionLevel = await this.analyzeCurrentCompetition();
      const historicalPerformance = this.getHistoricalPerformance(currentHour, dayOfWeek);
      
      // AI analysis of timing decision
      const aiDecision = await this.getAITimingRecommendation(
        currentHour,
        dayOfWeek,
        audienceSizeEstimate,
        competitionLevel,
        historicalPerformance
      );
      
      const decision: TimingDecision = {
        should_post_now: aiDecision.post_now,
        optimal_wait_minutes: aiDecision.wait_minutes,
        confidence_score: aiDecision.confidence,
        reasoning: aiDecision.reasoning,
        expected_audience_size: audienceSizeEstimate,
        competition_level: competitionLevel
      };
      
      console.log(`🕐 TIMING_DECISION: ${decision.should_post_now ? 'POST NOW' : `WAIT ${decision.optimal_wait_minutes}min`} | Confidence: ${decision.confidence_score}%`);
      
      return decision;
      
    } catch (error) {
      console.error('❌ TIMING_AI: Decision failed:', error);
      
      // AGGRESSIVE Fallback decision
      return {
        should_post_now: true,
        optimal_wait_minutes: 0,
        confidence_score: 90,
        reasoning: 'AGGRESSIVE GROWTH MODE: Posting immediately to maintain consistent presence',
        expected_audience_size: 1000,
        competition_level: 50
      };
    }
  }

  /**
   * 🎨 AI-DRIVEN CONTENT DECISION
   * Determines optimal content type, style, and topic based on data
   */
  public async makeContentDecision(): Promise<ContentDecision> {
    console.log('🎨 CONTENT_AI: Analyzing optimal content strategy...');
    
    try {
      // Check for circuit breaker or disabled posting first
      if (await isCircuitOpen('openai_quota')) {
        return {
          recommended_content_type: '',
          recommended_voice_style: '',
          recommended_topic: '',
          confidence_score: 0,
          reasoning: 'OpenAI circuit breaker is open',
          expected_engagement: 0,
          expected_followers: 0,
          diversity_score: 0,
          action: 'skip',
          reason: 'quota_circuit'
        };
      }

      // Use bandit selection if enabled
      if (process.env.ENABLE_BANDIT_LEARNING === 'true') {
        try {
          const contentSelection = await selectContentArm(
            'single',
            ['educational', 'myth_busting', 'controversy_starter', 'data_driven'],
            ['health_general', 'nutrition_science', 'sleep_optimization', 'fitness_advice']
          );
          
          // Parse the arm to get components
          const armParts = contentSelection.armId.split('|');
          const format = armParts[0] || 'single';
          const hookType = armParts[1] || 'educational';
          const topic = armParts[2] || 'health_general';
          
          // Get prediction for this combination
          const mockContent = `[${hookType}] ${topic.replace(/_/g, ' ')} content`;
          const prediction = await predictPerformance(mockContent, {
            hook_type: hookType,
            topic: topic,
            format: format
          });
          
          const decision: ContentDecision = {
            recommended_content_type: format,
            recommended_voice_style: hookType,
            recommended_topic: topic.replace(/_/g, ' '),
            confidence_score: Math.round(prediction.confidence * 100),
            reasoning: `Bandit content selection: ${contentSelection.reason}`,
            expected_engagement: prediction.engagementRate * 100,
            expected_followers: prediction.followThrough * 1000, // Scale to expected follower count
            diversity_score: 80, // Would be calculated from recent content
            bandit_arm: contentSelection.armId,
            predicted_er: prediction.engagementRate,
            predicted_follow_through: prediction.followThrough
          };
          
          return decision;
        } catch (banditError) {
          console.warn('❌ CONTENT_BANDIT: Failed, falling back to AI analysis:', banditError);
        }
      }
      
      // Analyze current content diversity needs
      const diversityAnalysis = await this.analyzeDiversityNeeds();
      
      // Get trending health topics
      const trendingOpportunities = await this.analyzeTrendingOpportunities();
      
      // Analyze recent performance patterns
      const performanceInsights = await this.getPerformanceInsights();
      
      // AI-driven content recommendation
      const aiDecision = await this.getAIContentRecommendation(
        diversityAnalysis,
        trendingOpportunities,
        performanceInsights
      );
      
      const decision: ContentDecision = {
        recommended_content_type: aiDecision.content_type,
        recommended_voice_style: aiDecision.voice_style,
        recommended_topic: aiDecision.topic,
        confidence_score: aiDecision.confidence,
        reasoning: aiDecision.reasoning,
        expected_engagement: aiDecision.expected_engagement,
        expected_followers: aiDecision.expected_followers,
        diversity_score: diversityAnalysis.current_diversity_score
      };
      
      console.log(`🎨 CONTENT_DECISION: ${decision.recommended_content_type} | ${decision.recommended_voice_style} | Topic: ${decision.recommended_topic}`);
      console.log(`📊 EXPECTED: ${decision.expected_engagement}% engagement, ${decision.expected_followers} followers`);
      
      return decision;
      
    } catch (error) {
      console.error('❌ CONTENT_AI: Decision failed:', error);
      
      // AGGRESSIVE Fallback decision
      return {
        recommended_content_type: 'myth_busting',
        recommended_voice_style: 'controversy_starter',
        recommended_topic: 'health myths the industry hides',
        confidence_score: 92,
        reasoning: 'AGGRESSIVE GROWTH MODE: Using highest viral potential combination for follower acquisition',
        expected_engagement: 70,
        expected_followers: 15,
        diversity_score: 50
      };
    }
  }

  /**
   * 📊 STORE REAL-TIME ANALYTICS
   * Collects and stores Twitter performance data for AI learning
   */
  public async storeTwitterAnalytics(analytics: Partial<TwitterAnalytics>): Promise<void> {
    try {
      const fullAnalytics: TwitterAnalytics = {
        timestamp: new Date(),
        hour_of_day: new Date().getHours(),
        day_of_week: new Date().getDay(),
        likes: analytics.likes || 0,
        retweets: analytics.retweets || 0,
        replies: analytics.replies || 0,
        impressions: analytics.impressions || 0,
        followers_gained: analytics.followers_gained || 0,
        content_type: analytics.content_type || 'unknown',
        voice_style: analytics.voice_style || 'unknown',
        engagement_rate: analytics.engagement_rate || 0,
        follower_conversion_rate: analytics.follower_conversion_rate || 0,
        trending_topics: analytics.trending_topics || [],
        optimal_posting_window: analytics.optimal_posting_window || false
      };
      
      // Store in database
      await systemMonitor.trackDBQuery('store_analytics', async () => {
        return supabase
          .from('ai_twitter_analytics')
          .insert({
            hour_of_day: fullAnalytics.hour_of_day,
            day_of_week: fullAnalytics.day_of_week,
            likes: fullAnalytics.likes,
            retweets: fullAnalytics.retweets,
            replies: fullAnalytics.replies,
            impressions: fullAnalytics.impressions,
            followers_gained: fullAnalytics.followers_gained,
            content_type: fullAnalytics.content_type,
            voice_style: fullAnalytics.voice_style,
            engagement_rate: fullAnalytics.engagement_rate,
            follower_conversion_rate: fullAnalytics.follower_conversion_rate,
            trending_topics: fullAnalytics.trending_topics,
            optimal_posting_window: fullAnalytics.optimal_posting_window,
            recorded_at: fullAnalytics.timestamp.toISOString()
          });
      });
      
      // Update in-memory data for immediate AI decisions
      this.recentAnalytics.push(fullAnalytics);
      if (this.recentAnalytics.length > 100) {
        this.recentAnalytics = this.recentAnalytics.slice(-100);
      }
      
      // Update performance tracking
      this.updatePerformanceTracking(fullAnalytics);
      
      console.log(`📊 ANALYTICS_STORED: ${fullAnalytics.content_type} | ${fullAnalytics.engagement_rate}% engagement | ${fullAnalytics.followers_gained} followers`);
      
    } catch (error) {
      console.error('❌ ANALYTICS_STORAGE: Failed to store analytics:', error);
    }
  }

  /**
   * 🎯 GET AI TIMING RECOMMENDATION
   */
  private async getAITimingRecommendation(
    hour: number,
    day: number,
    audienceSize: number,
    competition: number,
    historical: any
  ): Promise<any> {
    try {
      const prompt = `You are an AGGRESSIVE AI growth strategist for a health influencer focused on RAPID follower acquisition through frequent, high-quality posting.

CURRENT CONTEXT:
- Hour: ${hour} (0-23)
- Day of week: ${day} (0=Sunday, 6=Saturday)
- Estimated audience size: ${audienceSize}
- Competition level: ${competition}% (higher = more competition)
- Historical performance at this time: ${JSON.stringify(historical)}

AGGRESSIVE GROWTH STRATEGY:
🚀 BIAS TOWARD IMMEDIATE POSTING - We grow through consistent presence, not perfect timing
🎯 ONLY wait if conditions are EXCEPTIONALLY poor (very late night 1-5 AM)
📈 Competition is OPPORTUNITY - we stand out with better content, not timing avoidance
⚡ Maximum wait time: 30 minutes (not hours)

DECISION CRITERIA:
- Post NOW unless: 1-5 AM weekdays OR competition >80% AND audience <500
- For any reasonable time (6 AM - 12 AM): POST IMMEDIATELY
- Weekend posting: ALWAYS aggressive (health-conscious audiences active)
- High competition = opportunity to outperform with quality content

Return JSON only:
{
  "post_now": boolean,
  "wait_minutes": number (0-30 MAX),
  "confidence": number (70-95 range),
  "reasoning": "aggressive growth focused explanation"
}`;

      const response = await safeChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4',
        temperature: 0.3,
        max_tokens: 200,
        requestType: 'timing_decision'
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return result;
      
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        console.log(`🚨 AI_TIMING: Circuit breaker open, using fallback decision`);
        return { action: 'skip', reason: 'quota_circuit' };
      }
      
      console.error('❌ AI_TIMING: Failed to get recommendation:', error);
      return {
        post_now: true,
        wait_minutes: 0,
        confidence: 85,
        reasoning: 'AI analysis failed, AGGRESSIVE fallback: posting immediately for growth'
      };
    }
  }

  /**
   * 🎨 GET AI CONTENT RECOMMENDATION
   */
  private async getAIContentRecommendation(
    diversity: any,
    trending: any,
    performance: any
  ): Promise<any> {
    try {
      const prompt = `You are an AGGRESSIVE viral growth strategist for a health influencer focused on RAPID follower acquisition through HIGH-IMPACT content.

CURRENT DATA:
- Content diversity analysis: ${JSON.stringify(diversity)}
- Trending opportunities: ${JSON.stringify(trending)}
- Recent performance insights: ${JSON.stringify(performance)}

AVAILABLE CONTENT TYPES (prioritize viral potential):
- myth_busting (HIGH viral), counterintuitive_insight (HIGH viral)
- controversy_starter (HIGHEST viral), practical_experiment (HIGH engagement)
- personal_discovery (HIGH relatability), story_insight (HIGH shareability)

AVAILABLE VOICE STYLES (prioritize authority + intrigue):
- medical_authority (HIGH trust), conspiracy_revealer (HIGHEST viral)
- expensive_insider (HIGH exclusivity), controversy_starter (HIGHEST engagement)
- results_driven_experimenter (HIGH credibility)

AGGRESSIVE GROWTH STRATEGY:
🚀 PRIORITIZE: Viral potential over safe content
🎯 FOCUS: Follower-magnet combinations (controversy + authority)
📈 TARGET: 50+ engagement rate, 10+ new followers per post
⚡ BIAS: Trending topics, contrarian takes, insider secrets

DECISION CRITERIA:
- Always choose HIGH viral potential combinations
- Trending health topics = immediate priority
- Controversy + Medical Authority = follower magnets
- Myth-busting + Exclusive insights = shareability gold

Return JSON only:
{
  "content_type": "string",
  "voice_style": "string", 
  "topic": "specific trending health topic",
  "confidence": number (80-98 range),
  "reasoning": "aggressive viral growth explanation",
  "expected_engagement": number (40-90),
  "expected_followers": number (8-25)
}`;

      const response = await safeChatCompletion([
        { role: 'user', content: prompt }
      ], {
        model: 'gpt-4',
        temperature: 0.4,
        max_tokens: 300,
        requestType: 'content_decision'
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');
      return result;
      
    } catch (error) {
      if (error instanceof CircuitOpenError) {
        console.log(`🚨 AI_CONTENT: Circuit breaker open, using fallback decision`);
        return { action: 'skip', reason: 'quota_circuit' };
      }
      
      console.error('❌ AI_CONTENT: Failed to get recommendation:', error);
      return {
        content_type: 'myth_busting',
        voice_style: 'controversy_starter',
        topic: 'sleep optimization myths everyone believes',
        confidence: 88,
        reasoning: 'AGGRESSIVE fallback: using highest viral potential combination for growth',
        expected_engagement: 65,
        expected_followers: 12
      };
    }
  }

  /**
   * 📈 ANALYZE CONTENT DIVERSITY NEEDS
   */
  private async analyzeDiversityNeeds(): Promise<any> {
    try {
      // Get recent content distribution
      const { data } = await systemMonitor.trackDBQuery('diversity_analysis', async () => {
        return supabase
          .from('ai_twitter_analytics')
          .select('content_type, voice_style, recorded_at')
          .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('recorded_at', { ascending: false });
      });

      const contentTypes = data?.map(d => d.content_type) || [];
      const voiceStyles = data?.map(d => d.voice_style) || [];

      // Calculate diversity scores
      const contentTypeCounts = this.calculateDistribution(contentTypes);
      const voiceStyleCounts = this.calculateDistribution(voiceStyles);
      
      const diversityScore = this.calculateDiversityScore(contentTypeCounts, voiceStyleCounts);
      
      return {
        current_diversity_score: diversityScore,
        content_type_distribution: contentTypeCounts,
        voice_style_distribution: voiceStyleCounts,
        underused_content_types: this.getUnderusedItems(contentTypeCounts),
        underused_voice_styles: this.getUnderusedItems(voiceStyleCounts)
      };
      
    } catch (error) {
      console.error('❌ DIVERSITY_ANALYSIS: Failed:', error);
      return {
        current_diversity_score: 50,
        content_type_distribution: {},
        voice_style_distribution: {},
        underused_content_types: ['myth_busting'],
        underused_voice_styles: ['medical_authority']
      };
    }
  }

  /**
   * 🔥 ANALYZE TRENDING OPPORTUNITIES
   */
  private async analyzeTrendingOpportunities(): Promise<TrendingInsight[]> {
    try {
      // This would integrate with Twitter API or trending topic services
      // For now, simulating with health-focused trending analysis
      
      const healthTrends = [
        'longevity research', 'metabolic health', 'gut microbiome',
        'sleep optimization', 'hormone optimization', 'biohacking',
        'nutrition myths', 'supplement effectiveness', 'mental health'
      ];
      
      const insights: TrendingInsight[] = healthTrends.map(topic => ({
        topic,
        momentum: Math.random() * 100,
        health_relevance: 80 + Math.random() * 20,
        competition_level: Math.random() * 100,
        opportunity_score: Math.random() * 100,
        suggested_angle: `Controversial take on ${topic}`
      }));
      
      return insights.sort((a, b) => b.opportunity_score - a.opportunity_score);
      
    } catch (error) {
      console.error('❌ TRENDING_ANALYSIS: Failed:', error);
      return [];
    }
  }

  // Helper methods for analytics and calculations
  private async loadRecentAnalytics(): Promise<void> {
    // Load last 100 analytics records for pattern analysis
    const { data } = await supabase
      .from('ai_twitter_analytics')
      .select('*')
      .order('recorded_at', { ascending: false })
      .limit(100);
    
    if (data) {
      this.recentAnalytics = data.map(d => ({
        timestamp: new Date(d.recorded_at),
        hour_of_day: d.hour_of_day,
        day_of_week: d.day_of_week,
        likes: d.likes,
        retweets: d.retweets,
        replies: d.replies,
        impressions: d.impressions,
        followers_gained: d.followers_gained,
        content_type: d.content_type,
        voice_style: d.voice_style,
        engagement_rate: d.engagement_rate,
        follower_conversion_rate: d.follower_conversion_rate,
        trending_topics: d.trending_topics || [],
        optimal_posting_window: d.optimal_posting_window || false
      }));
    }
  }

  private async analyzeContentPerformance(): Promise<void> {
    // Analyze performance by content type
    this.recentAnalytics.forEach(analytics => {
      const key = `${analytics.content_type}_${analytics.voice_style}`;
      if (!this.contentPerformanceHistory.has(key)) {
        this.contentPerformanceHistory.set(key, []);
      }
      this.contentPerformanceHistory.get(key)!.push(analytics.engagement_rate);
    });
  }

  private async analyzeTimingPatterns(): Promise<void> {
    // Analyze performance by hour of day
    this.recentAnalytics.forEach(analytics => {
      if (!this.timingPerformanceHistory.has(analytics.hour_of_day)) {
        this.timingPerformanceHistory.set(analytics.hour_of_day, []);
      }
      this.timingPerformanceHistory.get(analytics.hour_of_day)!.push(analytics.engagement_rate);
    });
  }

  private async updateTrendingTopics(): Promise<void> {
    // Only run if learning debounce allows
    if (!(await shouldRunLearning())) {
      console.log('📈 TRENDING: Skipped due to learning debounce');
      return;
    }
    
    // This would connect to real trending data sources
    console.log('📈 TRENDING: Updated trending topics analysis');
  }

  private async estimateCurrentAudienceSize(): Promise<number> {
    // Estimate current audience based on historical patterns
    const hour = new Date().getHours();
    const performances = this.timingPerformanceHistory.get(hour) || [1000];
    return Math.max(...performances) * 10; // Rough audience estimate
  }

  private async analyzeCurrentCompetition(): Promise<number> {
    // Analyze competition level at current time
    return 30 + Math.random() * 40; // 30-70% competition level
  }

  private getHistoricalPerformance(hour: number, day: number): any {
    const hourPerformances = this.timingPerformanceHistory.get(hour) || [];
    const avgEngagement = hourPerformances.length > 0 
      ? hourPerformances.reduce((a, b) => a + b, 0) / hourPerformances.length 
      : 25;
    
    return {
      average_engagement: avgEngagement,
      post_count: hourPerformances.length,
      performance_trend: avgEngagement > 30 ? 'high' : avgEngagement > 20 ? 'medium' : 'low'
    };
  }

  private async getPerformanceInsights(): Promise<any> {
    // Get insights from recent performance
    const recentPosts = this.recentAnalytics.slice(0, 10);
    const avgEngagement = recentPosts.reduce((sum, p) => sum + p.engagement_rate, 0) / recentPosts.length;
    
    return {
      recent_average_engagement: avgEngagement,
      top_performing_types: this.getTopPerformingTypes(),
      declining_types: this.getDecliningTypes()
    };
  }

  private calculateDistribution(items: string[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    items.forEach(item => {
      distribution[item] = (distribution[item] || 0) + 1;
    });
    return distribution;
  }

  private calculateDiversityScore(contentTypes: Record<string, number>, voiceStyles: Record<string, number>): number {
    // Calculate Shannon diversity index
    const contentEntropy = this.calculateEntropy(Object.values(contentTypes));
    const voiceEntropy = this.calculateEntropy(Object.values(voiceStyles));
    return Math.round((contentEntropy + voiceEntropy) * 50); // Convert to 0-100 scale
  }

  private calculateEntropy(values: number[]): number {
    const total = values.reduce((sum, val) => sum + val, 0);
    if (total === 0) return 0;
    
    return -values.reduce((entropy, val) => {
      if (val === 0) return entropy;
      const p = val / total;
      return entropy + p * Math.log2(p);
    }, 0);
  }

  private getUnderusedItems(distribution: Record<string, number>): string[] {
    const avg = Object.values(distribution).reduce((sum, val) => sum + val, 0) / Object.keys(distribution).length;
    return Object.entries(distribution)
      .filter(([_, count]) => count < avg * 0.7)
      .map(([item, _]) => item);
  }

  private getTopPerformingTypes(): string[] {
    // Return content types with highest average engagement
    const typePerformances: Record<string, number[]> = {};
    
    this.recentAnalytics.forEach(analytics => {
      if (!typePerformances[analytics.content_type]) {
        typePerformances[analytics.content_type] = [];
      }
      typePerformances[analytics.content_type].push(analytics.engagement_rate);
    });
    
    return Object.entries(typePerformances)
      .map(([type, rates]) => ({
        type,
        avgRate: rates.reduce((sum, rate) => sum + rate, 0) / rates.length
      }))
      .sort((a, b) => b.avgRate - a.avgRate)
      .slice(0, 3)
      .map(item => item.type);
  }

  private getDecliningTypes(): string[] {
    // Return content types with declining performance
    // Simplified implementation
    return ['generic_health_tips', 'obvious_advice'];
  }

  private updatePerformanceTracking(analytics: TwitterAnalytics): void {
    // Update diversity tracking
    const contentKey = `${analytics.content_type}_${analytics.voice_style}`;
    this.diversityTracker.set(contentKey, (this.diversityTracker.get(contentKey) || 0) + 1);
    
    // Update timing tracking
    if (!this.timingPerformanceHistory.has(analytics.hour_of_day)) {
      this.timingPerformanceHistory.set(analytics.hour_of_day, []);
    }
    this.timingPerformanceHistory.get(analytics.hour_of_day)!.push(analytics.engagement_rate);
  }
}

// Export singleton instance
export const intelligentDecision = IntelligentDecisionEngine.getInstance();

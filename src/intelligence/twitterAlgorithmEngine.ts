/**
 * 🚀 TWITTER ALGORITHM INTELLIGENCE ENGINE
 * 
 * Decodes Twitter's algorithm through data analysis and pattern recognition
 * Optimizes content for maximum reach, engagement, and follower growth
 */

import { supabaseClient } from '../utils/supabaseClient';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';

export interface AlgorithmSignal {
  signal_type: 'engagement_boost' | 'reach_throttle' | 'viral_trigger' | 'shadow_ban' | 'trend_amplification';
  signal_strength: number; // 0-1
  detected_at: Date;
  associated_content?: string;
  metrics: {
    likes_velocity?: number;
    retweets_velocity?: number;
    impressions_change?: number;
    reach_percentage?: number;
  };
  confidence: number;
}

export interface ViralPattern {
  pattern_id: string;
  pattern_type: 'hook_structure' | 'controversy_level' | 'timing_window' | 'hashtag_combo' | 'thread_format';
  pattern_elements: string[];
  success_rate: number;
  avg_engagement: number;
  follower_conversion_rate: number;
  examples: string[];
  optimal_conditions: {
    time_of_day?: string;
    day_of_week?: string;
    trending_topics?: string[];
    audience_mood?: string;
  };
}

export interface FollowerTrigger {
  trigger_type: 'authority_display' | 'controversy_take' | 'value_delivery' | 'community_building' | 'fomo_creation';
  trigger_strength: number;
  conversion_rate: number;
  optimal_usage: string;
  examples: string[];
  psychological_mechanism: string;
}

export interface AlgorithmInsight {
  insight_type: 'posting_optimization' | 'content_strategy' | 'engagement_tactics' | 'follower_acquisition';
  recommendation: string;
  expected_impact: number; // Expected follower growth percentage
  confidence_level: number;
  implementation_priority: 'immediate' | 'high' | 'medium' | 'low';
  supporting_data: any;
}

export class TwitterAlgorithmEngine {
  private static instance: TwitterAlgorithmEngine;
  private budgetAwareOpenAI: BudgetAwareOpenAI;
  private algorithmSignals: AlgorithmSignal[] = [];
  private viralPatterns: ViralPattern[] = [];
  private followerTriggers: FollowerTrigger[] = [];

  private constructor() {
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
  }

  public static getInstance(): TwitterAlgorithmEngine {
    if (!TwitterAlgorithmEngine.instance) {
      TwitterAlgorithmEngine.instance = new TwitterAlgorithmEngine();
    }
    return TwitterAlgorithmEngine.instance;
  }

  /**
   * 🧠 MAIN ALGORITHM ANALYSIS CYCLE
   */
  async runAlgorithmAnalysis(): Promise<AlgorithmInsight[]> {
    console.log('🧠 === RUNNING TWITTER ALGORITHM ANALYSIS ===');
    
    try {
      // Step 1: Detect current algorithm signals
      const signals = await this.detectAlgorithmSignals();
      console.log(`🔍 Detected ${signals.length} algorithm signals`);
      
      // Step 2: Analyze viral patterns in our niche
      const patterns = await this.analyzeViralPatterns();
      console.log(`📊 Identified ${patterns.length} viral patterns`);
      
      // Step 3: Identify follower acquisition triggers
      const triggers = await this.identifyFollowerTriggers();
      console.log(`🎯 Found ${triggers.length} follower triggers`);
      
      // Step 4: Generate actionable insights
      const insights = await this.generateAlgorithmInsights(signals, patterns, triggers);
      console.log(`💡 Generated ${insights.length} algorithm insights`);
      
      // Step 5: Store findings for future reference
      await this.storeAlgorithmData(signals, patterns, triggers, insights);
      
      return insights;
      
    } catch (error) {
      console.error('❌ Algorithm analysis failed:', error);
      return [];
    }
  }

  /**
   * 🔍 DETECT ALGORITHM SIGNALS FROM RECENT PERFORMANCE
   */
  private async detectAlgorithmSignals(): Promise<AlgorithmSignal[]> {
    console.log('🔍 Analyzing recent tweet performance for algorithm signals...');
    
    try {
      // Get recent tweet performance data
      const { data: recentTweets, error } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('*')
        .order('posted_at', { ascending: false })
        .limit(50);
      
      if (error || !recentTweets?.length) {
        console.log('⚠️ No recent tweet data available for analysis');
        return [];
      }
      
      const signals: AlgorithmSignal[] = [];
      
      // Analyze engagement velocity patterns
      for (const tweet of recentTweets) {
        const tweetSignals = await this.analyzeTweetForSignals(tweet);
        signals.push(...tweetSignals);
      }
      
      // Detect broader algorithm changes
      const broadSignals = await this.detectBroadAlgorithmChanges(recentTweets);
      signals.push(...broadSignals);
      
      return signals;
      
    } catch (error) {
      console.error('❌ Signal detection failed:', error);
      return [];
    }
  }

  /**
   * 📊 ANALYZE INDIVIDUAL TWEET FOR ALGORITHM SIGNALS
   */
  private async analyzeTweetForSignals(tweet: any): Promise<AlgorithmSignal[]> {
    const signals: AlgorithmSignal[] = [];
    
    try {
      // Calculate engagement velocity (likes per hour in first 24h)
      const hoursOld = (new Date().getTime() - new Date(tweet.posted_at).getTime()) / (1000 * 60 * 60);
      const likesVelocity = hoursOld > 0 ? tweet.likes / Math.min(hoursOld, 24) : 0;
      const retweetsVelocity = hoursOld > 0 ? tweet.retweets / Math.min(hoursOld, 24) : 0;
      
      // Signal: Viral boost detection
      if (likesVelocity > 5 && tweet.likes > 20) {
        signals.push({
          signal_type: 'viral_trigger',
          signal_strength: Math.min(likesVelocity / 10, 1),
          detected_at: new Date(),
          associated_content: tweet.content,
          metrics: { likes_velocity: likesVelocity, retweets_velocity: retweetsVelocity },
          confidence: 0.8
        });
      }
      
      // Signal: Engagement boost
      if (tweet.engagement_rate > 0.05) { // 5% engagement rate is strong
        signals.push({
          signal_type: 'engagement_boost',
          signal_strength: Math.min(tweet.engagement_rate / 0.1, 1),
          detected_at: new Date(),
          associated_content: tweet.content,
          metrics: { reach_percentage: tweet.engagement_rate },
          confidence: 0.7
        });
      }
      
      // Signal: Potential throttling
      if (tweet.impressions && tweet.impressions < tweet.follower_gain * 10) {
        signals.push({
          signal_type: 'reach_throttle',
          signal_strength: 0.6,
          detected_at: new Date(),
          associated_content: tweet.content,
          metrics: { impressions_change: tweet.impressions },
          confidence: 0.6
        });
      }
      
    } catch (error) {
      console.error('❌ Tweet signal analysis failed:', error);
    }
    
    return signals;
  }

  /**
   * 🌊 DETECT BROAD ALGORITHM CHANGES
   */
  private async detectBroadAlgorithmChanges(recentTweets: any[]): Promise<AlgorithmSignal[]> {
    const signals: AlgorithmSignal[] = [];
    
    try {
      // Calculate average performance metrics
      const avgLikes = recentTweets.reduce((sum, t) => sum + (t.likes || 0), 0) / recentTweets.length;
      const avgEngagement = recentTweets.reduce((sum, t) => sum + (t.engagement_rate || 0), 0) / recentTweets.length;
      
      // Compare with historical baseline
      const { data: historical } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('likes, engagement_rate')
        .lt('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // 7 days ago
        .limit(100);
      
      if (historical?.length) {
        const historicalAvgLikes = historical.reduce((sum, t) => sum + (t.likes || 0), 0) / historical.length;
        const historicalAvgEngagement = historical.reduce((sum, t) => sum + (t.engagement_rate || 0), 0) / historical.length;
        
        // Detect significant performance drops (potential shadow ban)
        if (avgLikes < historicalAvgLikes * 0.5 && avgEngagement < historicalAvgEngagement * 0.5) {
          signals.push({
            signal_type: 'shadow_ban',
            signal_strength: 0.8,
            detected_at: new Date(),
            metrics: {
              likes_velocity: avgLikes,
              reach_percentage: avgEngagement
            },
            confidence: 0.7
          });
        }
        
        // Detect performance improvements
        if (avgLikes > historicalAvgLikes * 1.5) {
          signals.push({
            signal_type: 'trend_amplification',
            signal_strength: 0.7,
            detected_at: new Date(),
            metrics: {
              likes_velocity: avgLikes
            },
            confidence: 0.6
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Broad algorithm change detection failed:', error);
    }
    
    return signals;
  }

  /**
   * 🔥 ANALYZE VIRAL PATTERNS IN HEALTH/WELLNESS NICHE
   */
  private async analyzeViralPatterns(): Promise<ViralPattern[]> {
    console.log('🔥 Analyzing viral patterns in health/wellness content...');
    
    try {
      // Get high-performing tweets for pattern analysis
      const { data: viralTweets, error } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('*')
        .gte('likes', 25) // Consider 25+ likes as viral for our current scale
        .order('likes', { ascending: false })
        .limit(100);
      
      if (error || !viralTweets?.length) {
        console.log('⚠️ No viral tweet data available');
        return this.getDefaultViralPatterns();
      }
      
      // Analyze patterns using AI
      const patternsPrompt = `Analyze these high-performing health/wellness tweets and identify viral patterns:

TWEETS:
${viralTweets.map(t => `${t.likes} likes: "${t.content?.substring(0, 200)}..."`).join('\n')}

Identify patterns in:
1. Hook structures (how they open)
2. Content formats (threads vs single tweets)
3. Controversy levels
4. Psychological triggers used
5. Call-to-action patterns

Return as JSON array of patterns with success rates.`;

      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: patternsPrompt }
      ], {
        model: 'gpt-4o',
        maxTokens: 1500,
        temperature: 0.3,
        priority: 'important',
        operationType: 'pattern_analysis'
      });

      let patterns: ViralPattern[] = [];
      try {
        const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || []);
        const parsedPatterns = JSON.parse(responseText);
        patterns = Array.isArray(parsedPatterns) ? parsedPatterns : [];
      } catch (parseError) {
        console.warn('⚠️ Pattern analysis parsing failed, using defaults');
        patterns = this.getDefaultViralPatterns();
      }
      
      return patterns;
      
    } catch (error) {
      console.error('❌ Viral pattern analysis failed:', error);
      return this.getDefaultViralPatterns();
    }
  }

  /**
   * 🎯 IDENTIFY FOLLOWER ACQUISITION TRIGGERS
   */
  private async identifyFollowerTriggers(): Promise<FollowerTrigger[]> {
    console.log('🎯 Identifying follower acquisition triggers...');
    
    try {
      // Get tweets that led to follower gains
      const { data: followerGainTweets } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('*')
        .gte('follower_gain', 1)
        .order('follower_gain', { ascending: false })
        .limit(50);
      
      if (!followerGainTweets?.length) {
        return this.getDefaultFollowerTriggers();
      }
      
      // Analyze what triggers followers
      const triggersPrompt = `Analyze these tweets that gained followers and identify follower acquisition triggers:

FOLLOWER-GAINING TWEETS:
${followerGainTweets.map(t => `+${t.follower_gain} followers: "${t.content?.substring(0, 150)}..."`).join('\n')}

Identify psychological triggers that make people follow:
1. Authority displays
2. Controversial takes
3. Value delivery
4. Community building
5. FOMO creation
6. Expertise demonstration

Return as JSON array of triggers with conversion rates.`;

      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: triggersPrompt }
      ], {
        model: 'gpt-4o',
        maxTokens: 1000,
        temperature: 0.3,
        priority: 'important',
        operationType: 'trigger_analysis'
      });

      let triggers: FollowerTrigger[] = [];
      try {
        const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || []);
        const parsedTriggers = JSON.parse(responseText);
        triggers = Array.isArray(parsedTriggers) ? parsedTriggers : [];
      } catch (parseError) {
        console.warn('⚠️ Trigger analysis parsing failed, using defaults');
        triggers = this.getDefaultFollowerTriggers();
      }
      
      return triggers;
      
    } catch (error) {
      console.error('❌ Follower trigger analysis failed:', error);
      return this.getDefaultFollowerTriggers();
    }
  }

  /**
   * 💡 GENERATE ACTIONABLE ALGORITHM INSIGHTS
   */
  private async generateAlgorithmInsights(
    signals: AlgorithmSignal[], 
    patterns: ViralPattern[], 
    triggers: FollowerTrigger[]
  ): Promise<AlgorithmInsight[]> {
    console.log('💡 Generating actionable algorithm insights...');
    
    const insights: AlgorithmInsight[] = [];
    
    // Insight from algorithm signals
    const shadowBanSignals = signals.filter(s => s.signal_type === 'shadow_ban');
    if (shadowBanSignals.length > 0) {
      insights.push({
        insight_type: 'posting_optimization',
        recommendation: 'Potential shadow ban detected. Reduce controversy level and increase engagement bait for 48 hours.',
        expected_impact: 25, // 25% improvement in reach
        confidence_level: 0.8,
        implementation_priority: 'immediate',
        supporting_data: { signals: shadowBanSignals }
      });
    }
    
    // Insight from viral patterns
    const topPattern = patterns.sort((a, b) => b.success_rate - a.success_rate)[0];
    if (topPattern) {
      insights.push({
        insight_type: 'content_strategy',
        recommendation: `Focus on ${topPattern.pattern_type} with ${topPattern.pattern_elements.join(', ')}. This pattern shows ${(topPattern.success_rate * 100).toFixed(1)}% success rate.`,
        expected_impact: 40,
        confidence_level: 0.7,
        implementation_priority: 'high',
        supporting_data: { pattern: topPattern }
      });
    }
    
    // Insight from follower triggers
    const topTrigger = triggers.sort((a, b) => b.conversion_rate - a.conversion_rate)[0];
    if (topTrigger) {
      insights.push({
        insight_type: 'follower_acquisition',
        recommendation: `Emphasize ${topTrigger.trigger_type} in content. This trigger has ${(topTrigger.conversion_rate * 100).toFixed(1)}% follower conversion rate.`,
        expected_impact: 60,
        confidence_level: 0.8,
        implementation_priority: 'high',
        supporting_data: { trigger: topTrigger }
      });
    }
    
    // Engagement optimization insight
    const viralSignals = signals.filter(s => s.signal_type === 'viral_trigger');
    if (viralSignals.length > 0) {
      insights.push({
        insight_type: 'engagement_tactics',
        recommendation: 'Viral content detected. Double down on similar content structure and timing within next 24 hours while algorithm boost is active.',
        expected_impact: 80,
        confidence_level: 0.9,
        implementation_priority: 'immediate',
        supporting_data: { viral_signals: viralSignals }
      });
    }
    
    return insights;
  }

  /**
   * 💾 STORE ALGORITHM DATA FOR FUTURE ANALYSIS
   */
  private async storeAlgorithmData(
    signals: AlgorithmSignal[], 
    patterns: ViralPattern[], 
    triggers: FollowerTrigger[], 
    insights: AlgorithmInsight[]
  ): Promise<void> {
    try {
      // Store algorithm signals
      if (signals.length > 0) {
        await supabaseClient.supabase.from('algorithm_signals').insert(
          signals.map(signal => ({
            signal_type: signal.signal_type,
            signal_strength: signal.signal_strength,
            detected_at: signal.detected_at.toISOString(),
            associated_content: signal.associated_content,
            metrics: signal.metrics,
            confidence: signal.confidence
          }))
        );
      }
      
      // Store viral patterns
      if (patterns.length > 0) {
        await supabaseClient.supabase.from('viral_patterns').upsert(
          patterns.map(pattern => ({
            pattern_id: pattern.pattern_id,
            pattern_type: pattern.pattern_type,
            pattern_elements: pattern.pattern_elements,
            success_rate: pattern.success_rate,
            avg_engagement: pattern.avg_engagement,
            follower_conversion_rate: pattern.follower_conversion_rate,
            examples: pattern.examples,
            optimal_conditions: pattern.optimal_conditions,
            analyzed_at: new Date().toISOString()
          }))
        );
      }
      
      // Store algorithm insights
      if (insights.length > 0) {
        await supabaseClient.supabase.from('algorithm_insights').insert(
          insights.map(insight => ({
            insight_type: insight.insight_type,
            recommendation: insight.recommendation,
            expected_impact: insight.expected_impact,
            confidence_level: insight.confidence_level,
            implementation_priority: insight.implementation_priority,
            supporting_data: insight.supporting_data,
            generated_at: new Date().toISOString()
          }))
        );
      }
      
      console.log('✅ Algorithm data stored successfully');
      
    } catch (error) {
      console.error('❌ Failed to store algorithm data:', error);
    }
  }

  /**
   * 📚 DEFAULT PATTERNS FOR FALLBACK
   */
  private getDefaultViralPatterns(): ViralPattern[] {
    return [
      {
        pattern_id: 'controversy_myth_busting',
        pattern_type: 'hook_structure',
        pattern_elements: ['X health "facts" that are wrong:', 'Your doctor believes...', 'Actually: [contrarian take]'],
        success_rate: 0.75,
        avg_engagement: 45,
        follower_conversion_rate: 0.08,
        examples: ['5 health "facts" your doctor believes that are wrong'],
        optimal_conditions: {
          time_of_day: '7-9 AM, 12-2 PM',
          day_of_week: 'Tuesday-Thursday',
          trending_topics: ['health', 'nutrition', 'wellness']
        }
      },
      {
        pattern_id: 'transformation_story',
        pattern_type: 'thread_format',
        pattern_elements: ['I eliminated X foods', 'My [metric] improved Y%', 'Here\'s what happened...'],
        success_rate: 0.68,
        avg_engagement: 38,
        follower_conversion_rate: 0.12,
        examples: ['I eliminated 5 "healthy" foods and my inflammation dropped 80%'],
        optimal_conditions: {
          time_of_day: '6-8 PM',
          audience_mood: 'motivated'
        }
      }
    ];
  }

  /**
   * 🎯 DEFAULT FOLLOWER TRIGGERS FOR FALLBACK
   */
  private getDefaultFollowerTriggers(): FollowerTrigger[] {
    return [
      {
        trigger_type: 'authority_display',
        trigger_strength: 0.8,
        conversion_rate: 0.15,
        optimal_usage: 'Reference studies, personal experience, contrarian expertise',
        examples: ['Studies show...', 'In my 10 years of...', 'Research indicates...'],
        psychological_mechanism: 'Trust and credibility establishment'
      },
      {
        trigger_type: 'controversy_take',
        trigger_strength: 0.9,
        conversion_rate: 0.12,
        optimal_usage: 'Challenge mainstream beliefs respectfully',
        examples: ['Unpopular opinion:', 'This will get me canceled but...'],
        psychological_mechanism: 'Curiosity and tribal alignment'
      },
      {
        trigger_type: 'value_delivery',
        trigger_strength: 0.7,
        conversion_rate: 0.18,
        optimal_usage: 'Provide actionable insights and tips',
        examples: ['Here\'s how to...', 'Save this before they delete it'],
        psychological_mechanism: 'Reciprocity and utility'
      }
    ];
  }

  /**
   * 📊 GET CURRENT ALGORITHM STATUS
   */
  async getAlgorithmStatus(): Promise<{
    latest_signals: AlgorithmSignal[];
    top_patterns: ViralPattern[];
    recommended_actions: string[];
    performance_trend: 'improving' | 'declining' | 'stable';
  }> {
    try {
      const { data: signals } = await supabaseClient.supabase
        .from('algorithm_signals')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(10);

      const { data: patterns } = await supabaseClient.supabase
        .from('viral_patterns')
        .select('*')
        .order('success_rate', { ascending: false })
        .limit(5);

      const { data: insights } = await supabaseClient.supabase
        .from('algorithm_insights')
        .select('*')
        .eq('implementation_priority', 'immediate')
        .order('generated_at', { ascending: false })
        .limit(5);

      const recommendedActions = insights?.map(i => i.recommendation) || [
        'Continue posting viral health content',
        'Engage with trending topics',
        'Monitor engagement patterns'
      ];

      // Determine performance trend
      let performanceTrend: 'improving' | 'declining' | 'stable' = 'stable';
      if (signals?.some(s => s.signal_type === 'viral_trigger')) {
        performanceTrend = 'improving';
      } else if (signals?.some(s => s.signal_type === 'shadow_ban')) {
        performanceTrend = 'declining';
      }

      return {
        latest_signals: signals || [],
        top_patterns: patterns || [],
        recommended_actions: recommendedActions,
        performance_trend: performanceTrend
      };

    } catch (error) {
      console.error('❌ Failed to get algorithm status:', error);
      return {
        latest_signals: [],
        top_patterns: [],
        recommended_actions: ['System unavailable - continue standard posting'],
        performance_trend: 'stable'
      };
    }
  }
}
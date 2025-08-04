/**
 * 🧠 FOLLOWER PSYCHOLOGY ENGINE
 * 
 * Understands the psychological triggers that make people follow accounts
 * Analyzes follower behavior patterns and optimizes content for maximum conversion
 */

import { supabaseClient } from '../utils/supabaseClient';
import { BudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';

export interface PsychologicalProfile {
  segment: 'health_enthusiasts' | 'fitness_focused' | 'diet_seekers' | 'wellness_curious' | 'biohackers' | 'medical_skeptics';
  trigger_preferences: {
    authority: number; // 0-1 how much they respond to authority signals
    controversy: number; // 0-1 how much they engage with controversial content
    community: number; // 0-1 how much they value community belonging
    value: number; // 0-1 how much they seek practical value
    entertainment: number; // 0-1 how much they want to be entertained
    validation: number; // 0-1 how much they seek validation of existing beliefs
  };
  content_preferences: {
    format: 'threads' | 'single_tweets' | 'mixed';
    length: 'short' | 'medium' | 'long';
    tone: 'authoritative' | 'conversational' | 'provocative' | 'supportive';
    topics: string[];
  };
  optimal_timing: {
    best_hours: number[]; // Hours of day (0-23)
    best_days: string[]; // Days of week
    timezone_preference: string;
  };
  conversion_triggers: FollowTrigger[];
}

export interface FollowTrigger {
  trigger_type: 'expertise_display' | 'controversial_take' | 'value_bomb' | 'social_proof' | 'exclusive_info' | 'community_invite';
  effectiveness: number; // 0-1
  optimal_usage: string;
  examples: string[];
  psychological_mechanism: string;
  success_metrics: {
    follow_rate: number;
    engagement_boost: number;
    retention_rate: number;
  };
}

export interface FollowerInsight {
  insight_type: 'demographics' | 'behavior_patterns' | 'content_response' | 'timing_optimization' | 'psychology_profile';
  description: string;
  actionable_recommendation: string;
  expected_impact: number; // Expected improvement in follow rate (%)
  confidence: number; // 0-1
  supporting_data: any;
}

export interface ContentOptimizationStrategy {
  target_segment: string;
  content_adjustments: {
    hook_modifications: string[];
    tone_adjustments: string[];
    format_changes: string[];
    timing_optimizations: string[];
  };
  psychological_triggers_to_emphasize: string[];
  expected_follow_rate_improvement: number;
}

export class FollowerPsychologyEngine {
  private static instance: FollowerPsychologyEngine;
  private budgetAwareOpenAI: BudgetAwareOpenAI;
  private psychologicalProfiles: Map<string, PsychologicalProfile> = new Map();

  private constructor() {
    this.budgetAwareOpenAI = new BudgetAwareOpenAI(process.env.OPENAI_API_KEY || '');
    this.initializeDefaultProfiles();
  }

  public static getInstance(): FollowerPsychologyEngine {
    if (!FollowerPsychologyEngine.instance) {
      FollowerPsychologyEngine.instance = new FollowerPsychologyEngine();
    }
    return FollowerPsychologyEngine.instance;
  }

  /**
   * 🧠 MAIN PSYCHOLOGY ANALYSIS CYCLE
   */
  async runPsychologyAnalysis(): Promise<FollowerInsight[]> {
    console.log('🧠 === RUNNING FOLLOWER PSYCHOLOGY ANALYSIS ===');
    
    try {
      // Step 1: Analyze follower behavior patterns
      const behaviorInsights = await this.analyzeBehaviorPatterns();
      console.log(`🔍 Generated ${behaviorInsights.length} behavior insights`);
      
      // Step 2: Identify optimal psychological triggers
      const triggerInsights = await this.identifyOptimalTriggers();
      console.log(`🎯 Identified ${triggerInsights.length} trigger insights`);
      
      // Step 3: Analyze content response patterns
      const contentInsights = await this.analyzeContentResponse();
      console.log(`📝 Generated ${contentInsights.length} content insights`);
      
      // Step 4: Generate timing optimization insights
      const timingInsights = await this.analyzeTimingOptimization();
      console.log(`⏰ Generated ${timingInsights.length} timing insights`);
      
      // Step 5: Create psychological profiles
      await this.updatePsychologicalProfiles();
      
      const allInsights = [
        ...behaviorInsights,
        ...triggerInsights,
        ...contentInsights,
        ...timingInsights
      ];
      
      // Store insights
      await this.storeInsights(allInsights);
      
      return allInsights;
      
    } catch (error) {
      console.error('❌ Psychology analysis failed:', error);
      return [];
    }
  }

  /**
   * 🔍 ANALYZE FOLLOWER BEHAVIOR PATTERNS
   */
  private async analyzeBehaviorPatterns(): Promise<FollowerInsight[]> {
    console.log('🔍 Analyzing follower behavior patterns...');
    
    try {
      // Get follower acquisition events
      const { data: followerEvents } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('content, follower_gain, likes, retweets, replies, posted_at')
        .gte('follower_gain', 1)
        .order('follower_gain', { ascending: false })
        .limit(50);

      if (!followerEvents?.length) {
        return [this.createDefaultBehaviorInsight()];
      }

      // Analyze patterns using AI
      const patternsPrompt = `Analyze these Twitter posts that gained followers and identify behavioral patterns:

FOLLOWER-GAINING POSTS:
${followerEvents.map(event => 
  `+${event.follower_gain} followers: "${event.content?.substring(0, 150)}..." (${event.likes}L, ${event.retweets}RT, ${event.replies}R)`
).join('\n')}

Identify:
1. What psychological triggers made people follow
2. Content patterns that convert followers vs just engagement
3. Timing patterns for follower acquisition
4. Engagement ratios that predict follows
5. Content themes that drive follows vs just likes

Return insights as JSON array with behavioral patterns.`;

      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: patternsPrompt }
      ], {
        model: 'gpt-4o',
        maxTokens: 1200,
        temperature: 0.3,
        priority: 'important',
        operationType: 'behavior_analysis'
      });

      let insights: FollowerInsight[] = [];
      try {
        const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || []);
        const parsedInsights = JSON.parse(responseText);
        insights = Array.isArray(parsedInsights) ? parsedInsights.map(this.formatBehaviorInsight) : [];
      } catch (parseError) {
        console.warn('⚠️ Behavior analysis parsing failed');
        insights = [this.createDefaultBehaviorInsight()];
      }

      return insights;

    } catch (error) {
      console.error('❌ Behavior pattern analysis failed:', error);
      return [this.createDefaultBehaviorInsight()];
    }
  }

  /**
   * 🎯 IDENTIFY OPTIMAL PSYCHOLOGICAL TRIGGERS
   */
  private async identifyOptimalTriggers(): Promise<FollowerInsight[]> {
    console.log('🎯 Identifying optimal psychological triggers...');
    
    try {
      // Get high-performing content for trigger analysis
      const { data: highPerformingContent } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('content, likes, retweets, replies, follower_gain')
        .or('likes.gte.20,follower_gain.gte.1')
        .order('likes', { ascending: false })
        .limit(30);

      if (!highPerformingContent?.length) {
        return [this.createDefaultTriggerInsight()];
      }

      // Analyze psychological triggers
      const triggersPrompt = `Analyze these high-performing health/wellness tweets for psychological triggers:

HIGH-PERFORMING CONTENT:
${highPerformingContent.map(content => 
  `"${content.content?.substring(0, 200)}..." (${content.likes}L, ${content.follower_gain}F)`
).join('\n')}

Identify specific psychological triggers that work in health/wellness:
1. Authority signals (credentials, studies, experience)
2. Social proof (popularity, testimonials, results)
3. Controversy (contrarian takes, myth-busting)
4. Fear/urgency (health risks, time-sensitive info)
5. Tribal identity (us vs them, community building)
6. Curiosity gaps (incomplete information, secrets)
7. Validation (confirming existing beliefs)

For each trigger, provide:
- Effectiveness rating (0-1)
- Optimal usage examples
- Psychological mechanism
- Expected follow conversion rate

Return as JSON array of trigger insights.`;

      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: triggersPrompt }
      ], {
        model: 'gpt-4o',
        maxTokens: 1500,
        temperature: 0.3,
        priority: 'important',
        operationType: 'trigger_analysis'
      });

      let insights: FollowerInsight[] = [];
      try {
        const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || []);
        const parsedInsights = JSON.parse(responseText);
        insights = Array.isArray(parsedInsights) ? parsedInsights.map(this.formatTriggerInsight) : [];
      } catch (parseError) {
        console.warn('⚠️ Trigger analysis parsing failed');
        insights = [this.createDefaultTriggerInsight()];
      }

      return insights;

    } catch (error) {
      console.error('❌ Trigger identification failed:', error);
      return [this.createDefaultTriggerInsight()];
    }
  }

  /**
   * 📝 ANALYZE CONTENT RESPONSE PATTERNS
   */
  private async analyzeContentResponse(): Promise<FollowerInsight[]> {
    console.log('📝 Analyzing content response patterns...');
    
    try {
      // Compare different content types and their follow rates
      const { data: contentData } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('content, likes, retweets, replies, follower_gain, posted_at')
        .gte('posted_at', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 2 weeks
        .order('posted_at', { ascending: false });

      if (!contentData?.length) {
        return [this.createDefaultContentInsight()];
      }

      // Categorize content and analyze performance
      const contentPrompt = `Analyze these health/wellness tweets for content response patterns:

CONTENT DATA:
${contentData.slice(0, 20).map(data => 
  `"${data.content?.substring(0, 150)}..." → ${data.likes}L, ${data.retweets}RT, ${data.replies}R, +${data.follower_gain || 0}F`
).join('\n')}

Identify:
1. Content formats that drive follows vs just engagement
2. Optimal content length for follower conversion
3. Topics that convert followers vs just likes
4. Tone/style that encourages following
5. Call-to-action effectiveness for follows

Provide insights on:
- Single tweets vs threads for follower acquisition
- Controversial vs educational content conversion rates
- Question-based vs statement-based content
- Personal stories vs factual content
- Hook effectiveness for different audiences

Return as JSON array of content insights.`;

      const response = await this.budgetAwareOpenAI.createChatCompletion([
        { role: 'user', content: contentPrompt }
      ], {
        model: 'gpt-4o',
        maxTokens: 1200,
        temperature: 0.3,
        priority: 'optional',
        operationType: 'content_analysis'
      });

      let insights: FollowerInsight[] = [];
      try {
        const responseText = typeof response.response === 'string' ? response.response : JSON.stringify(response.response || []);
        const parsedInsights = JSON.parse(responseText);
        insights = Array.isArray(parsedInsights) ? parsedInsights.map(this.formatContentInsight) : [];
      } catch (parseError) {
        console.warn('⚠️ Content analysis parsing failed');
        insights = [this.createDefaultContentInsight()];
      }

      return insights;

    } catch (error) {
      console.error('❌ Content response analysis failed:', error);
      return [this.createDefaultContentInsight()];
    }
  }

  /**
   * ⏰ ANALYZE TIMING OPTIMIZATION FOR FOLLOWS
   */
  private async analyzeTimingOptimization(): Promise<FollowerInsight[]> {
    console.log('⏰ Analyzing timing optimization...');
    
    try {
      // Get tweets with timestamps and follower gains
      const { data: timingData } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('posted_at, follower_gain, likes, retweets')
        .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .order('posted_at', { ascending: false });

      if (!timingData?.length) {
        return [this.createDefaultTimingInsight()];
      }

      // Analyze timing patterns
      const hourlyFollows = new Array(24).fill(0);
      const hourlyPosts = new Array(24).fill(0);
      const dailyFollows = new Map<string, number>();
      const dailyPosts = new Map<string, number>();

      timingData.forEach(data => {
        const date = new Date(data.posted_at);
        const hour = date.getHours();
        const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'long' });
        
        hourlyFollows[hour] += data.follower_gain || 0;
        hourlyPosts[hour]++;
        
        dailyFollows.set(dayOfWeek, (dailyFollows.get(dayOfWeek) || 0) + (data.follower_gain || 0));
        dailyPosts.set(dayOfWeek, (dailyPosts.get(dayOfWeek) || 0) + 1);
      });

      // Find optimal hours and days
      const bestHours = hourlyFollows
        .map((follows, hour) => ({ hour, avgFollows: hourlyPosts[hour] > 0 ? follows / hourlyPosts[hour] : 0 }))
        .sort((a, b) => b.avgFollows - a.avgFollows)
        .slice(0, 3);

      const bestDays = Array.from(dailyFollows.entries())
        .map(([day, follows]) => ({ day, avgFollows: (dailyPosts.get(day) || 1) > 0 ? follows / (dailyPosts.get(day) || 1) : 0 }))
        .sort((a, b) => b.avgFollows - a.avgFollows)
        .slice(0, 3);

      const timingInsight: FollowerInsight = {
        insight_type: 'timing_optimization',
        description: `Optimal posting times for follower acquisition: ${bestHours.map(h => `${h.hour}:00`).join(', ')} on ${bestDays.map(d => d.day).join(', ')}`,
        actionable_recommendation: `Schedule high-value content during ${bestHours[0].hour}:00-${bestHours[0].hour + 1}:00 on ${bestDays[0].day}s for maximum follower gain`,
        expected_impact: 25,
        confidence: 0.7,
        supporting_data: { bestHours, bestDays, totalData: timingData.length }
      };

      return [timingInsight];

    } catch (error) {
      console.error('❌ Timing optimization analysis failed:', error);
      return [this.createDefaultTimingInsight()];
    }
  }

  /**
   * 🔄 UPDATE PSYCHOLOGICAL PROFILES
   */
  private async updatePsychologicalProfiles(): Promise<void> {
    console.log('🔄 Updating psychological profiles...');
    
    try {
      // Get follower behavior data
      const { data: behaviorData } = await supabaseClient.supabase
        .from('tweet_analytics')
        .select('content, likes, retweets, replies, follower_gain')
        .gte('follower_gain', 1)
        .limit(30);

      if (!behaviorData?.length) return;

      // Update profiles for each segment
      for (const segment of ['health_enthusiasts', 'fitness_focused', 'diet_seekers', 'wellness_curious', 'biohackers']) {
        await this.updateSegmentProfile(segment, behaviorData);
      }

      console.log('✅ Psychological profiles updated');

    } catch (error) {
      console.error('❌ Profile update failed:', error);
    }
  }

  /**
   * 📊 UPDATE SEGMENT PROFILE
   */
  private async updateSegmentProfile(segment: string, data: any[]): Promise<void> {
    // Analyze what content works for each segment
    // This would involve more sophisticated ML in production
    
    const profile: PsychologicalProfile = {
      segment: segment as any,
      trigger_preferences: {
        authority: 0.7,
        controversy: segment === 'biohackers' ? 0.8 : 0.5,
        community: 0.6,
        value: 0.9,
        entertainment: 0.4,
        validation: 0.5
      },
      content_preferences: {
        format: 'mixed',
        length: 'medium',
        tone: 'authoritative',
        topics: ['nutrition', 'fitness', 'wellness', 'supplements']
      },
      optimal_timing: {
        best_hours: [7, 12, 19],
        best_days: ['Tuesday', 'Wednesday', 'Thursday'],
        timezone_preference: 'EST'
      },
      conversion_triggers: this.getDefaultFollowTriggers()
    };

    // Store/update profile
    await supabaseClient.supabase.from('follower_psychology_profiles').upsert({
      follower_segment: segment,
      trigger_preferences: profile.trigger_preferences,
      content_preferences: profile.content_preferences,
      optimal_timing: profile.optimal_timing,
      conversion_probability: 0.1 // Base conversion rate
    });

    this.psychologicalProfiles.set(segment, profile);
  }

  /**
   * 🎯 GENERATE CONTENT OPTIMIZATION STRATEGY
   */
  async generateContentOptimizationStrategy(targetSegment: string): Promise<ContentOptimizationStrategy> {
    console.log(`🎯 Generating optimization strategy for ${targetSegment}...`);
    
    const profile = this.psychologicalProfiles.get(targetSegment) || this.getDefaultProfile();
    
    return {
      target_segment: targetSegment,
      content_adjustments: {
        hook_modifications: [
          'Use more authority signals',
          'Add controversy elements',
          'Include community language',
          'Emphasize practical value'
        ],
        tone_adjustments: [
          'Be more authoritative',
          'Use inclusive language',
          'Add personal experience',
          'Include scientific backing'
        ],
        format_changes: [
          'Use more threads for complex topics',
          'Add visual elements',
          'Include actionable steps',
          'End with engagement questions'
        ],
        timing_optimizations: [
          `Post at ${profile.optimal_timing.best_hours.join(', ')} hours`,
          `Focus on ${profile.optimal_timing.best_days.join(', ')}`,
          'Monitor early engagement velocity',
          'Adjust posting frequency based on response'
        ]
      },
      psychological_triggers_to_emphasize: [
        'Authority and expertise',
        'Social proof and testimonials',
        'Practical value delivery',
        'Community belonging'
      ],
      expected_follow_rate_improvement: 35
    };
  }

  /**
   * 💾 STORE INSIGHTS
   */
  private async storeInsights(insights: FollowerInsight[]): Promise<void> {
    try {
      for (const insight of insights) {
        await supabaseClient.supabase.from('algorithm_insights').insert({
          insight_type: insight.insight_type,
          recommendation: insight.actionable_recommendation,
          expected_impact: insight.expected_impact,
          confidence_level: insight.confidence,
          implementation_priority: insight.expected_impact > 30 ? 'high' : 'medium',
          supporting_data: insight.supporting_data
        });
      }
      console.log(`✅ Stored ${insights.length} psychology insights`);
    } catch (error) {
      console.error('❌ Failed to store insights:', error);
    }
  }

  /**
   * 📚 FORMATTING HELPERS
   */
  private formatBehaviorInsight(raw: any): FollowerInsight {
    return {
      insight_type: 'behavior_patterns',
      description: raw.description || 'Follower behavior pattern identified',
      actionable_recommendation: raw.recommendation || 'Optimize content based on behavior patterns',
      expected_impact: raw.expected_impact || 20,
      confidence: raw.confidence || 0.6,
      supporting_data: raw
    };
  }

  private formatTriggerInsight(raw: any): FollowerInsight {
    return {
      insight_type: 'psychology_profile',
      description: raw.description || 'Psychological trigger identified',
      actionable_recommendation: raw.recommendation || 'Use psychological triggers in content',
      expected_impact: raw.expected_impact || 25,
      confidence: raw.confidence || 0.7,
      supporting_data: raw
    };
  }

  private formatContentInsight(raw: any): FollowerInsight {
    return {
      insight_type: 'content_response',
      description: raw.description || 'Content response pattern identified',
      actionable_recommendation: raw.recommendation || 'Adjust content format and style',
      expected_impact: raw.expected_impact || 15,
      confidence: raw.confidence || 0.6,
      supporting_data: raw
    };
  }

  /**
   * 📚 DEFAULT INSIGHTS
   */
  private createDefaultBehaviorInsight(): FollowerInsight {
    return {
      insight_type: 'behavior_patterns',
      description: 'Health enthusiasts follow accounts that provide practical, science-backed advice with personal authority',
      actionable_recommendation: 'Include credentials, studies, and personal experience in content to build authority',
      expected_impact: 30,
      confidence: 0.8,
      supporting_data: { source: 'default_pattern' }
    };
  }

  private createDefaultTriggerInsight(): FollowerInsight {
    return {
      insight_type: 'psychology_profile',
      description: 'Authority signals and controversial takes drive highest follow rates in health niche',
      actionable_recommendation: 'Lead with expertise indicators and challenge conventional wisdom respectfully',
      expected_impact: 35,
      confidence: 0.9,
      supporting_data: { source: 'default_trigger' }
    };
  }

  private createDefaultContentInsight(): FollowerInsight {
    return {
      insight_type: 'content_response',
      description: 'Myth-busting threads with practical alternatives generate highest follower conversion',
      actionable_recommendation: 'Create more "X myths debunked" content with actionable alternatives',
      expected_impact: 40,
      confidence: 0.8,
      supporting_data: { source: 'default_content' }
    };
  }

  private createDefaultTimingInsight(): FollowerInsight {
    return {
      insight_type: 'timing_optimization',
      description: 'Health content performs best at 7-9 AM and 6-8 PM when people think about wellness',
      actionable_recommendation: 'Schedule high-value content during morning routine and evening planning times',
      expected_impact: 20,
      confidence: 0.7,
      supporting_data: { source: 'default_timing' }
    };
  }

  private getDefaultProfile(): PsychologicalProfile {
    return {
      segment: 'health_enthusiasts',
      trigger_preferences: {
        authority: 0.8,
        controversy: 0.6,
        community: 0.7,
        value: 0.9,
        entertainment: 0.4,
        validation: 0.5
      },
      content_preferences: {
        format: 'mixed',
        length: 'medium',
        tone: 'authoritative',
        topics: ['nutrition', 'fitness', 'wellness']
      },
      optimal_timing: {
        best_hours: [7, 12, 19],
        best_days: ['Tuesday', 'Wednesday', 'Thursday'],
        timezone_preference: 'EST'
      },
      conversion_triggers: this.getDefaultFollowTriggers()
    };
  }

  private getDefaultFollowTriggers(): FollowTrigger[] {
    return [
      {
        trigger_type: 'expertise_display',
        effectiveness: 0.8,
        optimal_usage: 'Reference studies, credentials, personal results',
        examples: ['Studies show...', 'In my 10 years...', 'Research indicates...'],
        psychological_mechanism: 'Authority and trust establishment',
        success_metrics: { follow_rate: 0.15, engagement_boost: 1.3, retention_rate: 0.85 }
      }
    ];
  }

  private initializeDefaultProfiles(): void {
    // Initialize with default psychological profiles for different follower segments
    const segments = ['health_enthusiasts', 'fitness_focused', 'diet_seekers', 'wellness_curious', 'biohackers'];
    segments.forEach(segment => {
      this.psychologicalProfiles.set(segment, this.getDefaultProfile());
    });
  }
}
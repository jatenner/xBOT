/**
 * 🧠 ENHANCED AUTONOMOUS POSTING ENGINE
 * Intelligence-driven posting system that learns optimal timing, content, and engagement strategies
 * Integrates with all growth intelligence systems for maximum follower acquisition
 */

import { PRODUCTION_CONFIG, getBudgetConfig, getGrowthTargets } from '../config/productionConfig';
import { IntelligentGrowthMaster } from '../intelligence/intelligentGrowthMaster';
import { AdaptivePostingFrequency } from '../intelligence/adaptivePostingFrequency';
import { TopicPerformancePrioritizer } from '../intelligence/topicPerformancePrioritizer';
import { EmergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { BrowserTweetPoster } from '../utils/browserTweetPoster';
import { EnhancedSemanticUniqueness } from '../utils/enhancedSemanticUniqueness';
import { SmartModelSelector } from '../utils/smartModelSelector';
import { supabaseClient } from '../utils/supabaseClient';

export interface IntelligentPostingDecision {
  shouldPost: boolean;
  reasoning: string;
  confidence: number;
  strategy: 'conservative' | 'balanced' | 'aggressive';
  contentRecommendations: {
    topic: string;
    format: string;
    viralPotential: number;
  };
  timing: {
    optimalTime: Date;
    slotType: 'primary' | 'secondary' | 'emergency';
    hoursUntilOptimal: number;
  };
  expectedPerformance: {
    estimatedLikes: number;
    estimatedEngagement: number;
    followerGrowthPotential: number;
  };
}

export interface IntelligentPostingResult {
  success: boolean;
  tweetId?: string;
  content?: string;
  performance: {
    posted: boolean;
    uniquenessScore: number;
    intelligenceScore: number;
    timing: string;
  };
  learningData: {
    topicUsed: string;
    formatUsed: string;
    timingAccuracy: number;
    predictedVsActual?: any;
  };
  error?: string;
}

export class EnhancedAutonomousPostingEngine {
  private static instance: EnhancedAutonomousPostingEngine;
  private intelligenceInitialized = false;
  private lastPostTime: Date | null = null;
  private consecutiveFailures = 0;
  private readonly MAX_FAILURES = 3;

  static getInstance(): EnhancedAutonomousPostingEngine {
    if (!this.instance) {
      this.instance = new EnhancedAutonomousPostingEngine();
    }
    return this.instance;
  }

  /**
   * 🚀 INITIALIZE INTELLIGENT SYSTEMS
   */
  async initialize(): Promise<void> {
    try {
      console.log('🧠 === INITIALIZING ENHANCED AUTONOMOUS POSTING ENGINE ===');
      
      // Initialize intelligence systems
      if (PRODUCTION_CONFIG.intelligence.enabled) {
        await IntelligentGrowthMaster.getInstance().initialize();
        this.intelligenceInitialized = true;
        console.log('✅ Intelligence systems initialized');
      }

      // Load last post time
      await this.loadLastPostTime();
      
      console.log('✅ Enhanced autonomous posting engine ready');
    } catch (error) {
      console.error('❌ Failed to initialize enhanced posting engine:', error);
      throw error;
    }
  }

  /**
   * 🧠 MAKE INTELLIGENT POSTING DECISION
   */
  async makeIntelligentPostingDecision(): Promise<IntelligentPostingDecision> {
    try {
      console.log('🧠 === MAKING INTELLIGENT POSTING DECISION ===');

      // Get time since last post
      const timeSinceLastPost = this.getTimeSinceLastPost();
      const hoursSinceLastPost = timeSinceLastPost / (60 * 60 * 1000);

      console.log(`⏰ Time since last post: ${hoursSinceLastPost.toFixed(1)} hours`);

      // Check budget status with intelligence
      const budgetConfig = getBudgetConfig();
      const budgetStatus = await EmergencyBudgetLockdown.isLockedDown(hoursSinceLastPost);
      
      console.log(`💰 Budget Status: ${budgetStatus.lockdownActive ? 'LOCKED' : 'OK'}`);
      console.log(`💵 Spending: $${budgetStatus.totalSpent.toFixed(2)} / $${budgetStatus.dailyLimit.toFixed(2)}`);

      // EMERGENCY OVERRIDE: Force post if too long since last post
      if (hoursSinceLastPost >= budgetConfig.CRITICAL_OVERRIDE_HOURS) {
        console.log(`🚨 EMERGENCY OVERRIDE: ${hoursSinceLastPost.toFixed(1)} hours since last post`);
        return this.createEmergencyDecision(hoursSinceLastPost);
      }

      // If budget locked and not emergency, check intelligence recommendations
      if (budgetStatus.lockdownActive) {
        const hoursUntilOverride = Math.max(0, budgetConfig.CRITICAL_OVERRIDE_HOURS - hoursSinceLastPost);
        return this.createBudgetLockedDecision(hoursUntilOverride, budgetStatus);
      }

      // Get intelligent recommendations
      let recommendations;
      if (this.intelligenceInitialized) {
        recommendations = await IntelligentGrowthMaster.getInstance().getPostingRecommendations();
      } else {
        recommendations = this.getDefaultRecommendations();
      }

      // Check if current time is optimal
      const currentHour = new Date().getHours();
      const isActiveHours = currentHour >= PRODUCTION_CONFIG.posting.activeHoursStart && 
                           currentHour <= PRODUCTION_CONFIG.posting.activeHoursEnd;

      if (!isActiveHours) {
        return this.createInactiveHoursDecision(currentHour, recommendations);
      }

      // Calculate posting decision based on intelligent analysis
      const minHoursBetween = PRODUCTION_CONFIG.posting.minHoursBetweenPosts;
      
      if (hoursSinceLastPost < minHoursBetween) {
        const waitHours = minHoursBetween - hoursSinceLastPost;
        return this.createWaitDecision(waitHours, recommendations);
      }

      // Generate optimal posting decision
      return this.createOptimalPostingDecision(recommendations, hoursSinceLastPost);

    } catch (error) {
      console.error('❌ Error making intelligent posting decision:', error);
      return this.createErrorDecision(error);
    }
  }

  /**
   * 🚀 EXECUTE INTELLIGENT POST
   */
  async executeIntelligentPost(): Promise<IntelligentPostingResult> {
    console.log('🚀 === EXECUTING INTELLIGENT POST ===');
    
    const startTime = Date.now();
    let contentAttempts = 0;
    const maxAttempts = 5;

    try {
      // Step 1: Make posting decision
      const decision = await this.makeIntelligentPostingDecision();
      
      if (!decision.shouldPost) {
        return {
          success: false,
          performance: {
            posted: false,
            uniquenessScore: 0,
            intelligenceScore: decision.confidence,
            timing: decision.timing.optimalTime.toISOString()
          },
          learningData: {
            topicUsed: decision.contentRecommendations.topic,
            formatUsed: decision.contentRecommendations.format,
            timingAccuracy: 0
          },
          error: decision.reasoning
        };
      }

      console.log(`🎯 Posting decision: ${decision.reasoning}`);
      console.log(`📊 Confidence: ${(decision.confidence * 100).toFixed(1)}%`);
      console.log(`🎭 Strategy: ${decision.strategy.toUpperCase()}`);

      // Step 2: Generate intelligent content
      let contentResult;
      let uniquenessResult;
      
      do {
        contentAttempts++;
        console.log(`🔄 Content generation attempt ${contentAttempts}/${maxAttempts}`);
        
        contentResult = await this.generateIntelligentContent(decision.contentRecommendations);
        
        if (!contentResult.success) {
          console.log(`❌ Content generation failed: ${contentResult.error}`);
          continue;
        }

        // Check uniqueness with enhanced system
        uniquenessResult = await EnhancedSemanticUniqueness.checkContentUniqueness(contentResult.content);
        
        if (!uniquenessResult.success) {
          console.warn(`⚠️ Uniqueness check failed: ${uniquenessResult.error}`);
          break;
        }

        if (uniquenessResult.isUnique) {
          console.log('✅ Content is semantically unique');
          break;
        } else {
          console.log(`🛑 Content too similar (${(uniquenessResult.similarityScore * 100).toFixed(1)}% similar)`);
          if (contentAttempts >= maxAttempts) {
            console.log('⚠️ Max attempts reached - posting anyway to maintain schedule');
            break;
          }
        }

      } while (contentAttempts < maxAttempts);

      if (!contentResult?.success) {
        throw new Error('Failed to generate content after multiple attempts');
      }

      // Step 3: Post using browser automation
      console.log('🤖 Posting via browser automation...');
      const poster = new BrowserTweetPoster();
      const postResult = await poster.postTweet(contentResult.content);

      if (!postResult.success) {
        throw new Error(postResult.error || 'Posting failed');
      }

      console.log('✅ Tweet posted successfully!');
      
      // Step 4: Store learning data and performance metrics
      const learningData = await this.storeLearningData(
        postResult.tweet_id || 'unknown',
        contentResult,
        decision,
        uniquenessResult
      );

      // Update last post time
      this.lastPostTime = new Date();
      this.consecutiveFailures = 0;

      const executionTime = Date.now() - startTime;
      console.log(`⚡ Total execution time: ${executionTime}ms`);

      return {
        success: true,
        tweetId: postResult.tweet_id,
        content: contentResult.content,
        performance: {
          posted: true,
          uniquenessScore: uniquenessResult?.similarityScore ? (1 - uniquenessResult.similarityScore) : 1,
          intelligenceScore: decision.confidence,
          timing: decision.timing.optimalTime.toISOString()
        },
        learningData: {
          topicUsed: decision.contentRecommendations.topic,
          formatUsed: decision.contentRecommendations.format,
          timingAccuracy: this.calculateTimingAccuracy(decision.timing.optimalTime),
          predictedVsActual: {
            predicted: decision.expectedPerformance,
            executionTime
          }
        }
      };

    } catch (error: any) {
      console.error('❌ Intelligent posting failed:', error);
      this.consecutiveFailures++;
      
      return {
        success: false,
        performance: {
          posted: false,
          uniquenessScore: 0,
          intelligenceScore: 0,
          timing: new Date().toISOString()
        },
        learningData: {
          topicUsed: 'unknown',
          formatUsed: 'unknown',
          timingAccuracy: 0
        },
        error: error.message
      };
    }
  }

  /**
   * 🧠 GENERATE INTELLIGENT CONTENT
   */
  private async generateIntelligentContent(recommendations: any): Promise<any> {
    try {
      // Use smart model selection based on budget
      const modelSelection = await SmartModelSelector.selectModel('content_generation', 1000);
      
      // Generate content based on topic and format recommendations
      const content = await this.generateContentFromRecommendations(recommendations, modelSelection);
      
      return {
        success: true,
        content,
        metadata: {
          topic: recommendations.topic,
          format: recommendations.format,
          model: modelSelection.model,
          cost: modelSelection.estimatedCost
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 📝 GENERATE CONTENT FROM RECOMMENDATIONS
   */
  private async generateContentFromRecommendations(recommendations: any, modelSelection: any): Promise<string> {
    // Template-based content generation for now (can be enhanced with full AI)
    const templates = {
      'myth_buster': `You've been lied to about ${recommendations.topic}. Here's what the research actually shows...`,
      'breaking_news': `BREAKING: New research reveals surprising truth about ${recommendations.topic}...`,
      'how_to': `Here's how to optimize your ${recommendations.topic} in just 5 minutes:`,
      'shocking_fact': `This will shock you: 90% of people get ${recommendations.topic} completely wrong.`,
      'contrarian': `Everyone says ${recommendations.topic} is important. They're missing the real story.`
    };

    const template = templates[recommendations.format] || templates['how_to'];
    
    // Add some health facts based on topic
    const healthFacts = {
      'gut_health': 'Your gut produces 90% of your body\'s serotonin',
      'immune_system': 'Regular exercise can boost immune function by 40%',
      'nutrition_myths': 'Most nutrition advice is based on outdated science',
      'sleep_optimization': 'Poor sleep quality affects 300+ biological processes'
    };

    const fact = healthFacts[recommendations.topic] || 'proper health optimization requires evidence-based approaches';
    
    return template.replace(/\.\.\.$/, `: ${fact}.`);
  }

  /**
   * 💾 STORE LEARNING DATA
   */
  private async storeLearningData(tweetId: string, contentResult: any, decision: any, uniquenessResult: any): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      // Store in tweets table with enhanced metadata
      const tweetData = {
        tweet_id: tweetId,
        text: contentResult.content,
        topic_category: decision.contentRecommendations.topic,
        content_format: decision.contentRecommendations.format,
        hour_posted: new Date().getHours(),
        day_of_week: new Date().getDay(),
        viral_score: 0, // Will be updated by analytics
        engagement_rate: 0, // Will be updated by analytics
        predicted_performance: decision.expectedPerformance,
        intelligence_metadata: {
          confidence: decision.confidence,
          strategy: decision.strategy,
          timing_type: decision.timing.slotType,
          uniqueness_score: uniquenessResult?.similarityScore || 0
        }
      };

      await supabaseClient.supabase
        .from('tweets')
        .insert(tweetData);

      // Store approved content fingerprint
      if (uniquenessResult?.conceptAnalysis) {
        await EnhancedSemanticUniqueness.storeApprovedContent(
          tweetId,
          contentResult.content,
          decision.contentRecommendations.topic
        );
      }

      console.log('💾 Learning data stored successfully');
    } catch (error) {
      console.error('❌ Error storing learning data:', error);
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private async loadLastPostTime(): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      const { data: lastTweet } = await supabaseClient.supabase
        .from('tweets')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (lastTweet) {
        this.lastPostTime = new Date(lastTweet.created_at);
        console.log(`📅 Last post: ${this.lastPostTime.toISOString()}`);
      }
    } catch (error) {
      console.log('ℹ️ No previous posts found or error loading last post time');
    }
  }

  private getTimeSinceLastPost(): number {
    if (!this.lastPostTime) return 24 * 60 * 60 * 1000; // 24 hours if no previous post
    return Date.now() - this.lastPostTime.getTime();
  }

  private calculateTimingAccuracy(optimalTime: Date): number {
    const actualTime = new Date();
    const timeDiff = Math.abs(actualTime.getTime() - optimalTime.getTime());
    const hoursDiff = timeDiff / (60 * 60 * 1000);
    return Math.max(0, 1 - (hoursDiff / 24)); // Accuracy decreases with time difference
  }

  // Decision creation methods
  private createEmergencyDecision(hoursSinceLastPost: number): IntelligentPostingDecision {
    return {
      shouldPost: true,
      reasoning: `Emergency override: ${hoursSinceLastPost.toFixed(1)} hours since last post`,
      confidence: 1.0,
      strategy: 'aggressive',
      contentRecommendations: {
        topic: 'gut_health',
        format: 'how_to',
        viralPotential: 7.0
      },
      timing: {
        optimalTime: new Date(),
        slotType: 'emergency',
        hoursUntilOptimal: 0
      },
      expectedPerformance: {
        estimatedLikes: 25,
        estimatedEngagement: 0.04,
        followerGrowthPotential: 8
      }
    };
  }

  private createBudgetLockedDecision(hoursUntilOverride: number, budgetStatus: any): IntelligentPostingDecision {
    return {
      shouldPost: false,
      reasoning: `Budget lockdown active - emergency override in ${hoursUntilOverride.toFixed(1)} hours`,
      confidence: 1.0,
      strategy: 'conservative',
      contentRecommendations: {
        topic: 'general_health',
        format: 'educational',
        viralPotential: 5.0
      },
      timing: {
        optimalTime: new Date(Date.now() + (hoursUntilOverride * 60 * 60 * 1000)),
        slotType: 'emergency',
        hoursUntilOptimal: hoursUntilOverride
      },
      expectedPerformance: {
        estimatedLikes: 0,
        estimatedEngagement: 0,
        followerGrowthPotential: 0
      }
    };
  }

  private createOptimalPostingDecision(recommendations: any, hoursSinceLastPost: number): IntelligentPostingDecision {
    return {
      shouldPost: true,
      reasoning: `Optimal posting conditions met - ${recommendations.strategicInsights[0] || 'intelligent timing detected'}`,
      confidence: recommendations.postingTiming.confidence,
      strategy: 'balanced',
      contentRecommendations: {
        topic: recommendations.contentStrategy.priorityTopic,
        format: recommendations.contentStrategy.suggestedFormat,
        viralPotential: recommendations.contentStrategy.viralPotential
      },
      timing: {
        optimalTime: recommendations.postingTiming.nextOptimalTime,
        slotType: 'primary',
        hoursUntilOptimal: 0
      },
      expectedPerformance: {
        estimatedLikes: 30,
        estimatedEngagement: 0.045,
        followerGrowthPotential: 12
      }
    };
  }

  private createWaitDecision(waitHours: number, recommendations: any): IntelligentPostingDecision {
    return {
      shouldPost: false,
      reasoning: `Waiting for optimal interval - ${waitHours.toFixed(1)} hours remaining`,
      confidence: 0.8,
      strategy: 'balanced',
      contentRecommendations: recommendations?.contentStrategy || {
        topic: 'gut_health',
        format: 'educational',
        viralPotential: 6.0
      },
      timing: {
        optimalTime: new Date(Date.now() + (waitHours * 60 * 60 * 1000)),
        slotType: 'primary',
        hoursUntilOptimal: waitHours
      },
      expectedPerformance: {
        estimatedLikes: 28,
        estimatedEngagement: 0.042,
        followerGrowthPotential: 10
      }
    };
  }

  private createInactiveHoursDecision(currentHour: number, recommendations: any): IntelligentPostingDecision {
    const activeStart = PRODUCTION_CONFIG.posting.activeHoursStart;
    const hoursUntilActive = currentHour < activeStart ? 
      activeStart - currentHour : 
      24 - currentHour + activeStart;

    return {
      shouldPost: false,
      reasoning: `Outside active hours (${currentHour}:00) - waiting until ${activeStart}:00`,
      confidence: 0.9,
      strategy: 'conservative',
      contentRecommendations: recommendations?.contentStrategy || {
        topic: 'sleep_optimization',
        format: 'educational',
        viralPotential: 5.5
      },
      timing: {
        optimalTime: new Date(Date.now() + (hoursUntilActive * 60 * 60 * 1000)),
        slotType: 'primary',
        hoursUntilOptimal: hoursUntilActive
      },
      expectedPerformance: {
        estimatedLikes: 35,
        estimatedEngagement: 0.048,
        followerGrowthPotential: 14
      }
    };
  }

  private createErrorDecision(error: any): IntelligentPostingDecision {
    return {
      shouldPost: false,
      reasoning: `Decision error: ${error.message}`,
      confidence: 0.1,
      strategy: 'conservative',
      contentRecommendations: {
        topic: 'general_health',
        format: 'educational',
        viralPotential: 4.0
      },
      timing: {
        optimalTime: new Date(Date.now() + (30 * 60 * 1000)), // 30 minutes
        slotType: 'emergency',
        hoursUntilOptimal: 0.5
      },
      expectedPerformance: {
        estimatedLikes: 15,
        estimatedEngagement: 0.03,
        followerGrowthPotential: 5
      }
    };
  }

  private getDefaultRecommendations(): any {
    return {
      postingTiming: {
        nextOptimalTime: new Date(Date.now() + (2 * 60 * 60 * 1000)),
        confidence: 0.7,
        reasoning: 'Default optimal timing'
      },
      contentStrategy: {
        priorityTopic: 'gut_health',
        suggestedFormat: 'how_to',
        viralPotential: 6.5,
        reasoning: 'High-performing health topic'
      },
      strategicInsights: ['Intelligence systems initializing - using proven defaults']
    };
  }
} 
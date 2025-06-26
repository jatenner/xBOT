import { SupremeAIOrchestrator } from '../agents/supremeAIOrchestrator';
import { supabaseClient } from './supabaseClient';
import { NewsAPIAgent } from '../agents/newsAPIAgent';
import { RealTimeTrendsAgent } from '../agents/realTimeTrendsAgent';
import { realTimeLimitsAgent } from '../agents/realTimeLimitsIntelligenceAgent';

/**
 * 🧠 DYNAMIC POSTING CONTROLLER
 * Supreme AI makes ALL posting decisions - no hardcoded limits!
 * 
 * NOW WITH REAL-TIME LIMITS INTELLIGENCE:
 * - Knows EXACTLY what we can and cannot do RIGHT NOW
 * - No more guessing about API limits
 * - Makes decisions based on REAL current status
 */

export class DynamicPostingController {
  private supremeOrchestrator: SupremeAIOrchestrator;
  private newsAgent: NewsAPIAgent;
  private trendsAgent: RealTimeTrendsAgent;
  private lastDecisionTime: Date | null = null;
  private emergencyMode: boolean = false;
  
  constructor() {
    this.supremeOrchestrator = new SupremeAIOrchestrator();
    this.newsAgent = NewsAPIAgent.getInstance();
    this.trendsAgent = new RealTimeTrendsAgent();
    console.log('🚨 Dynamic Posting Controller now using Real-Time Limits Intelligence');
  }

  /**
   * 🎯 SUPREME AI DECISION MAKING
   * No limits, no constraints - pure AI intelligence
   */
  async makePostingDecision(): Promise<{
    shouldPost: boolean;
    postCount: number;
    urgency: number;
    reasoning: string;
    strategy: string;
    timeSpacing: number;
    executionPlan: any[];
  }> {
    console.log('🧠 === SUPREME AI POSTING DECISION ===');
    console.log('👑 Letting AI decide everything - no human constraints!');

    try {
      // 1. Analyze current world state
      const worldState = await this.analyzeWorldState();
      
      // 2. Check for emergency situations (overrides all limits)
      const emergencyLevel = await this.detectEmergencyLevel(worldState);
      
      // 3. Supreme AI makes the decision
      const decision = await this.supremeOrchestrator.makeSupremeDecision();
      
      // 4. Apply emergency boost if needed
      if (emergencyLevel > 0.8) {
        decision.strategy.postingStrategy.postCount = Math.min(
          decision.strategy.postingStrategy.postCount * 2, 
          15 // Only technical Twitter limit
        );
        decision.strategy.postingStrategy.urgency = Math.max(
          decision.strategy.postingStrategy.urgency,
          emergencyLevel
        );
        this.emergencyMode = true;
        console.log(`🚨 EMERGENCY MODE: Boosting posts to ${decision.strategy.postingStrategy.postCount}`);
      }

      // 5. Validate against ONLY technical limits using Real-Time Intelligence
      const technicallyValid = await this.validateTechnicalLimits(decision.strategy);
      
      if (!technicallyValid.canPost) {
        console.log(`🚨 Real-Time Limits blocked posting: ${technicallyValid.reason}`);
        console.log(`💡 Recommended action: ${technicallyValid.recommendedAction}`);
        
        // Calculate intelligent wait time
        const waitTime = technicallyValid.nextAvailableTime 
          ? Math.ceil((technicallyValid.nextAvailableTime.getTime() - Date.now()) / 60000)
          : 60;
        
        return {
          shouldPost: false,
          postCount: 0,
          urgency: decision.strategy.postingStrategy.urgency,
          reasoning: `Real-Time Intelligence: ${technicallyValid.reason}. ${technicallyValid.recommendedAction}`,
          strategy: decision.strategy.mode,
          timeSpacing: Math.max(30, waitTime), // At least 30 minutes
          executionPlan: []
        };
      }
      
      console.log(`✅ Real-Time Intelligence approved posting: ${technicallyValid.reason}`);
      console.log(`📊 Remaining capacity: ${technicallyValid.remainingCapacity} posts`);
      console.log(`💡 ${technicallyValid.recommendedAction}`);

      console.log('👑 SUPREME AI DECISION:');
      console.log(`   🧠 Strategy: ${decision.strategy.mode}`);
      console.log(`   📝 Posts: ${decision.strategy.postingStrategy.postCount}`);
      console.log(`   ⚡ Urgency: ${(decision.strategy.postingStrategy.urgency * 100).toFixed(0)}%`);
      console.log(`   🕐 Spacing: ${decision.strategy.postingStrategy.timeSpacing} minutes`);
      console.log(`   💭 Reasoning: ${decision.reasoning}`);

      return {
        shouldPost: decision.shouldPost,
        postCount: decision.strategy.postingStrategy.postCount,
        urgency: decision.strategy.postingStrategy.urgency,
        reasoning: decision.reasoning,
        strategy: decision.strategy.mode,
        timeSpacing: decision.strategy.postingStrategy.timeSpacing,
        executionPlan: decision.executionPlan
      };

    } catch (error) {
      console.error('❌ Supreme AI decision failed:', error);
      
      // Fallback: Conservative AI decision
      return {
        shouldPost: true,
        postCount: 1,
        urgency: 0.5,
        reasoning: 'Fallback decision: Single quality post to maintain presence',
        strategy: 'conservative_fallback',
        timeSpacing: 180,
        executionPlan: []
      };
    }
  }

  /**
   * 🌍 ANALYZE WORLD STATE
   * Comprehensive analysis of everything happening
   */
  private async analyzeWorldState(): Promise<{
    breakingNews: any[];
    trendingTopics: any[];
    marketSentiment: string;
    competitorActivity: string;
    timeContext: string;
    opportunityScore: number;
  }> {
    console.log('🌍 Analyzing current world state...');

    const [news, trends] = await Promise.all([
      this.newsAgent.fetchHealthTechNews(20),
      this.trendsAgent.getTrendingHealthTopics()
    ]);

    // Filter for recent, high-impact news
    const breakingNews = news.filter(n => {
      const hoursAgo = (Date.now() - new Date(n.publishedAt).getTime()) / (1000 * 60 * 60);
      return hoursAgo <= 6; // Last 6 hours
    });

    // Analyze market sentiment
    const marketSentiment = this.analyzeMarketSentiment(news, trends);
    
    // Check competitor activity
    const competitorActivity = await this.checkCompetitorActivity();
    
    // Get time context
    const timeContext = this.getTimeContext();
    
    // Calculate opportunity score (0-1)
    const opportunityScore = this.calculateOpportunityScore({
      breakingNews,
      trends,
      marketSentiment,
      competitorActivity,
      timeContext
    });

    return {
      breakingNews,
      trendingTopics: trends,
      marketSentiment,
      competitorActivity,
      timeContext,
      opportunityScore
    };
  }

  /**
   * 🚨 DETECT EMERGENCY LEVEL
   * Determines if situation requires emergency posting burst
   */
  private async detectEmergencyLevel(worldState: any): Promise<number> {
    let emergencyLevel = 0;

    // Check for major breaking news
    const majorNews = worldState.breakingNews.filter(n => 
      n.title.toLowerCase().includes('breakthrough') ||
      n.title.toLowerCase().includes('revolution') ||
      n.title.toLowerCase().includes('announces') ||
      n.title.toLowerCase().includes('approves') ||
      n.title.toLowerCase().includes('launches')
    );

    if (majorNews.length > 0) {
      emergencyLevel = Math.max(emergencyLevel, 0.7);
      console.log(`📰 Major news detected: ${majorNews.length} stories`);
    }

    // Check for viral trending topics
    const viralTopics = worldState.trendingTopics.filter(t => t.score > 0.8);
    if (viralTopics.length > 2) {
      emergencyLevel = Math.max(emergencyLevel, 0.8);
      console.log(`🔥 Viral topics detected: ${viralTopics.length} trending`);
    }

    // Check for competitor silence (opportunity)
    if (worldState.competitorActivity === 'quiet' && worldState.opportunityScore > 0.7) {
      emergencyLevel = Math.max(emergencyLevel, 0.6);
      console.log('🎯 Competitor silence + high opportunity = emergency posting chance');
    }

    // Check for peak engagement windows
    if (worldState.timeContext === 'peak_engagement' && worldState.opportunityScore > 0.8) {
      emergencyLevel = Math.max(emergencyLevel, 0.9);
      console.log('⚡ Peak engagement window + major opportunity = MAXIMUM EMERGENCY');
    }

    console.log(`🚨 Emergency level: ${(emergencyLevel * 100).toFixed(0)}%`);
    return emergencyLevel;
  }

  /**
   * 🚨 VALIDATE TECHNICAL LIMITS
   * Check ONLY real technical constraints using Real-Time Intelligence
   */
  private async validateTechnicalLimits(strategy: any): Promise<{
    canPost: boolean;
    reason: string;
    remainingCapacity: number;
    nextAvailableTime?: Date;
    recommendedAction: string;
  }> {
    console.log('🚨 Consulting Real-Time Limits Intelligence Agent...');

    try {
      // Get REAL current limits from intelligence agent
      const limits = await realTimeLimitsAgent.getCurrentLimits();
      
      console.log('📊 Current Real Limits:');
      console.log(`   🐦 Twitter: ${limits.twitter.canPost ? '✅' : '❌'} (${limits.twitter.dailyTweets.remaining}/${limits.twitter.dailyTweets.limit})`);
      console.log(`   🤖 OpenAI: ${limits.openai.canMakeRequest ? '✅' : '❌'} (${limits.openai.dailyRequests.remaining}/${limits.openai.dailyRequests.limit})`);
      console.log(`   📰 NewsAPI: ${limits.newsApi.canFetchNews ? '✅' : '❌'}`);
      console.log(`   🎯 System: ${limits.systemStatus.canPost ? 'CAN POST' : 'CANNOT POST'}`);

      // Check if we can post based on REAL data
      if (!limits.systemStatus.canPost) {
        const blockedReasons = limits.systemStatus.blockedActions.join(', ');
        const waitMinutes = Math.ceil((limits.systemStatus.nextAvailableAction.getTime() - Date.now()) / 60000);
        
        return {
          canPost: false,
          reason: `System blocked: ${blockedReasons}`,
          remainingCapacity: 0,
          nextAvailableTime: limits.systemStatus.nextAvailableAction,
          recommendedAction: `Wait ${waitMinutes} minutes until ${limits.systemStatus.nextAvailableAction.toLocaleTimeString()}`
        };
      }

      // Check Twitter specifically
      if (!limits.twitter.canPost) {
        return {
          canPost: false,
          reason: `Twitter API limit: ${limits.twitter.isLocked ? 'Account locked' : 'Rate limited'}`,
          remainingCapacity: limits.twitter.dailyTweets.remaining,
          nextAvailableTime: limits.twitter.nextSafePostTime,
          recommendedAction: `Wait ${limits.twitter.recommendedWaitTime} minutes for Twitter limits to reset`
        };
      }

      // Check OpenAI (needed for content generation)
      if (!limits.openai.canMakeRequest) {
        return {
          canPost: false,
          reason: `OpenAI limit reached: ${limits.openai.dailyRequests.used}/${limits.openai.dailyRequests.limit} requests`,
          remainingCapacity: limits.openai.dailyRequests.remaining,
          recommendedAction: 'Wait for OpenAI daily limits to reset or use cached content'
        };
      }

      // Check if proposed posting would exceed safe limits
      const proposedTotal = limits.twitter.dailyTweets.used + strategy.postingStrategy.postCount;
      if (proposedTotal > limits.twitter.dailyTweets.limit) {
        return {
          canPost: false,
          reason: `Would exceed daily Twitter limit: ${proposedTotal} > ${limits.twitter.dailyTweets.limit}`,
          remainingCapacity: limits.twitter.dailyTweets.remaining,
          recommendedAction: `Reduce to ${limits.twitter.dailyTweets.remaining} posts or wait until tomorrow`
        };
      }

      // All good - we can post!
      const capacity = Math.min(
        limits.twitter.dailyTweets.remaining,
        limits.twitter.shortTermLimits.tweets15min.remaining,
        limits.openai.dailyRequests.remaining
      );

      return {
        canPost: true,
        reason: `All systems operational (confidence: ${(limits.systemStatus.confidence * 100).toFixed(0)}%)`,
        remainingCapacity: capacity,
        recommendedAction: `Can safely post ${capacity} more times today`
      };

    } catch (error) {
      console.error('❌ Real-Time Limits check failed:', error);
      
      // Emergency fallback to conservative approach
      return {
        canPost: false,
        reason: 'Unable to verify current limits - being conservative',
        remainingCapacity: 0,
        recommendedAction: 'Wait 30 minutes and try again'
      };
    }
  }

  /**
   * 🎯 EXECUTE SUPREME DECISION
   * Execute whatever the AI decided - no questions asked
   */
  async executeSupremeDecision(decision: any): Promise<{
    success: boolean;
    executedPosts: number;
    results: any[];
  }> {
    console.log(`🚀 EXECUTING SUPREME AI DECISION: ${decision.strategy}`);
    console.log(`📝 Posting ${decision.postCount} pieces of content`);

    if (!decision.shouldPost || decision.postCount === 0) {
      console.log('🤔 Supreme AI decided not to post right now');
      return { success: true, executedPosts: 0, results: [] };
    }

    try {
      // Execute the strategy exactly as AI planned
      const executionResult = await this.supremeOrchestrator.executeSupremeStrategy(
        { 
          mode: decision.strategy,
          postingStrategy: {
            postCount: decision.postCount,
            timeSpacing: decision.timeSpacing,
            urgency: decision.urgency,
            frequency: this.getFrequencyFromUrgency(decision.urgency)
          }
        } as any,
        decision.executionPlan
      );

      // Log the execution for learning
      await this.logSupremeDecision(decision, executionResult);

      console.log(`✅ Supreme AI execution complete: ${executionResult.executedPosts} posts`);
      return executionResult;

    } catch (error) {
      console.error('❌ Supreme decision execution failed:', error);
      return { success: false, executedPosts: 0, results: [] };
    }
  }

  // Helper methods
  private analyzeMarketSentiment(news: any[], trends: any[]): string {
    // Analyze overall sentiment from news and trends
    const positiveKeywords = ['breakthrough', 'innovation', 'success', 'growth', 'approval'];
    const negativeKeywords = ['failure', 'concern', 'risk', 'decline', 'warning'];
    
    const allText = [...news.map(n => n.title), ...trends.map(t => t.name)].join(' ').toLowerCase();
    
    const positiveScore = positiveKeywords.reduce((score, word) => 
      score + (allText.includes(word) ? 1 : 0), 0);
    const negativeScore = negativeKeywords.reduce((score, word) => 
      score + (allText.includes(word) ? 1 : 0), 0);
    
    if (positiveScore > negativeScore) return 'positive';
    if (negativeScore > positiveScore) return 'negative';
    return 'neutral';
  }

  private async checkCompetitorActivity(): Promise<string> {
    // In real implementation, would check competitor posting frequency
    // For now, simulate based on time of day
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) return 'active';
    if (hour >= 18 && hour <= 21) return 'peak';
    return 'quiet';
  }

  private getTimeContext(): string {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    
    // Peak engagement windows
    if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16) || (hour >= 19 && hour <= 21)) {
      return 'peak_engagement';
    }
    
    // Weekend different patterns
    if (day === 0 || day === 6) {
      return 'weekend';
    }
    
    // Business hours
    if (hour >= 9 && hour <= 17) {
      return 'business_hours';
    }
    
    return 'off_hours';
  }

  private calculateOpportunityScore(state: any): number {
    let score = 0.3; // Base score
    
    // Breaking news boosts opportunity (with null safety)
    score += (state.breakingNews?.length || 0) * 0.15;
    
    // Trending topics boost (with null safety)
    const trendingTopics = state.trendingTopics || [];
    score += trendingTopics.filter((t: any) => t?.score > 0.7).length * 0.1;
    
    // Market sentiment factor
    if (state.marketSentiment === 'positive') score += 0.2;
    if (state.marketSentiment === 'negative') score += 0.1; // Contrarian opportunity
    
    // Time context factor
    if (state.timeContext === 'peak_engagement') score += 0.3;
    if (state.timeContext === 'business_hours') score += 0.1;
    
    // Competitor activity factor
    if (state.competitorActivity === 'quiet') score += 0.2;
    
    return Math.min(score, 1.0);
  }

  private async checkTwitterAPILimits(): Promise<{ canPost: boolean; reason: string }> {
    // In real implementation, would check actual Twitter API limits
    // For now, assume we can post unless we hit the hard daily limit
    return { canPost: true, reason: 'API limits OK' };
  }

  private async getDailyPostCount(): Promise<number> {
    try {
      // Use the supabase service to get recent tweets
      const recentTweets = await supabaseClient.getRecentTweets(1); // Last 1 day
      return recentTweets.length;
    } catch (error) {
      console.error('❌ Failed to get daily post count:', error);
      return 0;
    }
  }

  private getFrequencyFromUrgency(urgency: number): string {
    if (urgency > 0.8) return 'immediate';
    if (urgency > 0.6) return 'burst';
    if (urgency > 0.4) return 'steady';
    if (urgency > 0.2) return 'opportunistic';
    return 'conservative';
  }

  private async logSupremeDecision(decision: any, result: any): Promise<void> {
    try {
      // For now, just log to console - can add proper database logging later
      console.log('🗂️ Supreme Decision Log:', {
        decision_type: 'supreme_posting',
        strategy: decision.strategy,
        post_count: decision.postCount,
        urgency: decision.urgency,
        reasoning: decision.reasoning,
        executed_posts: result.executedPosts,
        success: result.success,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to log supreme decision:', error);
    }
  }
}

export const dynamicPostingController = new DynamicPostingController(); 
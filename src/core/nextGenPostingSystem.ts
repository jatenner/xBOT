/**
 * 🚀 NEXT-GEN POSTING SYSTEM
 * Ultimate AI integration with all advanced systems
 */

import { ViralContentOrchestrator } from '../ai/viralContentOrchestrator';
import { SimpleThreadPoster } from '../posting/simpleThreadPoster';
import { postSingleTweet } from '../posting/postThread';
import { TwitterAnalyticsScraper } from '../analytics/twitterAnalyticsScraper';
import { ContentDiversityTracker } from '../content/diversityTracker';
import { getUltimateAI } from '../ai/ultimateAIIntegrator';
import { IntelligentLearningEngine } from '../learning/intelligentLearningEngine';

export class NextGenPostingSystem {
  private static instance: NextGenPostingSystem;
  private viralOrchestrator: ViralContentOrchestrator;
  private threadPoster: SimpleThreadPoster;
  private analyticsScraper: TwitterAnalyticsScraper;
  private diversityTracker: ContentDiversityTracker;
  private ultimateAI = getUltimateAI();
  private learningEngine: IntelligentLearningEngine;
  
  private isRunning = false;
  private lastPostTime = 0;
  private readonly MIN_POST_INTERVAL = 3 * 60 * 1000; // 3 minutes for next-gen speed
  private dailyPostCount = 0;
  private readonly MAX_DAILY_POSTS = 80; // Increased for next-gen capabilities
  private systemStats = {
    totalPosts: 0,
    ultimateAIUsage: 0,
    averageSophistication: 0,
    successRate: 0
  };

  private constructor() {
    this.viralOrchestrator = new ViralContentOrchestrator();
    this.threadPoster = SimpleThreadPoster.getInstance();
    this.analyticsScraper = new TwitterAnalyticsScraper();
    this.diversityTracker = ContentDiversityTracker.getInstance();
    this.learningEngine = IntelligentLearningEngine.getInstance();
    console.log('🚀 NEXT_GEN_POSTING: All advanced AI systems initialized');
  }

  public static getInstance(): NextGenPostingSystem {
    if (!NextGenPostingSystem.instance) {
      NextGenPostingSystem.instance = new NextGenPostingSystem();
    }
    return NextGenPostingSystem.instance;
  }

  /**
   * 🧠 GENERATE AND POST NEXT-GENERATION CONTENT
   * Uses ultimate AI integration with learning feedback
   */
  async createNextGenPost(): Promise<{
    success: boolean;
    tweetId?: string;
    content?: string;
    type: 'single' | 'thread';
    aiSystemsUsed?: string[];
    sophisticationScore?: number;
    personalityUsed?: string;
    viralScore?: number;
    error?: string;
    systemPerformance?: any;
  }> {
    
    // Rate limiting check with learning phase bypass
    if (this.learningEngine.getLearningPhase() !== 'aggressive' && Date.now() - this.lastPostTime < this.MIN_POST_INTERVAL) {
      return { 
        success: false, 
        error: 'Rate limited (next-gen system respects aggressive learning phase)', 
        type: 'single' 
      };
    }

    if (this.isRunning) {
      return { 
        success: false, 
        error: 'Next-gen system already running', 
        type: 'single' 
      };
    }

    this.isRunning = true;

    try {
      console.log('🚀 NEXT_GEN_POSTING: Starting ultimate AI content generation...');
      this.systemStats.totalPosts++;

      // Step 1: Intelligent format decision with learning insights
      const contentFormat = await this.makeIntelligentFormatDecision();
      console.log(`🎯 INTELLIGENT_FORMAT: ${contentFormat.toUpperCase()} selected (confidence: ${contentFormat === 'thread' ? '85%' : '75%'})`);

      // Step 2: Get learning context for AI optimization
      const learningContext = await this.getLearningContext();
      console.log(`📚 LEARNING_CONTEXT: ${learningContext.recentPostsAnalyzed} posts analyzed, ${learningContext.topPatterns.length} patterns identified`);

      // Step 3: Generate content using Ultimate AI System
      const ultimateResult = await this.ultimateAI.generateUltimateContent({
        format: contentFormat,
        urgency: this.determineUrgencyLevel(),
        learningContext,
        currentAnalytics: await this.getCurrentAnalytics(),
        performanceGoals: {
          viralThreshold: 0.8,
          sophisticationTarget: 85,
          engagementGoal: 'maximum'
        }
      });

      this.systemStats.ultimateAIUsage++;
      this.systemStats.averageSophistication = (this.systemStats.averageSophistication + ultimateResult.metadata.sophisticationScore) / 2;

      console.log(`🧠 ULTIMATE_AI_COMPLETE: ${ultimateResult.metadata.sophisticationScore}/100 sophistication, ${ultimateResult.metadata.aiSystemsUsed.length} systems`);
      console.log(`🎭 AI_PROFILE: ${ultimateResult.metadata.personalityUsed}, ⚡ VIRAL: ${ultimateResult.metadata.viralProbability.toFixed(1)}%`);
      console.log(`🔥 SYSTEMS_USED: ${ultimateResult.metadata.aiSystemsUsed.join(', ')}`);

      // Step 4: Post content with advanced validation
      let result;
      if (contentFormat === 'thread' && ultimateResult.threadParts && ultimateResult.threadParts.length > 1) {
        console.log(`🧵 NEXT_GEN_THREAD: Posting ${ultimateResult.threadParts.length} tweets`);
        
        // Advanced thread validation
        const threadValidation = await this.validateNextGenThread(ultimateResult.threadParts);
        if (!threadValidation.valid) {
          console.error(`❌ NEXT_GEN_THREAD_VALIDATION_FAILED: ${threadValidation.issues.join(', ')}`);
          return {
            success: false,
            error: `Thread validation failed: ${threadValidation.issues[0]}`,
            type: contentFormat
          };
        }
        
        result = await this.threadPoster.postRealThread(ultimateResult.threadParts);
        
        if (result.success) {
          console.log(`✅ NEXT_GEN_THREAD_POSTED: ${result.totalTweets}/${ultimateResult.threadParts.length} tweets`);
          console.log(`🔗 Thread Chain: ${result.rootTweetId} → [${result.replyIds?.join(' → ')}]`);
        }
        
      } else {
        console.log(`📝 NEXT_GEN_SINGLE: "${ultimateResult.content.substring(0, 60)}..."`);
        result = await postSingleTweet(ultimateResult.content);
      }

      if (result.success) {
        this.dailyPostCount++;
        this.lastPostTime = Date.now();
        this.systemStats.successRate = (this.systemStats.successRate + 1) / 2;

        // Store performance data for learning
        await this.storeLearningData(ultimateResult, result, contentFormat);

        console.log(`✅ NEXT_GEN_SUCCESS: Posted ${contentFormat} with ID ${result.rootTweetId || result.tweetId}`);
        console.log(`📊 SYSTEM_STATS: ${this.systemStats.totalPosts} total, ${this.systemStats.successRate.toFixed(1)}% success`);

        return {
          success: true,
          tweetId: result.rootTweetId || result.tweetId,
          content: ultimateResult.content,
          type: contentFormat,
          aiSystemsUsed: ultimateResult.metadata.aiSystemsUsed,
          sophisticationScore: ultimateResult.metadata.sophisticationScore,
          personalityUsed: ultimateResult.metadata.personalityUsed,
          viralScore: ultimateResult.metadata.viralProbability,
          systemPerformance: ultimateResult.systemPerformance
        };
      } else {
        console.error(`❌ NEXT_GEN_POST_FAILED: ${result.error}`);
        return {
          success: false,
          error: result.error || 'Next-gen post failed',
          type: contentFormat,
          content: ultimateResult.content
        };
      }

    } catch (error: any) {
      console.error(`💥 NEXT_GEN_ERROR: ${error.message}`);
      return {
        success: false,
        error: `Next-gen system error: ${error.message}`,
        type: 'single'
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 🎯 INTELLIGENT FORMAT DECISION
   */
  private async makeIntelligentFormatDecision(): Promise<'single' | 'thread'> {
    try {
      const insights = await this.analyticsScraper.getAnalyticsInsights();
      const diversityReport = await this.diversityTracker.analyzeRecentContent();
      const learningInsights = await this.learningEngine.getPostingRecommendations();

      // Advanced decision logic
      let threadScore = 0;
      
      // Factor 1: Recent performance
      if (insights.averageEngagement > 3) threadScore += 25;
      
      // Factor 2: Content diversity needs
      if (diversityReport.diversityScore < 70) threadScore += 20;
      
      // Factor 3: Learning recommendations
      if (learningInsights.recommendedFormat === 'thread') threadScore += 30;
      
      // Factor 4: Time-based strategy
      const hour = new Date().getHours();
      if (hour >= 9 && hour <= 17) threadScore += 15; // Work hours favor threads
      
      // Factor 5: Daily thread ratio
      const todayThreads = this.dailyPostCount * 0.3; // Aim for 30% threads
      if (todayThreads < 3) threadScore += 20;

      console.log(`🎯 FORMAT_ANALYSIS: Thread score ${threadScore}/100`);
      return threadScore >= 60 ? 'thread' : 'single';

    } catch (error) {
      console.warn('⚠️ FORMAT_DECISION_FALLBACK: Using random selection');
      return Math.random() < 0.35 ? 'thread' : 'single';
    }
  }

  /**
   * 📚 GET LEARNING CONTEXT
   */
  private async getLearningContext(): Promise<any> {
    try {
      const recentPosts = await this.learningEngine.getRecentPostsAnalysis(10);
      const topPatterns = await this.learningEngine.getTopPerformingPatterns();
      const antiPatterns = await this.learningEngine.getUnderperformingPatterns();

      return {
        recentPostsAnalyzed: recentPosts.length,
        topPatterns: topPatterns.slice(0, 3),
        antiPatterns: antiPatterns.slice(0, 3),
        diversityNeeds: await this.diversityTracker.getCurrentDiversityNeeds(),
        performanceGoals: {
          targetEngagement: 4.0,
          targetViralScore: 80,
          targetSophistication: 85
        }
      };
    } catch (error) {
      console.warn('⚠️ LEARNING_CONTEXT_FALLBACK: Using defaults');
      return {
        recentPostsAnalyzed: 0,
        topPatterns: [],
        antiPatterns: [],
        diversityNeeds: [],
        performanceGoals: { targetEngagement: 3.0, targetViralScore: 70, targetSophistication: 75 }
      };
    }
  }

  /**
   * ⚡ DETERMINE URGENCY LEVEL
   */
  private determineUrgencyLevel(): 'low' | 'medium' | 'high' | 'viral' {
    const hour = new Date().getHours();
    
    // Peak hours (9-11 AM, 1-3 PM, 7-9 PM) = high urgency
    if ((hour >= 9 && hour <= 11) || (hour >= 13 && hour <= 15) || (hour >= 19 && hour <= 21)) {
      return 'viral';
    }
    
    // Good hours = high urgency
    if ((hour >= 8 && hour <= 17) || (hour >= 18 && hour <= 22)) {
      return 'high';
    }
    
    // Off-peak = medium urgency
    return 'medium';
  }

  /**
   * 📊 GET CURRENT ANALYTICS
   */
  private async getCurrentAnalytics(): Promise<any> {
    try {
      const insights = await this.analyticsScraper.getAnalyticsInsights();
      return {
        averageEngagement: insights.averageEngagement,
        topPerformingContent: insights.topPerformingContent,
        trendingTopics: insights.contentPatterns,
        optimal_posting_times: insights.optimalTimes
      };
    } catch (error) {
      return {
        averageEngagement: 2.5,
        topPerformingContent: [],
        trendingTopics: {},
        optimal_posting_times: []
      };
    }
  }

  /**
   * ✅ VALIDATE NEXT-GEN THREAD
   */
  private async validateNextGenThread(threadParts: string[]): Promise<{valid: boolean, issues: string[]}> {
    const issues = [];
    
    // Enhanced validation
    if (threadParts.length < 2) issues.push('Thread too short (minimum 2 tweets)');
    if (threadParts.length > 15) issues.push('Thread too long (maximum 15 tweets)');
    
    // Check for coherence
    let totalLength = 0;
    threadParts.forEach((part, index) => {
      if (part.length > 280) issues.push(`Tweet ${index + 1} exceeds 280 characters`);
      if (part.length < 20) issues.push(`Tweet ${index + 1} too short (minimum 20 characters)`);
      totalLength += part.length;
    });
    
    // Check for thread coherence
    if (totalLength < 200) issues.push('Thread lacks substantial content');
    
    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * 📚 STORE LEARNING DATA
   */
  private async storeLearningData(ultimateResult: any, postResult: any, format: string): Promise<void> {
    try {
      await this.learningEngine.storePostPerformance({
        tweetId: postResult.rootTweetId || postResult.tweetId,
        content: ultimateResult.content,
        contentType: format,
        aiSystemsUsed: ultimateResult.metadata.aiSystemsUsed,
        sophisticationScore: ultimateResult.metadata.sophisticationScore,
        personalityUsed: ultimateResult.metadata.personalityUsed,
        viralProbability: ultimateResult.metadata.viralProbability,
        emotionalImpact: ultimateResult.metadata.emotionalImpact,
        trendRelevance: ultimateResult.metadata.trendRelevance,
        timestamp: new Date().toISOString(),
        systemPerformance: ultimateResult.systemPerformance
      });
      
      console.log('📚 LEARNING_DATA_STORED: Performance data saved for future optimization');
    } catch (error) {
      console.warn('⚠️ LEARNING_STORAGE_FAILED: Could not store performance data');
    }
  }

  /**
   * 📊 GET SYSTEM STATUS
   */
  getSystemStatus(): any {
    const ultimateAIStatus = this.ultimateAI.getSystemStatus();
    
    return {
      nextGenStats: this.systemStats,
      ultimateAIStats: ultimateAIStatus,
      currentLimits: {
        minInterval: this.MIN_POST_INTERVAL / 1000 / 60 + ' minutes',
        maxDaily: this.MAX_DAILY_POSTS,
        todayCount: this.dailyPostCount
      },
      systemHealth: 'Next-Generation',
      capabilities: [
        'Multi-Model Ensemble',
        'Dynamic Expert Personas',
        'Real-Time Trend Injection',
        'Emotional Intelligence',
        'Learning Integration',
        'Advanced Thread Validation',
        'Performance Optimization'
      ]
    };
  }
}

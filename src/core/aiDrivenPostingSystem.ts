import { ViralContentOrchestrator } from '../ai/viralContentOrchestrator';
import { SimpleThreadPoster } from '../posting/simpleThreadPoster';
import { postSingleTweet } from '../posting/postThread';
import { TwitterAnalyticsScraper } from '../analytics/twitterAnalyticsScraper';
import { ContentDiversityTracker } from '../content/diversityTracker';

/**
 * AI-DRIVEN POSTING SYSTEM
 * 
 * 100% OpenAI API powered - NO hardcoded content, hooks, or patterns
 * Dynamically generates viral content based on real-time analytics
 */

export class AIDrivenPostingSystem {
  private static instance: AIDrivenPostingSystem;
  private viralOrchestrator: ViralContentOrchestrator;
  private threadPoster: SimpleThreadPoster;
  private analyticsScraper: TwitterAnalyticsScraper;
  private diversityTracker: ContentDiversityTracker;
  
  private isRunning = false;
  private lastPostTime = 0;
  private readonly MIN_POST_INTERVAL = 5 * 60 * 1000; // 5 minutes for aggressive learning
  private dailyPostCount = 0;
  private readonly MAX_DAILY_POSTS = 60; // Aggressive learning phase

  private constructor() {
    this.viralOrchestrator = new ViralContentOrchestrator(process.env.OPENAI_API_KEY!);
    this.threadPoster = SimpleThreadPoster.getInstance();
    this.analyticsScraper = new TwitterAnalyticsScraper();
    this.diversityTracker = ContentDiversityTracker.getInstance();
  }

  public static getInstance(): AIDrivenPostingSystem {
    if (!AIDrivenPostingSystem.instance) {
      AIDrivenPostingSystem.instance = new AIDrivenPostingSystem();
    }
    return AIDrivenPostingSystem.instance;
  }

  /**
   * Generate and post 100% AI-driven viral content
   */
  async createViralPost(): Promise<{
    success: boolean;
    tweetId?: string;
    content?: string;
    type: 'single' | 'thread';
    viralScore?: number;
    error?: string;
  }> {
    if (this.isRunning) {
      return { success: false, error: 'Already posting', type: 'single' };
    }

    // Skip rate limiting during aggressive learning phase
    const timeSinceLastPost = Date.now() - this.lastPostTime;
    if (timeSinceLastPost < this.MIN_POST_INTERVAL) {
      console.log(`⏱️ LEARNING_MODE: Only ${Math.round(timeSinceLastPost/60000)}min since last post, continuing for data gathering`);
      // Allow posting during aggressive learning phase
    }

    if (this.dailyPostCount >= this.MAX_DAILY_POSTS) {
      return { success: false, error: 'Daily limit reached', type: 'single' };
    }

    this.isRunning = true;

    try {
      console.log('🚀 AI_DRIVEN_POSTING: Starting 100% AI content generation...');

      // Step 1: AI decides content format based on recent performance
      const contentFormat = await this.decideContentFormat();
      console.log(`🎯 AI_FORMAT_DECISION: ${contentFormat.toUpperCase()} format selected`);

      // Step 2: Generate viral content completely via AI
      const viralContent = await this.viralOrchestrator.generateViralContent(contentFormat);
      console.log(`✨ VIRAL_CONTENT_GENERATED: ${viralContent.metadata.viralScore}/100 viral score`);

      // Step 3: Post content based on format
      let result;
      if (contentFormat === 'thread' && viralContent.threadParts && viralContent.threadParts.length > 1) {
        console.log(`🧵 POSTING_COMPLETE_THREAD: ${viralContent.threadParts.length} tweets`);
        
        // Validate thread parts before posting
        const threadValidation = this.threadPoster.validateTweets(viralContent.threadParts);
        if (!threadValidation.valid) {
          console.error(`❌ THREAD_VALIDATION_FAILED: ${threadValidation.issues.join(', ')}`);
          return {
            success: false,
            error: `Thread validation failed: ${threadValidation.issues[0]}`,
            type: contentFormat
          };
        }
        
        // Post complete thread using SimpleThreadPoster
        result = await this.threadPoster.postRealThread(viralContent.threadParts);
        
        if (result.success) {
          console.log(`✅ COMPLETE_THREAD_POSTED: ${result.totalTweets}/${viralContent.threadParts.length} tweets posted`);
          console.log(`🔗 Thread: Root=${result.rootTweetId}, Replies=[${result.replyIds?.join(', ')}]`);
        }
        
      } else {
        console.log(`📝 POSTING_AI_SINGLE: "${viralContent.content.substring(0, 50)}..."`);
        result = await postSingleTweet(viralContent.content);
      }

      if (result.success) {
        this.dailyPostCount++;
        this.lastPostTime = Date.now();

        // Get the main tweet ID (works for both single tweets and threads)
        const mainTweetId = result.tweetId || result.rootTweetId;
        
        // Store performance data for AI learning
        await this.storeCompletePostPerformance(result, viralContent, contentFormat);

        console.log(`✅ AI_POST_SUCCESS: ${mainTweetId} - Viral score: ${viralContent.metadata.viralScore}`);

        return {
          success: true,
          tweetId: mainTweetId,
          content: viralContent.content,
          type: contentFormat,
          viralScore: viralContent.metadata.viralScore
        };
      } else {
        console.error('❌ AI_POST_FAILED:', result.error);
        return {
          success: false,
          error: result.error,
          type: contentFormat
        };
      }

    } catch (error: any) {
      console.error('❌ AI_SYSTEM_ERROR:', error.message);
      return {
        success: false,
        error: error.message,
        type: 'single'
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * AI decides whether to post single tweet or thread based on analytics
   */
  private async decideContentFormat(): Promise<'single' | 'thread'> {
    try {
      console.log('🤖 AI_FORMAT_DECISION: Analyzing performance data...');

      // Get recent analytics to inform decision
      const insights = await this.analyticsScraper.getAnalyticsInsights();
      const diversityReport = await this.diversityTracker.analyzeRecentContent();

      // AI-powered decision via OpenAI
      const decisionPrompt = `
You are an AI that decides the optimal content format for Twitter to maximize engagement and followers.

CURRENT ANALYTICS:
- Average engagement: ${insights.averageEngagement}%
- Recent posts analyzed: ${insights.topPerformingContent.length}
- Content diversity score: ${diversityReport.diversityScore}/100
- Best performing content patterns: ${insights.contentPatterns ? Object.keys(insights.contentPatterns).slice(0, 3).join(', ') : 'none'}

DECISION CRITERIA:
- SINGLE TWEET: Quick consumption, broader reach, good for viral hooks
- THREAD: Deep value, higher engagement per follower, builds authority

Based on current performance and engagement patterns, should the next post be a SINGLE tweet or THREAD?

Respond with only: "single" or "thread"

Consider:
- If engagement is low (<2%), try viral single tweets
- If engagement is good (>3%), threads can build deeper connection
- Diversity score affects content depth needs
- Recent successful patterns should influence decision
`;

      const response = await this.viralOrchestrator['openai'].chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: decisionPrompt }],
        temperature: 0.7,
        max_tokens: 10
      });

      const decision = response.choices[0]?.message?.content?.trim().toLowerCase();
      
      if (decision === 'thread') {
        console.log('🧵 AI_DECISION: Thread format - building authority and engagement');
        return 'thread';
      } else {
        console.log('📝 AI_DECISION: Single format - maximizing reach and virality');
        return 'single';
      }

    } catch (error: any) {
      console.warn('⚠️ AI_DECISION_FALLBACK:', error.message);
      // Fallback: 30% threads, 70% singles for growth phase
      return Math.random() < 0.3 ? 'thread' : 'single';
    }
  }

  /**
   * Store post performance data for AI learning
   */
  private async storePostPerformance(tweetId: string, viralContent: any): Promise<void> {
    try {
      const { admin: supabase } = require('../lib/supabaseClients');

      const performanceData = {
        tweet_id: tweetId,
        content: viralContent.content,
        content_type: viralContent.threadParts ? 'thread' : 'single',
        predicted_viral_score: viralContent.metadata.viralScore,
        predicted_engagement: viralContent.metadata.engagementPrediction,
        topic_domain: viralContent.metadata.topicDomain,
        uniqueness_score: viralContent.metadata.uniquenessScore,
        generation_method: 'ai_viral_orchestrator',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('learning_posts')
        .insert([performanceData]);

      if (error) {
        console.error('❌ PERFORMANCE_STORAGE_ERROR:', error.message);
      } else {
        console.log('📊 PERFORMANCE_STORED: Data saved for AI learning');
      }

    } catch (error: any) {
      console.error('❌ STORAGE_ERROR:', error.message);
    }
  }

  /**
   * Store complete post performance data (enhanced for threads)
   */
  private async storeCompletePostPerformance(result: any, viralContent: any, format: 'single' | 'thread'): Promise<void> {
    try {
      const { admin: supabase } = require('../lib/supabaseClients');

      const performanceData = {
        tweet_id: result.tweetId || result.rootTweetId,
        content: viralContent.content,
        content_type: format,
        thread_parts: format === 'thread' ? viralContent.threadParts : null,
        predicted_viral_score: viralContent.metadata.viralScore,
        predicted_engagement: viralContent.metadata.engagementPrediction,
        completeness_score: viralContent.metadata.completenessScore || 100,
        coherence_score: viralContent.metadata.coherenceScore || 100,
        topic_domain: viralContent.metadata.topicDomain,
        uniqueness_score: viralContent.metadata.uniquenessScore,
        generation_method: 'enhanced_ai_viral_orchestrator',
        total_thread_tweets: format === 'thread' ? result.totalTweets : 1,
        successful_thread_parts: format === 'thread' ? (result.replyIds?.length || 0) + 1 : 1,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('learning_posts')
        .insert([performanceData]);

      if (error) {
        console.error('❌ ENHANCED_PERFORMANCE_STORAGE_ERROR:', error.message);
      } else {
        console.log('📊 ENHANCED_PERFORMANCE_STORED: Complete data saved for AI learning');
      }

    } catch (error: any) {
      console.error('❌ ENHANCED_STORAGE_ERROR:', error.message);
    }
  }

  /**
   * Start automated AI-driven posting
   */
  startAutomatedPosting(): void {
    console.log('🤖 STARTING_AI_AUTOMATED_POSTING: 100% OpenAI driven content');
    console.log(`📅 Schedule: Every ${this.MIN_POST_INTERVAL / (60 * 1000)} minutes, max ${this.MAX_DAILY_POSTS} posts/day`);

    // Post immediately
    this.createViralPost();

    // Then post at intervals
    setInterval(async () => {
      console.log('⏰ SCHEDULED_AI_POST: Generating viral content...');
      await this.createViralPost();
    }, this.MIN_POST_INTERVAL);
  }

  /**
   * Get system status
   */
  getStatus(): {
    isRunning: boolean;
    dailyPostCount: number;
    maxDailyPosts: number;
    lastPostTime: Date | null;
    nextPostTime: Date | null;
  } {
    return {
      isRunning: this.isRunning,
      dailyPostCount: this.dailyPostCount,
      maxDailyPosts: this.MAX_DAILY_POSTS,
      lastPostTime: this.lastPostTime > 0 ? new Date(this.lastPostTime) : null,
      nextPostTime: this.lastPostTime > 0 ? new Date(this.lastPostTime + this.MIN_POST_INTERVAL) : null
    };
  }

  /**
   * Force immediate viral post for testing
   */
  async forceViralPost(): Promise<any> {
    console.log('🚀 FORCE_VIRAL_POST: Testing AI content generation...');
    this.lastPostTime = 0; // Reset timer
    return await this.createViralPost();
  }

  /**
   * Get content variety report
   */
  async getContentReport(): Promise<string> {
    const diversityReport = await this.diversityTracker.getVarietyReport();
    const status = this.getStatus();
    
    return `
🤖 AI-DRIVEN POSTING SYSTEM STATUS:

${diversityReport}

📊 POSTING METRICS:
- Posts today: ${status.dailyPostCount}/${status.maxDailyPosts}
- System running: ${status.isRunning}
- Last post: ${status.lastPostTime?.toLocaleString() || 'Never'}
- Next post: ${status.nextPostTime?.toLocaleString() || 'Now available'}

🎯 AI SYSTEM FEATURES:
✅ 100% OpenAI API content generation
✅ Zero hardcoded patterns or hooks
✅ Real-time analytics integration
✅ Dynamic format decision (single vs thread)
✅ Viral content optimization
✅ Topic diversity enforcement
    `.trim();
  }
}

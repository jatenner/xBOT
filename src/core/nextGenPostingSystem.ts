/**
 * 🚀 NEXT-GEN POSTING SYSTEM (FIXED)
 * Ultimate AI integration with all advanced systems
 */

import { ViralContentOrchestrator } from '../ai/viralContentOrchestrator';
import { SimpleThreadPoster } from '../posting/simpleThreadPoster';
import { postSingleTweet } from '../posting/postThread';
import { TwitterAnalyticsScraper } from '../analytics/twitterAnalyticsScraper';
import { ContentDiversityTracker } from '../content/diversityTracker';
import { getUltimateAI } from '../ai/ultimateAIIntegrator';

export class NextGenPostingSystem {
  private static instance: NextGenPostingSystem;
  private viralOrchestrator: ViralContentOrchestrator;
  private threadPoster: SimpleThreadPoster;
  private analyticsScraper: TwitterAnalyticsScraper;
  private diversityTracker: ContentDiversityTracker;
  private ultimateAI = getUltimateAI();
  
  private isRunning = false;
  private lastPostTime = 0;
  private readonly MIN_POST_INTERVAL = 3 * 60 * 1000; // 3 minutes for next-gen speed
  private dailyPostCount = 0;
  private readonly MAX_DAILY_POSTS = 80; // Increased for next-gen capabilities

  private constructor() {
    this.viralOrchestrator = new ViralContentOrchestrator(process.env.OPENAI_API_KEY!);
    this.threadPoster = SimpleThreadPoster.getInstance();
    this.analyticsScraper = new TwitterAnalyticsScraper();
    this.diversityTracker = ContentDiversityTracker.getInstance();
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
  }> {
    
    // Rate limiting check
    if (Date.now() - this.lastPostTime < this.MIN_POST_INTERVAL) {
      return { 
        success: false, 
        error: 'Rate limited (next-gen system)', 
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

      // Step 1: Intelligent format decision
      const contentFormat = Math.random() < 0.35 ? 'thread' : 'single';
      console.log(`🎯 FORMAT_SELECTED: ${contentFormat.toUpperCase()}`);

      // Step 2: Generate content using Ultimate AI System
      const ultimateResult = await this.ultimateAI.generateUltimateContent({
        format: contentFormat,
        urgency: 'high',
        performanceGoals: {
          viralThreshold: 0.8,
          sophisticationTarget: 85,
          engagementGoal: 'maximum'
        }
      });

      console.log(`🧠 ULTIMATE_AI_COMPLETE: ${ultimateResult.metadata.sophisticationScore}/100 sophistication`);
      console.log(`🎭 AI_PROFILE: ${ultimateResult.metadata.personalityUsed}`);
      console.log(`🔥 SYSTEMS_USED: ${ultimateResult.metadata.aiSystemsUsed.join(', ')}`);

      // Step 3: Post content with validation
      let result;
      if (contentFormat === 'thread' && ultimateResult.threadParts && ultimateResult.threadParts.length > 1) {
        console.log(`🧵 NEXT_GEN_THREAD: Posting ${ultimateResult.threadParts.length} tweets`);
        
        // Validate thread
        if (ultimateResult.threadParts.length < 2 || ultimateResult.threadParts.length > 15) {
          console.error(`❌ THREAD_VALIDATION_FAILED: Invalid length ${ultimateResult.threadParts.length}`);
          return {
            success: false,
            error: 'Thread validation failed',
            type: contentFormat
          };
        }
        
        result = await this.threadPoster.postRealThread(ultimateResult.threadParts);
        
        if (result.success) {
          console.log(`✅ NEXT_GEN_THREAD_POSTED: ${result.totalTweets} tweets`);
        }
        
      } else {
        console.log(`📝 NEXT_GEN_SINGLE: "${ultimateResult.content.substring(0, 60)}..."`);
        result = await postSingleTweet(ultimateResult.content);
      }

      if (result.success) {
        this.dailyPostCount++;
        this.lastPostTime = Date.now();

        console.log(`✅ NEXT_GEN_SUCCESS: Posted ${contentFormat} with ID ${result.rootTweetId || result.tweetId}`);

        return {
          success: true,
          tweetId: result.rootTweetId || result.tweetId,
          content: ultimateResult.content,
          type: contentFormat,
          aiSystemsUsed: ultimateResult.metadata.aiSystemsUsed,
          sophisticationScore: ultimateResult.metadata.sophisticationScore,
          personalityUsed: ultimateResult.metadata.personalityUsed,
          viralScore: ultimateResult.metadata.viralProbability
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
   * 📊 GET SYSTEM STATUS
   */
  getSystemStatus(): any {
    return {
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
        'Advanced Validation'
      ]
    };
  }
}

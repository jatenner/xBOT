import * as cron from 'node-cron';
import { AdaptivePostingScheduler } from '../intelligence/adaptivePostingScheduler';
import { TweetPerformanceTracker } from '../intelligence/tweetPerformanceTracker';
import { IntelligentLearningEngine } from '../intelligence/intelligentLearningEngine';
import { FollowerGrowthOptimizer } from '../intelligence/followerGrowthOptimizer';
import { logInfo, logWarn } from '../utils/intelligentLogging';

export class AutonomousPostingEngine {
  private static instance: AutonomousPostingEngine;
  private isRunning = false;
  private scheduler: AdaptivePostingScheduler;
  private intelligentTimerInterval: NodeJS.Timeout | null = null;
  private lastPostAttempt = 0;
  private isPosting = false;
  private emergencyStopUntil = 0;
  private consecutiveFailures = 0;
  private browserPoster: any = null;
  private performanceTracker: TweetPerformanceTracker;
  private learningEngine: IntelligentLearningEngine;
  private followerOptimizer: FollowerGrowthOptimizer;
  private currentFollowerCount: number = 0;

  private constructor() {
    this.scheduler = AdaptivePostingScheduler.getInstance();
    this.performanceTracker = TweetPerformanceTracker.getInstance();
    this.learningEngine = IntelligentLearningEngine.getInstance();
    this.followerOptimizer = FollowerGrowthOptimizer.getInstance();
  }

  public static getInstance(): AutonomousPostingEngine {
    if (!AutonomousPostingEngine.instance) {
      AutonomousPostingEngine.instance = new AutonomousPostingEngine();
    }
    return AutonomousPostingEngine.instance;
  }

  public async initialize(): Promise<void> {
    try {
      console.log('🚀 Initializing Autonomous Posting Engine...');

      // Initialize browser poster (Playwright-based)
      try {
        const { AutonomousTwitterPoster } = await import('../agents/autonomousTwitterPoster');
        this.browserPoster = AutonomousTwitterPoster.getInstance();
        await this.browserPoster.initialize();
        console.log('✅ Browser poster initialized');
      } catch (error: any) {
        console.warn('⚠️ Browser poster initialization failed, will initialize on first use:', error.message);
        // Don't throw - we can initialize the browser poster later when needed
      }
      
      // Initialize learning systems
      console.log('🧠 Initializing learning and performance tracking systems...');
      
      // Initialize learning engine
      await this.learningEngine.initialize();
      console.log('✅ Intelligent Learning Engine initialized');
      
      // Initialize follower growth optimizer
      await this.followerOptimizer.initialize();
      console.log('🎯 Follower Growth Optimizer initialized - ready for viral content!');
      
      // Start performance tracking
      await this.performanceTracker.schedulePerformanceTracking();
      console.log('✅ Automated performance tracking started');
      
      // Get baseline follower count
      this.currentFollowerCount = await this.performanceTracker.getCurrentFollowerCount();
      console.log(`📊 Current follower count: ${this.currentFollowerCount}`);
      
      // Start intelligent adaptive posting schedule
      this.startAutonomousSchedule();
      
      console.log('✅ Intelligent Adaptive Posting Engine ready');
      console.log('🧠 Features: trending analysis, engagement windows, breaking news detection, performance learning');
      console.log('🎯 Posting frequency: adaptive based on opportunities (5min-6hrs)');
    } catch (error: any) {
      console.error('❌ Failed to initialize Autonomous Posting Engine:', error.message);
      throw error;
    }
  }

  private startAutonomousSchedule(): void {
    if (this.isRunning) {
      console.log('⚠️ Autonomous schedule already running');
      return;
    }

    console.log('🧠 Starting intelligent adaptive posting schedule...');
    
    // EMERGENCY: Check every 30 minutes instead of 5 to reduce spam
    this.intelligentTimerInterval = setInterval(async () => {
      try {
        // Check for emergency stop flags in Redis
        const emergencyCheck = await this.checkEmergencyFlags();
        if (emergencyCheck.stopped) {
          console.log(`🚨 EMERGENCY STOP ACTIVE: ${emergencyCheck.reason}`);
          return;
        }

        const opportunity = await this.scheduler.shouldPostNow();
        
        const dynamicThreshold = await this.calculateDynamicThreshold();
        
        if (opportunity.score > dynamicThreshold) {
          // EMERGENCY STOP: If we're in emergency stop mode
          if (Date.now() < this.emergencyStopUntil) {
            const remainingMinutes = Math.round((this.emergencyStopUntil - Date.now()) / 60000);
            logInfo(`🚨 EMERGENCY STOP: System paused for ${remainingMinutes} more minutes due to failures`);
            return;
          }

          // EMERGENCY Rate limiting: minimum 5 minutes between post attempts
          const timeSinceLastAttempt = Date.now() - this.lastPostAttempt;
          if (timeSinceLastAttempt < 300000) { // 5 minutes instead of 2
            logInfo(`⏳ EMERGENCY Rate limiting: Last attempt ${Math.round(timeSinceLastAttempt/1000)}s ago, waiting ${Math.round((300000-timeSinceLastAttempt)/1000)}s more...`);
            return;
          }

          // Concurrency check: don't start new post if one is in progress
          if (this.isPosting) {
            console.log(`⚠️ Post already in progress, skipping this opportunity`);
            return;
          }

          console.log(`🎯 Posting opportunity detected! Score: ${Math.round(opportunity.score)}/100 (threshold: ${dynamicThreshold})`);
          console.log(`📝 Reason: ${opportunity.reason}`);
          console.log(`⚡ Urgency: ${opportunity.urgency}`);
          
          // Execute intelligent post with concurrency control
          this.lastPostAttempt = Date.now();
          this.isPosting = true;
          
          this.executeIntelligentPost(opportunity)
            .then((result) => {
              if (result.success) {
                this.consecutiveFailures = 0; // Reset failure count on success
              } else {
                this.handlePostFailure();
              }
            })
            .catch((error) => {
              console.error('❌ Intelligent post error:', error);
              this.handlePostFailure();
            })
            .finally(() => {
              this.isPosting = false;
            });
        } else {
          logInfo(`⏳ Waiting for better opportunity. Current score: ${Math.round(opportunity.score)}/100 (need: ${dynamicThreshold}) - ${opportunity.reason}`);
            }
          } catch (error) {
        console.error('❌ Error in intelligent posting analysis:', error);
      }
    }, 30 * 60 * 1000); // EMERGENCY: Check every 30 minutes instead of 5

    // FALLBACK: Still maintain basic schedule as safety net
    cron.schedule('0 */6 * * *', async () => {
      const opportunity = await this.scheduler.shouldPostNow();
      if (opportunity.score < 30) { // Only if no recent good opportunities
        console.log('🔄 Fallback posting: No recent opportunities detected');
        this.executePost().catch(console.error);
      }
    });

    // Initial intelligent check after 2 minutes
    setTimeout(async () => {
      const opportunity = await this.scheduler.shouldPostNow();
      console.log(`🚀 Initial posting analysis: ${Math.round(opportunity.score)}/100 - ${opportunity.reason}`);
      
      if (opportunity.score > 25) {
        this.executeIntelligentPost(opportunity).catch(console.error);
      }
    }, 2 * 60 * 1000);

    this.isRunning = true;
    console.log('✅ Intelligent adaptive posting system activated');
    console.log('🎯 Will analyze posting opportunities every 30 minutes');
  }

  /**
   * Check Redis for emergency stop flags
   */
  private async checkEmergencyFlags(): Promise<{ stopped: boolean; reason: string }> {
    try {
      const Redis = require('ioredis');
      const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
      
      if (!redisUrl) {
        return { stopped: false, reason: 'No Redis connection' };
      }
      
      const redis = new Redis(redisUrl, {
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 1,
      });
      
      const [emergencyStop, postingDisabled, viralDisabled] = await Promise.all([
        redis.get('xbot:emergency_stop'),
        redis.get('xbot:posting_disabled'),
        redis.get('xbot:viral_engine_disabled')
      ]);
      
      redis.disconnect();
      
      if (emergencyStop) {
        const stopUntil = parseInt(emergencyStop);
        if (Date.now() < stopUntil) {
          const remainingHours = Math.round((stopUntil - Date.now()) / (60 * 60 * 1000));
          return { stopped: true, reason: `Nuclear stop active for ${remainingHours} more hours` };
        }
      }
      
      if (postingDisabled === 'true') {
        return { stopped: true, reason: 'Posting manually disabled' };
      }
      
      if (viralDisabled === 'true') {
        return { stopped: true, reason: 'Viral engine manually disabled' };
      }
      
      return { stopped: false, reason: 'All systems go' };
      
    } catch (error) {
      console.warn('⚠️ Could not check emergency flags:', error.message);
      return { stopped: false, reason: 'Redis check failed' };
    }
  }

  /**
   * Handle post failure and implement emergency circuit breaker
   */
  private handlePostFailure(): void {
    this.consecutiveFailures++;
    console.warn(`⚠️ Post failure #${this.consecutiveFailures}`);
    
    if (this.consecutiveFailures >= 3) {
      // Trigger emergency stop for 30 minutes
      this.emergencyStopUntil = Date.now() + (30 * 60 * 1000);
      console.error(`🚨 EMERGENCY STOP: Too many failures (${this.consecutiveFailures}). Pausing for 30 minutes.`);
    }
  }

  public async executePost(): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      console.log('📝 Executing autonomous post...');

      // Ensure browser poster is available
      if (!this.browserPoster) {
        console.log('🔄 Initializing browser poster...');
        const { AutonomousTwitterPoster } = await import('../agents/autonomousTwitterPoster');
        this.browserPoster = AutonomousTwitterPoster.getInstance();
        await this.browserPoster.initialize();
      }

      // Generate content using AI
      let content = await this.generateContent();
      
      // Apply quality gate to basic content too
      const { ContentQualityGate } = await import('../lib/contentQualityGate');
      const qualityGate = ContentQualityGate.getInstance();
      const qualityCheck = qualityGate.validateContent(content);
      
      if (!qualityCheck.passed) {
        console.log(`❌ Basic content failed quality gate (${qualityCheck.score}/100)`);
        // Use high-quality fallback
        const examples = qualityGate.getQualityExamples();
        content = examples[Math.floor(Math.random() * examples.length)];
        console.log(`🔄 Using quality fallback content`);
      }
      
      console.log(`📝 Generated content: ${content.substring(0, 80)}...`);

      // Post to Twitter using browser automation (call the private method via reflection)
      const result = await (this.browserPoster as any).postSingle(content, { 
        forcePost: true
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Browser posting failed');
      }
      
      console.log(`✅ Posted tweet successfully: ${result.tweetId}`);

      // Store in database
      await this.storeInDatabase(content, result.tweetId || 'browser_' + Date.now());

      return { success: true, content };

    } catch (error: any) {
      console.error('❌ Failed to execute post:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute intelligent post with context-aware content
   */
  public async executeIntelligentPost(opportunity: any): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      console.log(`🧠 Executing VIRAL intelligent post (Score: ${Math.round(opportunity.score)}/100)`);
      console.log(`🎯 Context: ${opportunity.reason}`);

      // Use the new Social Content Operator for diverse, high-quality content
      console.log('🎯 SOCIAL_OPERATOR: Generating intelligent content');
      
      // Check engagement optimization before posting
      console.log('📊 ENGAGEMENT_MONITOR: Checking performance data and optimization strategies');
      const { getEngagementMonitor } = await import('../intelligence/engagementMonitor');
      const monitor = getEngagementMonitor();
      
      // Get optimization recommendations
      const optimization = await monitor.optimizeNextPost();
      console.log(`🎯 OPTIMIZATION: ${optimization.recommended_format} format, ${optimization.expected_improvement}% improvement expected`);

      // Generate content using our new Social Content Operator
      const content = await this.generateContent();
      
      // Post our Social Content Operator generated content directly
      console.log(`📝 Posting Social Operator content: "${content}"`);
      
      // Use direct browser posting to post our content
      const postResult = await this.postContentDirectly(content);
      
                  if (postResult.success && postResult.tweetId) {
              // Store in database for learning
              await this.storeInDatabase(content, postResult.tweetId);

              // Check for engagement alerts after posting
              try {
                const alerts = await monitor.checkEngagementAlerts();
                if (alerts.length > 0) {
                  console.log(`🚨 ENGAGEMENT_ALERTS: ${alerts.length} alerts detected`);
                  alerts.forEach(alert => {
                    console.log(`⚠️ ${alert.type.toUpperCase()}: ${alert.message} (${alert.severity})`);
                    console.log(`💡 ACTION: ${alert.recommended_action}`);
                  });
                }
              } catch (error: any) {
                console.warn('Engagement alert check failed:', error.message);
              }

              // Create result object matching expected interface
              const result = {
                success: true,
                rootTweetId: postResult.tweetId,
                tweetIds: [postResult.tweetId],
                qualityScore: 85 // Default since we generated with Social Content Operator
              };

              return result;
      } else {
        return { success: false, error: postResult.error || 'Posting failed' };
      }
    } catch (error: any) {
      console.error('❌ Failed to execute intelligent post:', error.message);
      return { success: false, error: error.message };
    }
  }

  private async generateContent(): Promise<string> {
    try {
      // Use the new Social Content Operator for diverse, high-quality content
      const { getSocialContentOperator } = await import('../ai/socialContentOperator');
      const operator = getSocialContentOperator();
      
      // Get recent posts to avoid repetition
      const recentPosts = await this.getRecentPostsForDiversity();
      
      // Brand notes for consistency
      const brandNotes = "Health & performance coach. Friendly, evidence-based, challenges conventional wisdom. Makes complex health topics accessible.";
      
      // Topic seeds (can be enhanced to pull from trending topics)
      const seeds = [
        "sleep optimization",
        "nutrition myths",
        "exercise efficiency",
        "stress management",
        "recovery tactics"
      ];
      
      // Generate diverse content pack
      const contentPack = await operator.generateContentPack(brandNotes, seeds, recentPosts);
      
      if (contentPack.singles && contentPack.singles.length > 0) {
        // Select best single from the pack
        const selectedContent = contentPack.singles[0];
        
        console.log(`🎯 Generated diverse content (quality: ${contentPack.metadata.qualityScores?.[0] || 'unknown'}, diversity: ${contentPack.metadata.diversityScore})`);
        console.log(`📊 Format mix: ${contentPack.metadata.formatMix?.join(', ')}`);
        
        return selectedContent;
      }
      
      console.warn('⚠️ Social Content Operator failed, falling back to emergency content');
      return this.getEmergencyDiverseContent();
      
    } catch (error: any) {
      console.error('❌ Social Content Operator failed:', error.message);
      return this.getEmergencyDiverseContent();
    }
  }

  /**
   * Get recent posts to prevent repetition
   */
  private async getRecentPostsForDiversity(): Promise<string[]> {
    try {
      // Try to get recent posts from database for diversity checking
      const { admin } = await import('../lib/supabaseClients');
      const { data, error } = await admin
        .from('learning_posts')
        .select('content')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (!error && data) {
        return data.map(post => post.content).filter(Boolean);
      }
    } catch (error) {
      console.warn('Could not fetch recent posts for diversity:', error);
    }
    
    return []; // Return empty array if can't fetch
  }

  /**
   * Emergency diverse content that still follows quality principles
   */
  private getEmergencyDiverseContent(): string {
    const emergencyContent = [
      // Controversial takes
      "Unpopular opinion: Most health advice is designed to sell you something, not help you.",
      
      // Personal stories
      "I tracked my energy for 30 days. Biggest insight? My afternoon crash came from morning coffee timing, not lunch.",
      
      // Questions for engagement
      "What's one health habit you know works but still don't do consistently?",
      
      // Myth busters
      "Breaking: '8 glasses of water' was never based on science. It came from a 1945 recommendation that included water from food.",
      
      // Shocking stats
      "70% of your immune system lives in your gut. That 'gut feeling' about food choices? Your microbiome talking.",
      
      // Analogies
      "Your metabolism is like a campfire. Protein is dry wood (burns hot), carbs are kindling (quick flame), fat is the log (steady burn).",
      
      // Quick tips
      "Cold shower hack: Start warm, end with 30 seconds cold. Boosts dopamine 250% and burns calories for hours.",
      
      // Industry insights
      "Most 'superfood' studies are funded by companies selling that exact superfood. Read the fine print."
    ];
    
    return emergencyContent[Math.floor(Math.random() * emergencyContent.length)];
  }

  /**
   * Post content directly using browser automation
   */
  private async postContentDirectly(content: string): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      // Import the TwitterPoster for direct posting
      const { postSingleTweet } = await import('../posting/postThread');
      
      // Post the content directly
      const result = await postSingleTweet(content);
      
      if (result.success && result.tweetId) {
        console.log(`✅ Posted directly: ${result.tweetId}`);
        return { success: true, tweetId: result.tweetId };
      } else {
        console.error(`❌ Direct posting failed: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error(`❌ Direct posting error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate dynamic posting threshold based on recent performance and goals
   */
  private async calculateDynamicThreshold(): Promise<number> {
    try {
      const recentMetrics = await this.getRecentPerformanceMetrics();
      
      // EMERGENCY: Base threshold starts at 70 to prevent spam loop
      let threshold = 70;
      
      // ADJUST BASED ON RECENT PERFORMANCE
      if (recentMetrics.avgEngagement > 5) {
        // Good engagement - can be more selective
        threshold += 10;
        console.log(`📈 Good engagement (${recentMetrics.avgEngagement}) - raising threshold +10`);
      } else if (recentMetrics.avgEngagement < 2) {
        // Poor engagement - be less selective
        threshold -= 10;
        console.log(`📉 Poor engagement (${recentMetrics.avgEngagement}) - lowering threshold -10`);
      }
      
      // ADJUST BASED ON POSTING FREQUENCY
      const timeSinceLastPost = await this.getTimeSinceLastPost();
      if (timeSinceLastPost > 480) { // 8+ hours
        threshold -= 15; // Post even with lower scores
        console.log(`⏰ Long gap (${Math.round(timeSinceLastPost/60)}h) - lowering threshold -15`);
      } else if (timeSinceLastPost < 120) { // Less than 2 hours
        threshold += 20; // Require much higher scores
        console.log(`🚫 Recent post (${Math.round(timeSinceLastPost)}m) - raising threshold +20`);
      }
      
      // ADJUST BASED ON FOLLOWER GROWTH GOAL
      const followerGrowth = await this.getRecentFollowerGrowth();
      if (followerGrowth < 1) { // Growing slowly
        threshold -= 5; // Post more to increase visibility
        console.log(`👥 Slow growth (${followerGrowth}/day) - lowering threshold -5`);
      }
      
      // ENSURE REASONABLE BOUNDS
      threshold = Math.max(25, Math.min(70, threshold));
      
      return threshold;
      
    } catch (error) {
      console.warn('Failed to calculate dynamic threshold, using default:', error);
      return 40; // Safe default
    }
  }

  private async getRecentPerformanceMetrics(): Promise<{ avgEngagement: number; posts: number }> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      
      const metrics = await dbManager.executeQuery('get_recent_metrics', async (client) => {
        const { data, error } = await client
          .from('tweets')
          .select('likes, retweets, replies, posted_at')
          .gte('posted_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
          .order('posted_at', { ascending: false });
        
        if (error) throw error;
        return data || [];
      });

      if (metrics.length === 0) return { avgEngagement: 0, posts: 0 };

      const totalEngagement = metrics.reduce((sum: number, tweet: any) => 
        sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0);
      
      return {
        avgEngagement: totalEngagement / metrics.length,
        posts: metrics.length
      };
    } catch (error) {
      return { avgEngagement: 0, posts: 0 };
    }
  }

  private async getTimeSinceLastPost(): Promise<number> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      
      const lastPost = await dbManager.executeQuery('get_last_post', async (client) => {
        const { data, error } = await client
          .from('tweets')
          .select('posted_at')
          .order('posted_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (error) throw error;
        return data;
      });

      if (!lastPost) return 999; // No previous posts

      const timeDiff = Date.now() - new Date(lastPost.posted_at).getTime();
      return Math.floor(timeDiff / (1000 * 60)); // Minutes
    } catch (error) {
      return 999;
    }
  }

  private async getRecentFollowerGrowth(): Promise<number> {
    try {
      // This would track follower count changes
      // For now, return estimated based on engagement
      const metrics = await this.getRecentPerformanceMetrics();
      return Math.max(0, metrics.avgEngagement / 5); // Rough estimate
    } catch (error) {
      return 0;
    }
  }

  /**
   * Regenerate content with specific quality feedback
   */
  private async regenerateWithFeedback(opportunity: any, improvements: string[]): Promise<string | string[]> {
    try {
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const feedbackPrompt = `The previous content failed quality checks. Please improve it based on this feedback:
${improvements.join('\n- ')}

REQUIREMENTS:
- Must be COMPLETE (no teasers, no "more details coming", no ellipsis endings)
- Provide specific, actionable value 
- Include reasoning or evidence
- Sound human and conversational
- Be clear and understandable
- If mentioning "thread below" or "dive into", actually provide the content

Create a high-quality health/wellness post that passes these requirements.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a quality content creator who writes complete, valuable posts like @naval, @ShaneAParrish, or @james_clear. Never write teasers or incomplete thoughts.'
          },
          {
            role: 'user',
            content: feedbackPrompt
          }
        ],
        max_tokens: 300,
        temperature: 0.6, // Lower for more focused content
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No content generated during regeneration');
      }

      console.log(`🔄 Regenerated content: ${content.substring(0, 100)}...`);
      return content;

    } catch (error) {
      console.error('Failed to regenerate content:', error);
      // Return a high-quality fallback
      return 'Your gut produces 90% of your serotonin. That "gut feeling" about decisions? It\'s literally your microbiome influencing your brain. Fiber feeds good bacteria, which improves both digestion and mood.';
    }
  }

  /**
   * Validate content quality before posting
   */
  private validateContentQuality(content: string | string[]): boolean {
    try {
      const contentToCheck = Array.isArray(content) ? content[0] : content;
      
      // Basic length checks
      if (contentToCheck.length < 30) {
        console.log(`❌ Content too short: ${contentToCheck.length} chars`);
        return false;
      }

      if (contentToCheck.length > 280) {
        console.log(`❌ Content too long: ${contentToCheck.length} chars`);
        return false;
      }

      // Check for incomplete content indicators
      const incompleteness = [
        /\.\.\.$/, // Ends with ellipsis
        /^Let's dive into/, // Generic hook without follow-through
        /Let's dive into/, // Any "Let's dive into" anywhere
        /Let's explore/, // Similar incomplete hooks
        /Here's what you need to know:$/, // Hook without actual info
        /Stay tuned for more$/, // Incomplete teaser
        /More details coming soon$/, // Incomplete teaser
        /💧.*dive into.*health/, // The specific hydration pattern
        /does more than quench.*dive into/, // Exact hydration post pattern
      ];

      for (const pattern of incompleteness) {
        if (pattern.test(contentToCheck)) {
          console.log(`❌ Content appears incomplete: matches pattern ${pattern}`);
          return false;
        }
      }

      // Quality indicators (should have at least 2)
      const qualityIndicators = [
        /\b(study|research|science|scientists?|evidence|data)\b/i, // Evidence-based
        /\b(try|start|avoid|consider|remember)\b/i, // Actionable
        /\b(because|why|how|reason|due to)\b/i, // Explanatory
        /\b(\d+%|\d+ times?|\d+ hours?|\d+ minutes?)\b/i, // Specific numbers
        /\b(improve|increase|reduce|better|enhance)\b/i, // Benefits
      ];

      const qualityScore = qualityIndicators.reduce((score, pattern) => 
        score + (pattern.test(contentToCheck) ? 1 : 0), 0);

      if (qualityScore < 2) {
        console.log(`❌ Content quality too low: score ${qualityScore}/5`);
        return false;
      }

      console.log(`✅ Content passed quality check: ${qualityScore}/5 quality indicators`);
      return true;

    } catch (error) {
      console.warn('Content validation error:', error);
      return false; // Fail safe
    }
  }

  private async storeInDatabase(content: string, tweetId: string): Promise<void> {
    try {
      // Use the enterprise-grade Advanced Database Manager
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      
      await dbManager.initialize();
      
      // Store in proper learning and metrics tables for Social Content Operator
      console.log(`📊 DB_WRITE: Storing tweet data for learning system`);
      
      const { storeNewPostMetrics } = await import('../posting/metrics');
      
      // Store the post data in the learning system for analytics and improvement
      await storeNewPostMetrics({
        tweet_id: tweetId,
        content: content,
        format: content.includes('\n\n') ? 'thread' : 'single', // Simple format detection
        initial_metrics: {
          likes_count: 0,
          retweets_count: 0,
          replies_count: 0,
          bookmarks_count: 0,
          impressions_count: 0
        }
      });

      console.log(`✅ DB_WRITE: Successfully stored tweet ${tweetId} in learning_posts and tweet_metrics`);
      
      // Emit success event for monitoring
      dbManager.emit('tweetStored', { tweetId, content: content.substring(0, 100) });
      
    } catch (error: any) {
      console.error('⚠️ Enterprise database storage failed:', error.message);
      
      // Record metric for monitoring system
      try {
        const { DatabaseMonitoringSystem } = await import('../lib/databaseMonitoringSystem');
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        
        const monitor = DatabaseMonitoringSystem.getInstance(supabase);
        monitor.addCustomMetric({
          timestamp: new Date(),
          metric: 'tweet_storage_error',
          value: 1,
          unit: 'errors',
          source: 'application',
          tags: { operation: 'store_tweet', error: error.message.substring(0, 50) }
        });
      } catch (monitorError) {
        // Monitoring failed, but don't block the main operation
      }
      
      // Don't throw - posting succeeded even if DB failed
    }
  }

  /**
   * Generate intelligent content based on posting opportunity and learned patterns
   */
  private async generateIntelligentContent(opportunity: any): Promise<string | string[]> {
    try {
      // 20% chance to use Signal_Synapse thread format for health content
      const useSignalSynapse = Math.random() < 0.2;
      
      if (useSignalSynapse) {
        console.log('🧬 Generating Signal_Synapse health thread...');
        return await this.generateSignalSynapseContent(opportunity);
      }

      const { OpenAI } = await import('openai');
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Get viral growth strategy and content recommendations
      console.log('🧠 Getting content recommendations from learning engine...');
      console.log('🎯 Optimizing content for maximum follower growth...');
      
      const growthStrategy = await this.followerOptimizer.getOptimalGrowthStrategy();
      console.log(`📈 Growth strategy: ${growthStrategy.strategy} (Expected: +${growthStrategy.expectedFollowerGrowth} followers)`);
      
      const recommendations = await this.learningEngine.getContentRecommendations();
      
      // Build viral content prompt based on growth strategy and learned patterns
      let contextPrompt = `You are a viral content creator with millions of followers. Create a ${growthStrategy.strategy} post that will gain maximum followers. `;
      
      // Add strategy-specific requirements
      contextPrompt += `Strategy: ${growthStrategy.description} `;
      if (growthStrategy.contentRequirements.length > 0) {
        contextPrompt += `Requirements: ${growthStrategy.contentRequirements.join(', ')}. `;
      }
      
      // Apply learning insights to prompt
      if (recommendations.optimalLength > 0) {
        contextPrompt += `Target around ${recommendations.optimalLength} characters for optimal engagement. `;
      }
      
      if (recommendations.bestTopics.length > 0) {
        contextPrompt += `Focus on high-performing topics: ${recommendations.bestTopics.join(', ')}. `;
      }
      
      if (recommendations.contentStyle) {
        contextPrompt += `Use ${recommendations.contentStyle} style content as it performs best. `;
      }
      
      if (recommendations.engagementHooks.length > 0) {
        const hook = recommendations.engagementHooks[Math.floor(Math.random() * recommendations.engagementHooks.length)];
        contextPrompt += `Consider starting with engaging hooks like "${hook}". `;
      }
      
      // Add opportunity-specific context
      if (opportunity.contentHints && opportunity.contentHints.length > 0) {
        contextPrompt += `Context: ${opportunity.contentHints.join(', ')}. `;
      }
      
      if (opportunity.urgency === 'critical') {
        contextPrompt += `This is time-sensitive content that should capture immediate attention. `;
      }
      
      if (opportunity.reason.includes('trending')) {
        contextPrompt += `Tap into current trending topics while maintaining health focus. `;
      }
      
      if (opportunity.reason.includes('engagement')) {
        contextPrompt += `This is a high-engagement window - make it conversational and engaging. `;
      }
      
      contextPrompt += `You are a content creator with 100K+ followers who understands viral psychology. Create COMPLETE, valuable health content using proven viral formulas.

VIRAL CONTENT REQUIREMENTS:
- COMPLETE thought (never ellipsis, "more details coming", or incomplete threads)
- Use psychological triggers: curiosity, social proof, urgency, controversy
- Include specific evidence: "Study of 50,000 people found...", "Research shows 73% improvement..."
- Make it actionable: "Try this", "Start with", "Avoid these 3 things"
- Use engaging patterns: "Most people think X, but actually Y", "The #1 mistake people make"
- Add personal elements: "I've been doing this for 2 years", "This changed my life"
- End with clear takeaway or question to drive engagement
- If it's a thread, make each tweet valuable on its own

VIRAL HOOKS TO USE:
- "90% of people don't know this about..."
- "This simple trick that doctors don't tell you..."
- "I've been studying [topic] for 10 years, here's what I learned..."
- "The billion-dollar industry doesn't want you to know..."
- "After analyzing 1000+ studies, here's the truth..."

Expected performance score: ${recommendations.expectedScore}/100.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Better model for quality
        messages: [
          {
            role: 'system',
            content: `${contextPrompt}

CRITICAL QUALITY REQUIREMENTS:
- Must be a COMPLETE thought (no ellipsis, no "more details", no teasers)
- Include specific, actionable information
- Provide science/reasoning for claims
- End with a clear takeaway, not a cliffhanger
- If about health, include evidence or specific benefits
- Sound human and conversational, never corporate`
          },
          {
            role: 'user',
            content: 'Create an engaging health/wellness tweet that sounds like a real person.'
          }
        ],
        max_tokens: 250, // Increased for complete thoughts
        temperature: 0.8,
      });

      let content = response.choices[0]?.message?.content || 'Your body loses 2-3 liters of water daily through breathing alone. That tired feeling at 3 PM? Often dehydration, not caffeine withdrawal. Try 16oz of water before reaching for coffee.';
      
      // Ensure it's within Twitter's limit (regenerate if too long)
      if (content.length > 280) {
        console.log(`❌ Generated content too long (${content.length} chars), falling back to quality content`);
        content = 'Your brain uses 20% of your body\'s energy. That foggy feeling after lunch? Low blood sugar affecting cognition. Try protein + complex carbs for steady mental performance throughout the day.';
      }

      return content;
    } catch (error) {
      console.error('Failed to generate intelligent content:', error);
      return 'Taking a moment to focus on your health today can make all the difference. What small healthy choice will you make right now?';
    }
  }

  /**
   * Generate Signal_Synapse format health thread
   */
  private async generateSignalSynapseContent(opportunity: any): Promise<string[]> {
    try {
      const { IntelligentContentGenerator } = await import('../agents/intelligentContentGenerator');
      const contentGenerator = IntelligentContentGenerator.getInstance();
      
      // Generate the structured thread data
      const threadData = await contentGenerator.generateSignalSynapseThread();
      
      console.log(`✅ Generated Signal_Synapse thread: ${threadData.topic} (${threadData.hook_type})`);
      console.log(`🎯 Predicted scores: clarity=${threadData.predicted_scores.hook_clarity}, novelty=${threadData.predicted_scores.novelty}`);
      
      // Store the full thread data for tracking
      await this.storeSignalSynapseThreadData(threadData, opportunity);
      
      // Return the full tweets array for proper thread posting
      return threadData.tweets;
    } catch (error) {
      console.error('❌ Failed to generate Signal_Synapse content:', error);
      // Fallback to single tweet (array with one element)
      return ['Taking a moment to focus on evidence-based health insights. What wellness practice has made the biggest difference in your life?'];
    }
  }

  /**
   * Store Signal_Synapse thread data for learning and future posting
   */
  private async storeSignalSynapseThreadData(threadData: any, opportunity: any): Promise<void> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      
      await dbManager.executeQuery(
        'store_signal_synapse_posting_data',
        async (client) => {
          const { error } = await client
            .from('signal_synapse_posting_data')
            .insert({
              topic: threadData.topic,
              hook_type: threadData.hook_type,
              cta: threadData.cta,
              hashtags: threadData.hashtags,
              source_urls: threadData.source_urls,
              tags: threadData.tags,
              predicted_scores: threadData.predicted_scores,
              content_notes: threadData.content_notes,
              tweets: threadData.tweets,
              tweet_count: threadData.tweets.length,
              opportunity_score: opportunity.score,
              opportunity_reason: opportunity.reason,
              posted_at: new Date().toISOString()
            });

          if (error) throw error;
          return { success: true };
        }
      );
      
      console.log('📊 Signal_Synapse thread data stored for learning');
    } catch (error: any) {
      console.error('STORE_FAIL_THREAD_JSON: Failed to store Signal_Synapse thread data:', error.message);
      throw error; // Don't swallow storage errors - fail the posting
    }
  }

  /**
   * Store intelligent posting data for learning
   */
  private async storeIntelligentPostData(tweetId: string, opportunity: any, content: string): Promise<void> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      
      await dbManager.executeQuery(
        'store_intelligent_post_data',
        async (client) => {
                    const { data, error } = await client
            .from('intelligent_posts')
            .insert({
              tweet_id: tweetId,
              score_value: opportunity.score,
              urgency_level: opportunity.urgency,
              reason_text: opportunity.reason,
              content_hints: opportunity.contentHints?.join(', ') || '',
              tweet_content: content,
              posted_timestamp: new Date().toISOString()
            });

          if (error) throw error;
          return data;
        }
      );
      
      console.log('📊 Intelligent posting data stored for learning');
    } catch (error) {
      console.warn('Failed to store intelligent posting data:', error);
    }
  }

  public getStatus(): { isRunning: boolean; lastPost?: Date } {
    return {
      isRunning: this.isRunning
    };
  }

  /**
   * Schedule performance tracking for a specific tweet
   */
  private async schedulePerformanceTracking(tweetId: string, content: string, prediction: any): Promise<void> {
    try {
      // Get current follower count before tracking
      const beforeFollowers = await this.performanceTracker.getCurrentFollowerCount();
      
      // Schedule tracking at intervals: 1h, 6h, 24h
      const trackingIntervals = [
        { delay: 60 * 60 * 1000, label: '1 hour' },      // 1 hour
        { delay: 6 * 60 * 60 * 1000, label: '6 hours' },  // 6 hours  
        { delay: 24 * 60 * 60 * 1000, label: '24 hours' } // 24 hours
      ];

      trackingIntervals.forEach(({ delay, label }) => {
        setTimeout(async () => {
          try {
            console.log(`📊 Tracking ${label} performance for tweet ${tweetId}...`);
            
            // For browser tweets, we can't get individual tweet metrics easily
            // So we'll track overall account performance and attribute growth
            const afterFollowers = await this.performanceTracker.getCurrentFollowerCount();
            const followerGrowth = afterFollowers - beforeFollowers;
            
            // Store growth attribution
            await this.storePerformanceData(tweetId, {
              timeframe: label,
              follower_growth: followerGrowth,
              predicted_likes: prediction.expectedLikes,
              predicted_followers: prediction.expectedFollowers,
              confidence: prediction.confidenceScore
            });
            
            console.log(`✅ ${label} tracking complete: ${followerGrowth} new followers`);
            
            // Trigger learning update if we have enough data
            if (label === '24 hours') {
              console.log('🧠 Triggering learning update after 24h tracking...');
              await this.learningEngine.learnFromPerformanceData();
              
              // Learn from viral successes for follower optimization
              if (followerGrowth > 5) { // Significant follower growth
                console.log(`🔥 Viral success detected! Learning from ${followerGrowth} new followers...`);
                await this.followerOptimizer.learnFromViralSuccess(tweetId, {
                  likes: prediction.expectedLikes || 0,
                  retweets: Math.round((prediction.expectedLikes || 0) * 0.1),
                  replies: Math.round((prediction.expectedLikes || 0) * 0.05),
                  impressions: Math.round((prediction.expectedLikes || 0) * 10),
                  followersGained: followerGrowth,
                  content: content
                });
              }
            }
            
          } catch (error: any) {
            console.error(`⚠️ ${label} performance tracking failed:`, error.message);
          }
        }, delay);
      });

      console.log(`⏰ Performance tracking scheduled for ${tweetId} (1h, 6h, 24h intervals)`);
      
    } catch (error: any) {
      console.error('⚠️ Failed to schedule performance tracking:', error.message);
    }
  }

  /**
   * Store performance tracking data
   */
  private async storePerformanceData(tweetId: string, data: any): Promise<void> {
    try {
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      await dbManager.initialize();

      // Update learning_posts with performance data
      await dbManager.executeQuery(
        'update_performance_data',
        async (client) => {
          const { error } = await client
            .from('learning_posts')
            .update({
              converted_followers: data.follower_growth,
              viral_potential_score: Math.round((data.follower_growth / Math.max(data.predicted_followers, 1)) * 100),
              learning_metadata: {
                ...data,
                tracked_at: new Date().toISOString()
              }
            })
            .eq('tweet_id', tweetId);
          
          if (error) throw error;
          return true;
        },
        `performance_${tweetId}_${data.timeframe}`,
        300000
      );

      console.log(`📊 Performance data stored for ${tweetId} (${data.timeframe})`);
      
    } catch (error: any) {
      console.error('⚠️ Failed to store performance data:', error.message);
    }
  }
}
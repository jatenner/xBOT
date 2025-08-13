import * as cron from 'node-cron';
import { AdaptivePostingScheduler } from '../intelligence/adaptivePostingScheduler';
import { TweetPerformanceTracker } from '../intelligence/tweetPerformanceTracker';
import { IntelligentLearningEngine } from '../intelligence/intelligentLearningEngine';
import { FollowerGrowthOptimizer } from '../intelligence/followerGrowthOptimizer';

export class AutonomousPostingEngine {
  private static instance: AutonomousPostingEngine;
  private isRunning = false;
  private scheduler: AdaptivePostingScheduler;
  private intelligentTimerInterval: NodeJS.Timeout | null = null;
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
    
    // INTELLIGENT POSTING: Check every 5 minutes for optimal opportunities
    this.intelligentTimerInterval = setInterval(async () => {
      try {
        const opportunity = await this.scheduler.shouldPostNow();
        
        if (opportunity.score > 50) { // Threshold for posting
          console.log(`🎯 Posting opportunity detected! Score: ${Math.round(opportunity.score)}/100`);
          console.log(`📝 Reason: ${opportunity.reason}`);
          console.log(`⚡ Urgency: ${opportunity.urgency}`);
          
          // Execute intelligent post
          this.executeIntelligentPost(opportunity).catch(console.error);
        } else {
          console.log(`⏳ Waiting for better opportunity. Current score: ${Math.round(opportunity.score)}/100 - ${opportunity.reason}`);
            }
          } catch (error) {
        console.error('❌ Error in intelligent posting analysis:', error);
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

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
      
      if (opportunity.score > 30) {
        this.executeIntelligentPost(opportunity).catch(console.error);
      }
    }, 2 * 60 * 1000);

    this.isRunning = true;
    console.log('✅ Intelligent adaptive posting system activated');
    console.log('🎯 Will analyze posting opportunities every 5 minutes');
    console.log('📊 Factors: trending topics, audience activity, engagement windows, breaking news');
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
      const content = await this.generateContent();
      
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
      console.log(`🧠 Executing intelligent post (Score: ${Math.round(opportunity.score)}/100)`);
      console.log(`🎯 Context: ${opportunity.reason}`);

      // Ensure browser poster is available
      if (!this.browserPoster) {
        console.log('🔄 Initializing browser poster...');
        const { AutonomousTwitterPoster } = await import('../agents/autonomousTwitterPoster');
        this.browserPoster = AutonomousTwitterPoster.getInstance();
        await this.browserPoster.initialize();
      }

      // Generate content with intelligent context
      const content = await this.generateIntelligentContent(opportunity);
      
      console.log(`📝 Generated intelligent content: ${content.substring(0, 80)}...`);

      // Post to Twitter using browser automation (call the private method via reflection)
      const result = await (this.browserPoster as any).postSingle(content, { 
        forcePost: true
      });
      
      if (!result.success) {
        throw new Error(result.error || 'Browser posting failed');
      }
      
      console.log(`✅ Posted intelligent tweet successfully: ${result.tweetId}`);
      console.log(`📊 Opportunity utilized: ${opportunity.urgency} urgency`);

      const tweetId = result.tweetId || 'browser_' + Date.now();

      // Store performance data for learning
      await this.storeInDatabase(content, tweetId);
      await this.storeIntelligentPostData(tweetId, opportunity, content);
      
      // Analyze viral potential of content
      const viralAnalysis = await this.followerOptimizer.analyzeViralPotential(content);
      console.log(`🔥 Viral score: ${viralAnalysis.viralScore}/100, Follower potential: ${viralAnalysis.followerPotential}/100`);
      
      // Log optimization suggestions
      if (viralAnalysis.improvementSuggestions.length > 0) {
        console.log(`💡 Next time: ${viralAnalysis.improvementSuggestions[0]}`);
      }
      
      // Predict performance for validation
      const prediction = await this.learningEngine.predictContentPerformance(content);
      console.log(`🎯 Predicted performance: ${prediction.expectedLikes} likes, ${prediction.expectedFollowers} new followers`);
      
      // Schedule performance tracking for this tweet
      await this.schedulePerformanceTracking(tweetId, content, prediction);
      
      console.log('📊 Intelligent posting data stored for learning');

      return { success: true, content };
    } catch (error: any) {
      console.error('❌ Failed to execute intelligent post:', error.message);
      return { success: false, error: error.message };
    }
  }

  private async generateContent(): Promise<string> {
    try {
      // Import OpenAI dynamically to avoid issues
      const { OpenAI } = await import('openai');
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      const viralTopics = [
        'simple life hacks that actually work',
        'productivity tips for busy people',
        'surprising science facts',
        'morning routine optimization',
        'technology trends and insights',
        'financial wellness and money tips',
        'travel and lifestyle discoveries',
        'career growth strategies',
        'relationship and communication insights',
        'creative thinking and innovation',
        'time management techniques',
        'personal development insights',
        'nutrition myths debunked',
        'exercise efficiency tips',
        'sleep optimization hacks',
        'stress reduction techniques',
        'mindfulness and focus tips',
        'health research breakthroughs',
        'workplace wellness strategies',
        'sustainable living tips'
      ];

      const randomTopic = viralTopics[Math.floor(Math.random() * viralTopics.length)];

      const contentStyles = [
        `Write a viral tweet about ${randomTopic}. Sound like a real person sharing something useful. No quotes, no corporate speak. Be direct and engaging.`,
        `Create a relatable post about ${randomTopic}. Start with "Just realized..." or "Pro tip:" or "Anyone else...". Keep it casual and authentic.`,
        `Share an insight about ${randomTopic}. Write like you're texting a friend. No hashtags unless absolutely necessary. Make it shareable.`,
        `Drop some knowledge about ${randomTopic}. Be the person who always has interesting facts. Keep it conversational and surprising.`,
        `Post about ${randomTopic} like you just discovered something cool. Use simple language that anyone can understand.`
      ];
      
      const randomStyle = contentStyles[Math.floor(Math.random() * contentStyles.length)];

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ 
          role: 'user', 
          content: randomStyle 
        }],
        max_tokens: 100,
        temperature: 0.9, // Higher creativity
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No content generated from OpenAI');
      }

      return content;

    } catch (error: any) {
      console.error('❌ AI content generation failed:', error.message);
      
      // Fallback to diverse, viral content
      const fallbackContent = [
        'Just learned that taking breaks actually makes you more productive. Anyone else feel guilty about resting?',
        'Pro tip: Set your phone to grayscale. Instantly makes social media less addictive',
        'The 2-minute rule changed my life: if it takes less than 2 minutes, do it now',
        'Coffee naps are real: drink coffee, nap for 20 minutes, wake up superhuman',
        'Your brain uses 20% of your energy. No wonder thinking is exhausting',
        'Hot showers before bed actually make you sleep worse. Cold rooms are the secret',
        'Compound interest applies to habits too. Small daily improvements = massive results',
        'Most successful people have one thing in common: they finish what they start',
        'The best time to learn something new is when you think you\'re too old for it',
        'Your future self will either thank you or blame you for what you do today'
      ];
      
      return fallbackContent[Math.floor(Math.random() * fallbackContent.length)];
    }
  }

  private async storeInDatabase(content: string, tweetId: string): Promise<void> {
    try {
      // Use the enterprise-grade Advanced Database Manager
      const { AdvancedDatabaseManager } = await import('../lib/advancedDatabaseManager');
      const dbManager = AdvancedDatabaseManager.getInstance();
      
      await dbManager.initialize();
      
      // Execute with advanced query optimization and monitoring
      const success = await dbManager.executeQuery(
        'insert_tweet',
        async (client) => {
          const { error } = await client.from('tweets').insert({
        content,
        tweet_id: tweetId,
            posted_at: new Date().toISOString(),
            platform: 'twitter',
            status: 'posted',
        engagement_score: 0,
        likes: 0,
        retweets: 0,
            replies: 0
          });
          
          if (error) throw error;
          return true;
        },
        `tweet_insert_${tweetId}`, // Cache key
        300000 // 5 minute cache
      );

      // Cache tweet data in Redis for quick access
      await dbManager.cacheSet(`tweet:${tweetId}`, {
        content,
        posted_at: new Date().toISOString(),
        platform: 'twitter',
        status: 'posted'
      }, 3600); // 1 hour cache

      console.log('🏢 Stored tweet in enterprise database system with caching');
      
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
  private async generateIntelligentContent(opportunity: any): Promise<string> {
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
      
      contextPrompt += `Create a concise, human-like tweet about health/wellness. Be conversational, avoid corporate speak, minimal hashtags. Expected performance score: ${recommendations.expectedScore}/100.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: contextPrompt
          },
          {
            role: 'user',
            content: 'Create an engaging health/wellness tweet that sounds like a real person.'
          }
        ],
        max_tokens: 100,
        temperature: 0.8,
      });

      let content = response.choices[0]?.message?.content || 'Stay hydrated and take care of yourself today! 💧';
      
      // Ensure it's within Twitter's limit
      if (content.length > 280) {
        content = content.substring(0, 277) + '...';
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
  private async generateSignalSynapseContent(opportunity: any): Promise<string> {
    try {
      const { IntelligentContentGenerator } = await import('../agents/intelligentContentGenerator');
      const contentGenerator = IntelligentContentGenerator.getInstance();
      
      // Generate the structured thread data
      const threadData = await contentGenerator.generateSignalSynapseThread();
      
      console.log(`✅ Generated Signal_Synapse thread: ${threadData.topic} (${threadData.hook_type})`);
      console.log(`🎯 Predicted scores: clarity=${threadData.predicted_scores.hook_clarity}, novelty=${threadData.predicted_scores.novelty}`);
      
      // Convert the structured thread to a single posting string
      // For thread posting, we'll post the first tweet initially
      const firstTweet = threadData.tweets[0];
      
      // Store the full thread data for potential future use
      await this.storeSignalSynapseThreadData(threadData, opportunity);
      
      return firstTweet;
    } catch (error) {
      console.error('❌ Failed to generate Signal_Synapse content:', error);
      // Fallback to regular content generation
      return 'Taking a moment to focus on evidence-based health insights. What wellness practice has made the biggest difference in your life?';
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
    } catch (error) {
      console.warn('Failed to store Signal_Synapse thread data:', error);
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
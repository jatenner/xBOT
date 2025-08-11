import { TwitterApi } from 'twitter-api-v2';
import * as cron from 'node-cron';
import { AdaptivePostingScheduler } from '../intelligence/adaptivePostingScheduler';

export class AutonomousPostingEngine {
  private static instance: AutonomousPostingEngine;
  private twitterClient: TwitterApi | null = null;
  private isRunning = false;
  private scheduler: AdaptivePostingScheduler;
  private intelligentTimerInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.scheduler = AdaptivePostingScheduler.getInstance();
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

      // Initialize Twitter client
      this.twitterClient = new TwitterApi({
        appKey: process.env.TWITTER_CONSUMER_KEY!,
        appSecret: process.env.TWITTER_CONSUMER_SECRET!,
        accessToken: process.env.TWITTER_ACCESS_TOKEN!,
        accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
      });

      console.log('✅ Twitter client initialized');
      
      // Start intelligent adaptive posting schedule
      this.startAutonomousSchedule();
      
      console.log('✅ Intelligent Adaptive Posting Engine ready');
      console.log('🧠 Features: trending analysis, engagement windows, breaking news detection');
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

      if (!this.twitterClient) {
        throw new Error('Twitter client not initialized');
      }

      // Generate content using AI
      const content = await this.generateContent();
      
      console.log(`📝 Generated content: ${content.substring(0, 80)}...`);

      // Post to Twitter
      const tweet = await this.twitterClient.v2.tweet(content);
      
      console.log(`✅ Posted tweet successfully: ${tweet.data.id}`);

      // Store in database
      await this.storeInDatabase(content, tweet.data.id);

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

      if (!this.twitterClient) {
        throw new Error('Twitter client not initialized');
      }

      // Generate content with intelligent context
      const content = await this.generateIntelligentContent(opportunity);
      
      console.log(`📝 Generated intelligent content: ${content.substring(0, 80)}...`);

      // Post to Twitter
      const tweet = await this.twitterClient.v2.tweet(content);
      
      console.log(`✅ Posted intelligent tweet successfully: ${tweet.data.id}`);
      console.log(`📊 Opportunity utilized: ${opportunity.urgency} urgency`);

      // Store performance data for learning
      await this.storeInDatabase(content, tweet.data.id);
      await this.storeIntelligentPostData(tweet.data.id, opportunity, content);

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

      const healthTopics = [
        'hydration and water intake',
        'sleep quality and circadian rhythms',
        'exercise and movement',
        'nutrition and healthy eating',
        'stress management techniques',
        'mental health awareness',
        'preventive healthcare',
        'healthy habits formation'
      ];

      const randomTopic = healthTopics[Math.floor(Math.random() * healthTopics.length)];

      const prompt = `Create a helpful, engaging tweet about ${randomTopic}. 
      Make it conversational, actionable, and under 280 characters. 
      Include a question to encourage engagement. 
      Keep it human-like with minimal hashtags.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0.8,
      });

      const content = response.choices[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error('No content generated from OpenAI');
      }

      return content;

    } catch (error: any) {
      console.error('❌ AI content generation failed:', error.message);
      
      // Fallback to simple content
      const fallbackTopics = [
        'Stay hydrated! Drinking enough water improves energy and focus. How many glasses do you aim for daily?',
        'Quality sleep is the foundation of good health. What helps you wind down before bed?',
        'Small daily movements add up. Even a 10-minute walk can boost your mood. What movement brings you joy?',
        'Eating colorful foods provides diverse nutrients. What\'s your favorite colorful meal?',
        'Deep breathing can instantly reduce stress. Try 4-7-8 breathing: inhale 4, hold 7, exhale 8. How do you manage stress?'
      ];
      
      return fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
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
   * Generate intelligent content based on posting opportunity
   */
  private async generateIntelligentContent(opportunity: any): Promise<string> {
    try {
      const { OpenAI } = await import('openai');
      
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Build intelligent prompt based on opportunity context
      let contextPrompt = `You are a health and wellness expert creating a Twitter post. `;
      
      if (opportunity.contentHints && opportunity.contentHints.length > 0) {
        contextPrompt += `Focus on: ${opportunity.contentHints.join(', ')}. `;
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
      
      contextPrompt += `Create a concise, human-like tweet about health/wellness. Be conversational, avoid corporate speak, minimal hashtags. Maximum 280 characters.`;

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
              opportunity_score: opportunity.score,
              urgency: opportunity.urgency,
              posting_reason: opportunity.reason,
              content_hints: opportunity.contentHints?.join(', ') || '',
              content: content,
          posted_at: new Date().toISOString()
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
}
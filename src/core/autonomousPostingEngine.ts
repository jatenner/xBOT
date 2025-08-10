import { TwitterApi } from 'twitter-api-v2';
import * as cron from 'node-cron';

export class AutonomousPostingEngine {
  private static instance: AutonomousPostingEngine;
  private twitterClient: TwitterApi | null = null;
  private isRunning = false;

  private constructor() {}

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
      
      // Start autonomous posting schedule
      this.startAutonomousSchedule();
      
      console.log('✅ Autonomous Posting Engine ready');
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

    console.log('📅 Starting autonomous posting schedule...');
    
    // Post every 3 hours
    cron.schedule('0 */3 * * *', () => {
      this.executePost().catch(console.error);
    });

    // Initial post after 2 minutes
    setTimeout(() => {
      this.executePost().catch(console.error);
    }, 2 * 60 * 1000);

    this.isRunning = true;
    console.log('✅ Autonomous posting schedule started');
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
      const { createClient } = await import('@supabase/supabase-js');
      
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      await supabase.from('tweets').insert({
        content,
        tweet_id: tweetId,
        posted_at: new Date().toISOString(),
        platform: 'twitter',
        status: 'posted'
      });

      console.log('📊 Stored tweet in database');
    } catch (error: any) {
      console.error('⚠️ Failed to store in database:', error.message);
      // Don't throw - posting succeeded even if DB failed
    }
  }

  public getStatus(): { isRunning: boolean; lastPost?: Date } {
    return {
      isRunning: this.isRunning
    };
  }
}
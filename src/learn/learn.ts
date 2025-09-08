/**
 * Self-Learning System for @SignalAndSynapse
 * Scrapes own account metrics and updates content strategy based on performance
 */

import { chromium, Browser, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import OpenAI from 'openai';

interface TweetMetrics {
  tweet_id: string;
  text: string;
  likes: number;
  replies: number;
  reposts: number;
  views: number;
  posted_at: Date;
  engagement_rate: number;
}

interface LearningInsights {
  top_performing_formats: string[];
  top_performing_topics: string[];
  declining_patterns: string[];
  recommended_adjustments: any;
}

export class SelfLearningSystem {
  private supabase: any;
  private redis: Redis;
  private openai: OpenAI;
  private accountHandle: string;

  constructor(accountHandle: string = 'SignalAndSynapse') {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE!
    );
    this.redis = new Redis(process.env.REDIS_URL!);
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!
    });
    this.accountHandle = accountHandle;
  }

  /**
   * Main learning cycle: scrape, analyze, update strategy
   */
  async runLearningCycle(): Promise<LearningInsights> {
    console.log('🧠 Starting self-learning cycle...');

    try {
      // Step 1: Scrape recent tweet metrics
      const recentMetrics = await this.scrapeOwnAccountMetrics();
      console.log(`📊 Scraped metrics for ${recentMetrics.length} tweets`);

      // Step 2: Store/update metrics in database
      await this.storeMetrics(recentMetrics);

      // Step 3: Analyze performance patterns
      const insights = await this.analyzePerformancePatterns();
      console.log('🔍 Generated performance insights');

      // Step 4: Update content strategy
      await this.updateContentStrategy(insights);
      console.log('📈 Updated content strategy');

      // Step 5: Update pattern confidence scores
      await this.updatePatternScores();
      console.log('🎯 Updated pattern confidence scores');

      return insights;
    } catch (error) {
      console.error('Learning cycle failed:', error);
      throw error;
    }
  }

  /**
   * Scrape metrics for own tweets using Playwright
   */
  private async scrapeOwnAccountMetrics(): Promise<TweetMetrics[]> {
    const browser = await chromium.launch({ 
      headless: process.env.HEADLESS !== 'false' 
    });
    const context = await browser.newContext();
    
    // Load session if available
    const sessionPath = process.env.PLAYWRIGHT_STORAGE_PATH || 'playwright/storage.json';
    try {
      await context.storageState({ path: sessionPath });
    } catch (error) {
      console.warn('No session file found, proceeding without authentication');
    }

    const page = await context.newPage();
    const metrics: TweetMetrics[] = [];

    try {
      // Navigate to own profile
      await page.goto(`https://x.com/${this.accountHandle}`);
      await page.waitForLoadState('networkidle');

      // Get recent tweets (last 50)
      const tweets = await page.$$eval('[data-testid="tweet"]', (elements) => {
        return elements.slice(0, 50).map(tweet => {
          const textElement = tweet.querySelector('[data-testid="tweetText"]');
          const text = textElement?.textContent || '';
          
          // Extract tweet ID from URL
          const linkElement = tweet.querySelector('a[href*="/status/"]');
          const href = linkElement?.getAttribute('href') || '';
          const tweetId = href.split('/status/')[1]?.split('?')[0] || '';

          // Extract metrics
          const likeElement = tweet.querySelector('[data-testid="like"] span');
          const replyElement = tweet.querySelector('[data-testid="reply"] span');
          const repostElement = tweet.querySelector('[data-testid="retweet"] span');
          
          const likes = parseInt(likeElement?.textContent?.replace(/[,K]/g, '') || '0') * 
                       (likeElement?.textContent?.includes('K') ? 1000 : 1);
          const replies = parseInt(replyElement?.textContent?.replace(/[,K]/g, '') || '0') * 
                         (replyElement?.textContent?.includes('K') ? 1000 : 1);
          const reposts = parseInt(repostElement?.textContent?.replace(/[,K]/g, '') || '0') * 
                         (repostElement?.textContent?.includes('K') ? 1000 : 1);

          // Extract timestamp
          const timeElement = tweet.querySelector('time');
          const datetime = timeElement?.getAttribute('datetime') || new Date().toISOString();

          return {
            tweet_id: tweetId,
            text,
            likes,
            replies,
            reposts,
            views: 0, // Views not readily available in DOM
            posted_at: new Date(datetime),
            engagement_rate: 0 // Will be calculated later
          };
        });
      });

      // Filter out invalid tweets and calculate engagement rates
      for (const tweet of tweets) {
        if (tweet.tweet_id && tweet.text) {
          // Estimate views based on engagement (rough heuristic)
          const totalEngagement = tweet.likes + tweet.replies + tweet.reposts;
          tweet.views = Math.max(totalEngagement * 20, totalEngagement + 100); // Conservative estimate
          tweet.engagement_rate = tweet.views > 0 ? totalEngagement / tweet.views : 0;
          
          metrics.push(tweet);
        }
      }

    } catch (error) {
      console.error('Failed to scrape metrics:', error);
    } finally {
      await browser.close();
    }

    return metrics;
  }

  /**
   * Store metrics in database with embeddings
   */
  private async storeMetrics(metrics: TweetMetrics[]): Promise<void> {
    for (const metric of metrics) {
      try {
        // Check if tweet already exists
        const { data: existingTweet } = await this.supabase
          .from('posts')
          .select('id')
          .eq('tweet_id', metric.tweet_id)
          .single();

        if (existingTweet) {
          // Update existing tweet
          await this.supabase
            .from('posts')
            .update({
              likes: metric.likes,
              replies: metric.replies,
              reposts: metric.reposts,
              views: metric.views,
              engagement_rate: metric.engagement_rate,
              last_scraped_at: new Date().toISOString()
            })
            .eq('tweet_id', metric.tweet_id);
        } else {
          // Create new tweet record
          const embeddings = await this.getEmbedding(metric.text);
          const format = this.detectFormat(metric.text);
          const topic = await this.extractTopic(metric.text);
          const hook_type = await this.identifyHookType(metric.text);

          await this.supabase
            .from('posts')
            .insert({
              tweet_id: metric.tweet_id,
              text: metric.text,
              format,
              topic,
              hook_type,
              likes: metric.likes,
              replies: metric.replies,
              reposts: metric.reposts,
              views: metric.views,
              engagement_rate: metric.engagement_rate,
              posted_at: metric.posted_at.toISOString(),
              embeddings,
              last_scraped_at: new Date().toISOString()
            });
        }
      } catch (error) {
        console.error(`Failed to store metrics for tweet ${metric.tweet_id}:`, error);
      }
    }

    // Update performance tiers
    await this.updatePerformanceTiers();
  }

  /**
   * Analyze performance patterns and generate insights
   */
  private async analyzePerformancePatterns(): Promise<LearningInsights> {
    // Get posts from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentPosts } = await this.supabase
      .from('posts')
      .select('*')
      .gte('posted_at', thirtyDaysAgo.toISOString())
      .order('engagement_rate', { ascending: false });

    if (!recentPosts?.length) {
      return {
        top_performing_formats: [],
        top_performing_topics: [],
        declining_patterns: [],
        recommended_adjustments: {}
      };
    }

    // Analyze format performance
    const formatPerformance = this.analyzeFormatPerformance(recentPosts);
    
    // Analyze topic performance
    const topicPerformance = this.analyzeTopicPerformance(recentPosts);
    
    // Identify declining patterns
    const decliningPatterns = await this.identifyDecliningPatterns(recentPosts);
    
    // Generate AI recommendations
    const recommendations = await this.generateRecommendations(recentPosts);

    return {
      top_performing_formats: formatPerformance.slice(0, 3),
      top_performing_topics: topicPerformance.slice(0, 5),
      declining_patterns: decliningPatterns,
      recommended_adjustments: recommendations
    };
  }

  /**
   * Analyze format performance (short, medium, thread)
   */
  private analyzeFormatPerformance(posts: any[]): string[] {
    const formatStats: { [key: string]: { total: number, engagement: number } } = {};

    for (const post of posts) {
      if (!formatStats[post.format]) {
        formatStats[post.format] = { total: 0, engagement: 0 };
      }
      formatStats[post.format].total++;
      formatStats[post.format].engagement += post.engagement_rate || 0;
    }

    // Calculate average engagement by format
    const formatAvgs = Object.entries(formatStats).map(([format, stats]) => ({
      format,
      avgEngagement: stats.engagement / stats.total,
      count: stats.total
    }));

    return formatAvgs
      .filter(f => f.count >= 3) // Need at least 3 samples
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .map(f => f.format);
  }

  /**
   * Analyze topic performance
   */
  private analyzeTopicPerformance(posts: any[]): string[] {
    const topicStats: { [key: string]: { total: number, engagement: number } } = {};

    for (const post of posts) {
      if (!post.topic) continue;
      
      if (!topicStats[post.topic]) {
        topicStats[post.topic] = { total: 0, engagement: 0 };
      }
      topicStats[post.topic].total++;
      topicStats[post.topic].engagement += post.engagement_rate || 0;
    }

    const topicAvgs = Object.entries(topicStats).map(([topic, stats]) => ({
      topic,
      avgEngagement: stats.engagement / stats.total,
      count: stats.total
    }));

    return topicAvgs
      .filter(t => t.count >= 2) // Need at least 2 samples
      .sort((a, b) => b.avgEngagement - a.avgEngagement)
      .map(t => t.topic);
  }

  /**
   * Identify patterns that are declining in performance
   */
  private async identifyDecliningPatterns(posts: any[]): Promise<string[]> {
    // Compare last 15 days vs previous 15 days
    const midpoint = new Date();
    midpoint.setDate(midpoint.getDate() - 15);

    const recent = posts.filter(p => new Date(p.posted_at) >= midpoint);
    const older = posts.filter(p => new Date(p.posted_at) < midpoint);

    const declining: string[] = [];

    // Check format trends
    const recentFormats = this.analyzeFormatPerformance(recent);
    const olderFormats = this.analyzeFormatPerformance(older);

    for (const format of olderFormats.slice(0, 2)) {
      if (!recentFormats.slice(0, 2).includes(format)) {
        declining.push(`format:${format}`);
      }
    }

    // Check topic trends
    const recentTopics = this.analyzeTopicPerformance(recent);
    const olderTopics = this.analyzeTopicPerformance(older);

    for (const topic of olderTopics.slice(0, 3)) {
      if (!recentTopics.slice(0, 3).includes(topic)) {
        declining.push(`topic:${topic}`);
      }
    }

    return declining;
  }

  /**
   * Generate AI-powered recommendations
   */
  private async generateRecommendations(posts: any[]): Promise<any> {
    const topPosts = posts.slice(0, 10);
    const bottomPosts = posts.slice(-10);

    const prompt = `Analyze this Twitter performance data and provide strategic recommendations:

TOP PERFORMING POSTS (${topPosts.length}):
${topPosts.map(p => `- ${p.format} | ${p.topic} | ${p.engagement_rate.toFixed(3)} rate: "${p.text.substring(0, 100)}..."`).join('\n')}

BOTTOM PERFORMING POSTS (${bottomPosts.length}):
${bottomPosts.map(p => `- ${p.format} | ${p.topic} | ${p.engagement_rate.toFixed(3)} rate: "${p.text.substring(0, 100)}..."`).join('\n')}

Provide JSON recommendations in this format:
{
  "amplify_patterns": [{"pattern_name": "name", "reason": "why", "confidence": 0.8}],
  "avoid_patterns": [{"pattern_name": "name", "reason": "why"}],
  "experiment_patterns": [{"pattern_name": "name", "description": "what to try"}],
  "format_distribution": {"short": 0.4, "medium": 0.3, "thread": 0.3},
  "topic_priorities": {"topic1": 0.3, "topic2": 0.25, "topic3": 0.2}
}`;

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3
      });

      return JSON.parse(response.choices[0]?.message?.content || '{}');
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
      return {};
    }
  }

  /**
   * Update content strategy based on insights
   */
  private async updateContentStrategy(insights: LearningInsights): Promise<void> {
    // Store recommendations in database
    await this.supabase
      .from('recommendations')
      .insert({
        amplify_patterns: insights.recommended_adjustments.amplify_patterns || [],
        avoid_patterns: insights.recommended_adjustments.avoid_patterns || [],
        experiment_patterns: insights.recommended_adjustments.experiment_patterns || [],
        format_distribution: insights.recommended_adjustments.format_distribution || {},
        topic_priorities: insights.recommended_adjustments.topic_priorities || {},
        based_on_posts: 50, // rough estimate
        avg_engagement_rate: 0.02 // placeholder
      });

    // Cache insights in Redis for quick access
    await this.redis.setex('learning:insights', 3600, JSON.stringify(insights));
  }

  /**
   * Update pattern confidence scores based on recent performance
   */
  private async updatePatternScores(): Promise<void> {
    const { data: patterns } = await this.supabase
      .from('patterns')
      .select('*')
      .eq('status', 'active');

    for (const pattern of patterns || []) {
      try {
        const performance = await this.calculatePatternPerformance(pattern);
        
        await this.supabase
          .from('patterns')
          .update({
            success_count: performance.success_count,
            failure_count: performance.failure_count,
            confidence_score: performance.confidence_score,
            last_updated: new Date().toISOString()
          })
          .eq('id', pattern.id);
      } catch (error) {
        console.error(`Failed to update pattern ${pattern.id}:`, error);
      }
    }
  }

  /**
   * Calculate performance metrics for a specific pattern
   */
  private async calculatePatternPerformance(pattern: any): Promise<any> {
    // This is a simplified version - in production you'd implement
    // more sophisticated pattern matching against posts
    
    const { data: posts } = await this.supabase
      .from('posts')
      .select('engagement_rate, performance_tier')
      .eq('hook_type', pattern.pattern_name) // Simplified matching
      .gte('posted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const successCount = posts?.filter(p => p.performance_tier === 'top').length || 0;
    const failureCount = posts?.filter(p => p.performance_tier === 'low').length || 0;
    const totalCount = posts?.length || 0;

    const confidenceScore = totalCount > 0 ? successCount / totalCount : 0.5;

    return {
      success_count: successCount,
      failure_count: failureCount,
      confidence_score: Math.min(confidenceScore, 1.0)
    };
  }

  /**
   * Update performance tiers for all posts
   */
  private async updatePerformanceTiers(): Promise<void> {
    const { data: posts } = await this.supabase
      .from('posts')
      .select('id, engagement_rate')
      .not('engagement_rate', 'is', null)
      .order('engagement_rate', { ascending: false });

    if (!posts?.length) return;

    const topThreshold = Math.ceil(posts.length * 0.2); // Top 20%
    const bottomThreshold = Math.floor(posts.length * 0.8); // Bottom 20%

    for (let i = 0; i < posts.length; i++) {
      const tier = i < topThreshold ? 'top' : i >= bottomThreshold ? 'low' : 'mid';
      
      await this.supabase
        .from('posts')
        .update({ performance_tier: tier })
        .eq('id', posts[i].id);
    }
  }

  // Helper methods
  private detectFormat(text: string): string {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (text.includes('1/') || text.includes('🧵') || sentences.length > 3) return 'thread';
    if (text.length > 200) return 'medium';
    return 'short';
  }

  private async extractTopic(text: string): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: `Extract the main health topic from this content in 1-2 words: "${text}"`
        }],
        temperature: 0.1,
        max_tokens: 10
      });
      return response.choices[0]?.message?.content?.trim() || 'general_health';
    } catch (error) {
      return 'general_health';
    }
  }

  private async identifyHookType(text: string): Promise<string> {
    const hookPatterns = {
      'contrarian_stat': /\d+%|\d+ study|\d+ people|research shows/i,
      'myth_busting': /myth|wrong|actually|truth is|contrary to/i,
      'question_provocative': /^\w+.*\?/,
      'surprising_fact': /surprising|shocking|most people don't know/i
    };

    for (const [hookType, pattern] of Object.entries(hookPatterns)) {
      if (pattern.test(text)) return hookType;
    }
    return 'general';
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    });
    return response.data[0].embedding;
  }
}

export default SelfLearningSystem;

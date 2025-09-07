/**
 * 🎯 AGGRESSIVE ENGAGEMENT ENGINE
 * Strategic replies and engagement for rapid follower growth
 */

import { OpenAI } from 'openai';
import { admin as supabase } from '../lib/supabaseClients';
import { Page } from 'playwright';
import { systemMonitor } from '../monitoring/systemPerformanceMonitor';

export interface EngagementTarget {
  username: string;
  tweet_id: string;
  tweet_content: string;
  follower_count: number;
  engagement_rate: number;
  reply_strategy: 'value_add' | 'insight' | 'question' | 'story' | 'data_driven';
  priority_score: number;
}

export interface GeneratedReply {
  content: string;
  strategy: string;
  predicted_engagement: number;
  contains_value: boolean;
  tone: 'helpful' | 'insightful' | 'curious' | 'supportive';
}

export class AggressiveEngagementEngine {
  private static instance: AggressiveEngagementEngine;
  private openai: OpenAI;
  private recentReplies: string[] = [];
  
  private constructor() {
    this.openai = new OpenAI();
  }

  public static getInstance(): AggressiveEngagementEngine {
    if (!AggressiveEngagementEngine.instance) {
      AggressiveEngagementEngine.instance = new AggressiveEngagementEngine();
    }
    return AggressiveEngagementEngine.instance;
  }

  /**
   * 🎯 FIND HIGH-VALUE TARGETS FOR STRATEGIC ENGAGEMENT
   */
  public async findEngagementTargets(page: Page, limit: number = 5): Promise<EngagementTarget[]> {
    console.log('🎯 ENGAGEMENT_ENGINE: Scanning for high-value targets...');
    
    try {
      const targets: EngagementTarget[] = [];
      
      // Navigate to health-related hashtags and trending topics
      const searchQueries = [
        'health tips',
        'wellness advice', 
        'nutrition facts',
        'mental health',
        'fitness motivation',
        'longevity research'
      ];
      
      for (const query of searchQueries.slice(0, 2)) { // Limit to avoid rate limits
        await this.scanSearchResults(page, query, targets, Math.ceil(limit / 2));
        
        if (targets.length >= limit) break;
      }
      
      // Sort by priority score (engagement potential)
      targets.sort((a, b) => b.priority_score - a.priority_score);
      
      console.log(`🎯 TARGETS_FOUND: ${targets.length} high-value accounts identified`);
      return targets.slice(0, limit);
      
    } catch (error) {
      console.error('❌ TARGET_FINDING: Failed to find targets:', error);
      return [];
    }
  }

  private async scanSearchResults(page: Page, query: string, targets: EngagementTarget[], maxResults: number): Promise<void> {
    try {
      // Search for the query
      await page.goto(`https://twitter.com/search?q=${encodeURIComponent(query)}&src=typed_query&f=live`);
      await page.waitForTimeout(2000);
      
      // Find tweets with good engagement
      const tweets = await page.$$('[data-testid="tweet"]');
      
      for (let i = 0; i < Math.min(tweets.length, maxResults); i++) {
        try {
          const tweet = tweets[i];
          
          // Extract tweet data
          const usernameElement = await tweet.$('[data-testid="User-Name"] a');
          const tweetTextElement = await tweet.$('[data-testid="tweetText"]');
          const likesElement = await tweet.$('[data-testid="like"]');
          const retweetsElement = await tweet.$('[data-testid="retweet"]');
          
          if (!usernameElement || !tweetTextElement) continue;
          
          const username = await usernameElement.getAttribute('href');
          const tweetContent = await tweetTextElement.textContent();
          const likes = await this.extractEngagementCount(likesElement);
          const retweets = await this.extractEngagementCount(retweetsElement);
          
          if (!username || !tweetContent) continue;
          
          const cleanUsername = username.replace('/', '');
          const engagementScore = likes + (retweets * 2); // Retweets worth more
          
          // Only target accounts with decent engagement
          if (engagementScore >= 5 && tweetContent.length > 20) {
            targets.push({
              username: cleanUsername,
              tweet_id: `tweet_${Date.now()}_${i}`, // Simplified ID
              tweet_content: tweetContent,
              follower_count: this.estimateFollowerCount(engagementScore),
              engagement_rate: this.calculateEngagementRate(likes, retweets),
              reply_strategy: this.selectReplyStrategy(tweetContent),
              priority_score: this.calculatePriorityScore(engagementScore, tweetContent)
            });
          }
          
        } catch (error) {
          console.warn('⚠️ TWEET_SCAN: Failed to process tweet:', error);
        }
      }
      
    } catch (error) {
      console.warn(`⚠️ SEARCH_SCAN: Failed to scan ${query}:`, error);
    }
  }

  private async extractEngagementCount(element: any): Promise<number> {
    try {
      if (!element) return 0;
      const text = await element.textContent();
      if (!text) return 0;
      
      // Parse numbers like "1.2K" or "500"
      const match = text.match(/(\d+(?:\.\d+)?)\s*([KM]?)/);
      if (!match) return 0;
      
      const number = parseFloat(match[1]);
      const suffix = match[2];
      
      if (suffix === 'K') return Math.round(number * 1000);
      if (suffix === 'M') return Math.round(number * 1000000);
      return Math.round(number);
      
    } catch {
      return 0;
    }
  }

  private estimateFollowerCount(engagementScore: number): number {
    // Rough estimation based on engagement
    return engagementScore * 50; // Assume 1-2% engagement rate
  }

  private calculateEngagementRate(likes: number, retweets: number): number {
    const totalEngagement = likes + retweets;
    return Math.min(totalEngagement * 0.02, 10); // Cap at 10%
  }

  private selectReplyStrategy(tweetContent: string): 'value_add' | 'insight' | 'question' | 'story' | 'data_driven' {
    const content = tweetContent.toLowerCase();
    
    if (content.includes('study') || content.includes('research')) return 'data_driven';
    if (content.includes('?') || content.includes('thoughts')) return 'question';
    if (content.includes('personal') || content.includes('experience')) return 'story';
    if (content.includes('tip') || content.includes('advice')) return 'value_add';
    
    return 'insight';
  }

  private calculatePriorityScore(engagementScore: number, content: string): number {
    let score = engagementScore;
    
    // Boost for health-related keywords
    const healthKeywords = ['health', 'wellness', 'nutrition', 'fitness', 'mental', 'longevity'];
    for (const keyword of healthKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        score += 10;
      }
    }
    
    // Boost for engagement patterns
    if (content.includes('?')) score += 5; // Questions get more replies
    if (content.length > 100) score += 5; // Longer content = more thoughtful
    
    return score;
  }

  /**
   * 🤖 GENERATE STRATEGIC AI REPLY
   */
  public async generateStrategicReply(target: EngagementTarget): Promise<GeneratedReply> {
    const startTime = Date.now();
    
    try {
      const prompt = this.buildReplyPrompt(target);
      
      const response = await systemMonitor.trackDBQuery('openai_reply_generation', async () => {
        return this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a genuine health enthusiast who provides helpful, evidence-based replies. Your goal is to add real value through research, questions, or insights - never make false claims about credentials, experience, or spending money on courses. Be authentic, helpful, and honest. Keep replies under 280 characters. No hashtags.'
            },
            {
              role: 'user', 
              content: prompt
            }
          ],
          max_tokens: 100,
          temperature: 0.8
        });
      });

      const generatedContent = response.choices[0]?.message?.content?.trim() || '';
      
      // Ensure reply quality
      if (generatedContent.length < 20 || this.isReplyTooSimilar(generatedContent)) {
        throw new Error('Generated reply too short or similar to recent replies');
      }
      
      // Track this reply to avoid repetition
      this.recentReplies.push(generatedContent);
      if (this.recentReplies.length > 20) {
        this.recentReplies = this.recentReplies.slice(-20);
      }
      
      const generationTime = Date.now() - startTime;
      systemMonitor.trackContentGeneration(generationTime);
      
      const reply: GeneratedReply = {
        content: generatedContent,
        strategy: target.reply_strategy,
        predicted_engagement: this.predictReplyEngagement(generatedContent, target),
        contains_value: this.assessValueContent(generatedContent),
        tone: this.detectTone(generatedContent)
      };
      
      console.log(`🤖 REPLY_GENERATED: ${reply.strategy} strategy | ${generationTime}ms | Predicted engagement: ${reply.predicted_engagement}%`);
      
      return reply;
      
    } catch (error) {
      console.error('❌ REPLY_GENERATION: Failed to generate reply:', error);
      
      // Fallback reply
      return {
        content: 'Great insight! Thanks for sharing this.',
        strategy: 'supportive',
        predicted_engagement: 20,
        contains_value: false,
        tone: 'supportive'
      };
    }
  }

  private buildReplyPrompt(target: EngagementTarget): string {
    const strategyPrompts = {
      value_add: `Add valuable, evidence-based insight to this health tweet: "${target.tweet_content}". Share genuinely helpful information that enhances their point without making false claims about credentials or experience.`,
      
      insight: `Share a thoughtful, research-based insight related to: "${target.tweet_content}". Offer a fresh perspective based on studies or evidence, not personal medical claims.`,
      
      question: `Ask a genuinely curious follow-up question about: "${target.tweet_content}". Make it thought-provoking and encourage healthy discussion about the topic.`,
      
      story: `Share a relatable observation or general experience related to: "${target.tweet_content}". Keep it authentic without claiming specific medical expertise or fake personal details.`,
      
      data_driven: `Add supporting research or evidence to this health topic: "${target.tweet_content}". Reference actual studies or well-known health facts that support or expand on their point.`
    };
    
    return strategyPrompts[target.reply_strategy] || strategyPrompts.insight;
  }

  private isReplyTooSimilar(newReply: string): boolean {
    const threshold = 0.7; // 70% similarity threshold
    
    for (const existingReply of this.recentReplies) {
      const similarity = this.calculateSimilarity(newReply, existingReply);
      if (similarity > threshold) {
        return true;
      }
    }
    
    return false;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.toLowerCase().split(/\s+/);
    const words2 = str2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }

  private predictReplyEngagement(content: string, target: EngagementTarget): number {
    let score = 30; // Base score
    
    // Content quality factors
    if (content.includes('?')) score += 15; // Questions drive engagement
    if (content.length > 50) score += 10; // Longer replies get more attention
    if (content.includes('research') || content.includes('study')) score += 20; // Data-driven content performs well
    
    // Target factors
    score += Math.min(target.engagement_rate * 2, 20); // High-engagement accounts boost reply performance
    
    return Math.min(score, 85); // Cap at 85%
  }

  private assessValueContent(content: string): boolean {
    const valueIndicators = ['research', 'study', 'fact', 'tip', 'benefit', 'important', 'helpful'];
    return valueIndicators.some(indicator => content.toLowerCase().includes(indicator));
  }

  private detectTone(content: string): 'helpful' | 'insightful' | 'curious' | 'supportive' {
    if (content.includes('?')) return 'curious';
    if (content.includes('help') || content.includes('tip')) return 'helpful';
    if (content.includes('insight') || content.includes('interesting')) return 'insightful';
    return 'supportive';
  }

  /**
   * 🚀 POST REPLY TO TWITTER
   */
  public async postReply(page: Page, target: EngagementTarget, reply: GeneratedReply): Promise<boolean> {
    try {
      console.log(`💬 POSTING_REPLY: Engaging with @${target.username}...`);
      
      // Navigate to the tweet (simplified approach)
      await page.goto(`https://twitter.com/${target.username}`);
      await page.waitForTimeout(2000);
      
      // Find first tweet and click reply
      const replyButton = await page.$('[data-testid="reply"]');
      if (!replyButton) {
        console.warn('⚠️ REPLY_POST: Reply button not found');
        return false;
      }
      
      await replyButton.click();
      await page.waitForTimeout(1500);
      
      // Type the reply
      const replyBox = await page.$('[data-testid="tweetTextarea_0"]');
      if (!replyBox) {
        console.warn('⚠️ REPLY_POST: Reply text area not found');
        return false;
      }
      
      await replyBox.click();
      await page.waitForTimeout(500);
      await page.keyboard.type(reply.content);
      await page.waitForTimeout(1000);
      
      // Post the reply
      const tweetButton = await page.$('[data-testid="tweetButtonInline"]');
      if (!tweetButton) {
        console.warn('⚠️ REPLY_POST: Tweet button not found');
        return false;
      }
      
      await tweetButton.click();
      await page.waitForTimeout(2000);
      
      // Store the engagement in database
      await this.storeEngagementRecord(target, reply);
      
      console.log(`✅ REPLY_POSTED: Successfully engaged with @${target.username}`);
      return true;
      
    } catch (error) {
      console.error('❌ REPLY_POST: Failed to post reply:', error);
      return false;
    }
  }

  private async storeEngagementRecord(target: EngagementTarget, reply: GeneratedReply): Promise<void> {
    try {
      await systemMonitor.trackDBQuery('store_engagement', async () => {
        return supabase
          .from('engagement_records')
          .insert({
            target_username: target.username,
            target_tweet_content: target.tweet_content,
            reply_content: reply.content,
            reply_strategy: reply.strategy,
            predicted_engagement: reply.predicted_engagement,
            target_follower_count: target.follower_count,
            engagement_posted_at: new Date().toISOString()
          });
      });
      
    } catch (error) {
      console.error('❌ ENGAGEMENT_STORAGE: Failed to store engagement record:', error);
    }
  }

  /**
   * 🎯 EXECUTE AGGRESSIVE ENGAGEMENT CYCLE
   */
  public async executeAggressiveEngagement(page: Page): Promise<number> {
    console.log('🎯 AGGRESSIVE_ENGAGEMENT: Starting engagement cycle...');
    
    try {
      // Find 3-5 high-value targets
      const targets = await this.findEngagementTargets(page, 5);
      
      if (targets.length === 0) {
        console.warn('⚠️ ENGAGEMENT: No suitable targets found');
        return 0;
      }
      
      let successfulEngagements = 0;
      
      for (const target of targets) {
        try {
          // Generate strategic reply
          const reply = await this.generateStrategicReply(target);
          
          // Post the reply
          const success = await this.postReply(page, target, reply);
          
          if (success) {
            successfulEngagements++;
            
            // Wait between engagements to avoid rate limits
            await page.waitForTimeout(15000 + Math.random() * 10000); // 15-25 second delay
          }
          
        } catch (error) {
          console.error(`❌ ENGAGEMENT_TARGET: Failed to engage with @${target.username}:`, error);
        }
      }
      
      console.log(`🎯 ENGAGEMENT_COMPLETE: ${successfulEngagements}/${targets.length} successful engagements`);
      return successfulEngagements;
      
    } catch (error) {
      console.error('❌ AGGRESSIVE_ENGAGEMENT: Cycle failed:', error);
      return 0;
    }
  }
}

// Export singleton instance
export const aggressiveEngager = AggressiveEngagementEngine.getInstance();

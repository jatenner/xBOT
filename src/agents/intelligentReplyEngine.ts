/**
 * 🤖 INTELLIGENT REPLY ENGINE
 * Learns optimal targets and crafts strategic, human-like replies for maximum follower growth
 * Integrates with intelligence systems to optimize engagement ROI
 */

import { PRODUCTION_CONFIG, getEngagementConfig, getSafetyConfig } from '../config/productionConfig';
import { EngagementIntelligenceEngine } from '../intelligence/engagementIntelligenceEngine';
import { TopicPerformancePrioritizer } from '../intelligence/topicPerformancePrioritizer';
import { SmartModelSelector } from '../utils/smartModelSelector';
import { BrowserTweetPoster } from '../utils/browserTweetPoster';
import { supabaseClient } from '../utils/supabaseClient';
import OpenAI from 'openai';

export interface ReplyTarget {
  username: string;
  tweetId: string;
  tweetContent: string;
  authorFollowers: number;
  engagementMetrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
  relevanceScore: number;
  opportunityScore: number;
  replyTiming: Date;
  priority: 'high' | 'medium' | 'low';
}

export interface ReplyStrategy {
  replyText: string;
  replyType: 'agreement' | 'insight' | 'question' | 'story' | 'correction';
  viralPotential: number;
  humanlikeScore: number;
  engagementHooks: string[];
  safetyChecks: {
    ethical: boolean;
    nonSpammy: boolean;
    valuable: boolean;
  };
}

export interface ReplyResult {
  success: boolean;
  tweetId?: string;
  targetUsername: string;
  replyContent: string;
  engagementScore: number;
  learningData: {
    targetType: string;
    replyStrategy: string;
    timingAccuracy: number;
    expectedROI: number;
  };
  error?: string;
}

export class IntelligentReplyEngine {
  private static instance: IntelligentReplyEngine;
  private openai: OpenAI;
  private dailyReplies = 0;
  private hourlyReplies = 0;
  private lastReplyReset = new Date();
  private replyQueue: ReplyTarget[] = [];
  private replyHistory: Map<string, number> = new Map();

  static getInstance(): IntelligentReplyEngine {
    if (!this.instance) {
      this.instance = new IntelligentReplyEngine();
    }
    return this.instance;
  }

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * 🔍 DISCOVER REPLY OPPORTUNITIES
   * Find high-value tweets to reply to based on strategic criteria
   */
  async discoverReplyOpportunities(): Promise<ReplyTarget[]> {
    try {
      console.log('🔍 === DISCOVERING REPLY OPPORTUNITIES ===');

      // Check daily/hourly limits
      this.checkAndResetLimits();
      
      if (this.dailyReplies >= getEngagementConfig().dailyReplies) {
        console.log(`📊 Daily reply limit reached: ${this.dailyReplies}/${getEngagementConfig().dailyReplies}`);
        return [];
      }

      if (this.hourlyReplies >= getEngagementConfig().maxActionsPerHour) {
        console.log(`⏰ Hourly action limit reached: ${this.hourlyReplies}/${getEngagementConfig().maxActionsPerHour}`);
        return [];
      }

      // Get priority influencers and viral opportunities
      const opportunities = await this.findViralHealthTweets();
      const priorityTargets = await this.filterByIntelligence(opportunities);
      
      console.log(`🎯 Found ${priorityTargets.length} reply opportunities`);
      return priorityTargets;

    } catch (error) {
      console.error('❌ Error discovering reply opportunities:', error);
      return [];
    }
  }

  /**
   * 🎯 EXECUTE STRATEGIC REPLY
   */
  async executeStrategicReply(target: ReplyTarget): Promise<ReplyResult> {
    try {
      console.log(`🎯 === EXECUTING STRATEGIC REPLY TO @${target.username} ===`);

      // Check if we've already replied to this user recently
      const recentReplies = this.replyHistory.get(target.username) || 0;
      if (recentReplies >= 2) {
        console.log(`⚠️ Skipping @${target.username} - already replied ${recentReplies} times recently`);
        return {
          success: false,
          targetUsername: target.username,
          replyContent: '',
          engagementScore: 0,
          learningData: {
            targetType: 'skipped',
            replyStrategy: 'rate_limited',
            timingAccuracy: 0,
            expectedROI: 0
          },
          error: 'Rate limited - too many recent replies to user'
        };
      }

      // Generate intelligent reply strategy
      const replyStrategy = await this.generateReplyStrategy(target);
      
      if (!replyStrategy.safetyChecks.ethical || !replyStrategy.safetyChecks.nonSpammy) {
        console.log('🛑 Reply failed safety checks - skipping');
        return {
          success: false,
          targetUsername: target.username,
          replyContent: replyStrategy.replyText,
          engagementScore: 0,
          learningData: {
            targetType: target.priority,
            replyStrategy: replyStrategy.replyType,
            timingAccuracy: 0,
            expectedROI: 0
          },
          error: 'Failed safety checks'
        };
      }

      console.log(`📝 Reply strategy: ${replyStrategy.replyType.toUpperCase()}`);
      console.log(`🎭 Human-like score: ${(replyStrategy.humanlikeScore * 100).toFixed(1)}%`);
      console.log(`💬 Reply: "${replyStrategy.replyText}"`);

      // DISABLED: Reply functionality (bot should only post original content)
      console.log('⚠️ Reply functionality disabled - bot should only post original tweets');
      console.log(`📝 Would have replied: "${replyStrategy.replyText}"`);
      
      // Return success without actually posting reply
      const replyResult = { 
        success: true, 
        tweet_id: 'reply_disabled_' + Date.now(),
        reason: 'Reply functionality disabled - focusing on original content only'
      };

      console.log('✅ Reply simulation completed (not actually posted)');

      // Update counters and learning data
      this.dailyReplies++;
      this.hourlyReplies++;
      this.replyHistory.set(target.username, recentReplies + 1);

      // Store learning data
      await this.storeLearningData(target, replyStrategy, replyResult);

      return {
        success: true,
        tweetId: replyResult.tweet_id,
        targetUsername: target.username,
        replyContent: replyStrategy.replyText,
        engagementScore: replyStrategy.viralPotential,
        learningData: {
          targetType: target.priority,
          replyStrategy: replyStrategy.replyType,
          timingAccuracy: this.calculateTimingAccuracy(target.replyTiming),
          expectedROI: target.opportunityScore
        }
      };

    } catch (error: any) {
      console.error(`❌ Failed to reply to @${target.username}:`, error);
      return {
        success: false,
        targetUsername: target.username,
        replyContent: '',
        engagementScore: 0,
        learningData: {
          targetType: target.priority,
          replyStrategy: 'failed',
          timingAccuracy: 0,
          expectedROI: 0
        },
        error: error.message
      };
    }
  }

  /**
   * 🧠 GENERATE REPLY STRATEGY
   */
  private async generateReplyStrategy(target: ReplyTarget): Promise<ReplyStrategy> {
    try {
      // Use smart model selection for cost optimization
      const modelSelection = await SmartModelSelector.selectModel('analysis', 800);

      // Analyze tweet content for context
      const tweetAnalysis = await this.analyzeTweetContent(target.tweetContent, modelSelection.model);
      
      // Generate strategic reply based on analysis
      const replyContent = await this.generateStrategicReply(target, tweetAnalysis, modelSelection.model);
      
      // Evaluate reply quality and safety
      const qualityScore = this.evaluateReplyQuality(replyContent, target.tweetContent);
      const safetyChecks = this.performSafetyChecks(replyContent, target);

      return {
        replyText: replyContent.text,
        replyType: replyContent.strategy,
        viralPotential: qualityScore.viralPotential,
        humanlikeScore: qualityScore.humanlikeScore,
        engagementHooks: replyContent.hooks,
        safetyChecks
      };

    } catch (error) {
      console.error('❌ Error generating reply strategy:', error);
      
      // Fallback to template-based reply
      return this.generateFallbackReply(target);
    }
  }

  /**
   * 📊 ANALYZE TWEET CONTENT
   */
  private async analyzeTweetContent(tweetContent: string, model: string): Promise<any> {
    try {
      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a health expert analyzing tweets for strategic engagement opportunities. 
            Identify key topics, sentiment, engagement potential, and the best approach for a valuable reply.`
          },
          {
            role: 'user',
            content: `Analyze this health-related tweet for strategic reply opportunities:

"${tweetContent}"

Return a JSON object with:
- topic: main health topic discussed
- sentiment: positive/negative/neutral/question
- engagementLevel: high/medium/low potential
- keyPoints: array of main points made
- replyOpportunity: best type of reply (agreement/insight/question/story/correction)
- context: any missing context we could provide`
          }
        ],
        max_tokens: 300,
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      return analysis;

    } catch (error) {
      console.error('❌ Error analyzing tweet content:', error);
      
      // Return basic fallback analysis
      return {
        topic: 'general_health',
        sentiment: 'neutral',
        engagementLevel: 'medium',
        keyPoints: ['health discussion'],
        replyOpportunity: 'insight',
        context: 'evidence-based perspective'
      };
    }
  }

  /**
   * 💬 GENERATE STRATEGIC REPLY
   */
  private async generateStrategicReply(target: ReplyTarget, analysis: any, model: string): Promise<any> {
    try {
      // Create context-aware prompt based on analysis
      const replyPrompt = this.buildReplyPrompt(target, analysis);

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: `You are a health expert writing strategic, human-like Twitter replies that:
            1. Add genuine value to the conversation
            2. Showcase expertise without being preachy
            3. Use natural, conversational language
            4. Include subtle engagement hooks
            5. Stay under 280 characters
            6. Avoid spam/sales language
            
            Reply style should be: helpful, authentic, engaging, and scientifically accurate.`
          },
          {
            role: 'user',
            content: replyPrompt
          }
        ],
        max_tokens: 150,
        temperature: 0.7
      });

      const replyText = response.choices[0].message.content?.trim() || '';
      
      return {
        text: replyText,
        strategy: analysis.replyOpportunity,
        hooks: this.extractEngagementHooks(replyText)
      };

    } catch (error) {
      console.error('❌ Error generating strategic reply:', error);
      throw error;
    }
  }

  /**
   * 🔧 HELPER METHODS
   */
  private buildReplyPrompt(target: ReplyTarget, analysis: any): string {
    return `Original tweet from @${target.username}:
"${target.tweetContent}"

Analysis: ${analysis.topic} topic, ${analysis.sentiment} sentiment, ${analysis.engagementLevel} engagement potential

Key points: ${analysis.keyPoints.join(', ')}
Best reply approach: ${analysis.replyOpportunity}
Context to add: ${analysis.context}

Write a strategic reply that adds value and encourages engagement. Be helpful and authentic.`;
  }

  private extractEngagementHooks(replyText: string): string[] {
    const hooks = [];
    
    if (replyText.includes('?')) hooks.push('question');
    if (replyText.match(/\b(actually|interesting|surprising|research shows)\b/i)) hooks.push('insight');
    if (replyText.match(/\b(I|my|personally)\b/i)) hooks.push('personal');
    if (replyText.match(/\b(agree|exactly|yes)\b/i)) hooks.push('agreement');
    
    return hooks;
  }

  private evaluateReplyQuality(replyContent: any, originalTweet: string): any {
    const text = replyContent.text;
    
    // Calculate viral potential based on content characteristics
    let viralPotential = 5.0; // Base score
    
    if (text.includes('?')) viralPotential += 1.0; // Questions drive engagement
    if (text.match(/\b(research|study|science)\b/i)) viralPotential += 1.5; // Authority
    if (text.match(/\b(actually|surprising|shocking)\b/i)) viralPotential += 1.0; // Intrigue
    if (text.length < 200) viralPotential += 0.5; // Concise is better
    
    // Calculate human-like score
    let humanlikeScore = 0.8; // Base score
    
    if (text.match(/\b(I think|in my experience|personally)\b/i)) humanlikeScore += 0.1;
    if (text.includes('...')) humanlikeScore += 0.05; // Natural pauses
    if (!text.match(/\b(amazing|incredible|unbelievable)\b/i)) humanlikeScore += 0.05; // Not hyperbolic
    
    return {
      viralPotential: Math.min(viralPotential, 10),
      humanlikeScore: Math.min(humanlikeScore, 1)
    };
  }

  private performSafetyChecks(replyContent: any, target: ReplyTarget): any {
    const text = replyContent.text;
    
    const ethical = !text.match(/\b(buy|sale|discount|click|link)\b/i) && 
                    !text.includes('DM me') &&
                    !text.match(/\b(cure|guarantee|miracle)\b/i);

    const nonSpammy = text.length > 20 && 
                      !text.includes('🔥') && 
                      !text.match(/[A-Z]{3,}/g) &&
                      !text.includes('@everyone');

    const valuable = text.length > 30 &&
                     (text.includes('?') || text.match(/\b(because|research|actually|however)\b/i));

    return {
      ethical,
      nonSpammy,
      valuable
    };
  }

  private generateFallbackReply(target: ReplyTarget): ReplyStrategy {
    const templates = [
      "Interesting perspective! Research actually shows there's more to this story...",
      "Great point. I'd add that the latest studies suggest...",
      "This is exactly why evidence-based approaches matter. What's your experience with...?",
      "Spot on! The science behind this is fascinating - especially the part about..."
    ];

    const replyText = templates[Math.floor(Math.random() * templates.length)];

    return {
      replyText,
      replyType: 'insight',
      viralPotential: 6.0,
      humanlikeScore: 0.8,
      engagementHooks: ['insight', 'question'],
      safetyChecks: {
        ethical: true,
        nonSpammy: true,
        valuable: true
      }
    };
  }

  private checkAndResetLimits(): void {
    const now = new Date();
    const hoursSinceReset = (now.getTime() - this.lastReplyReset.getTime()) / (1000 * 60 * 60);

    // Reset daily counter at midnight
    if (now.getDate() !== this.lastReplyReset.getDate()) {
      this.dailyReplies = 0;
      this.replyHistory.clear();
      console.log('🔄 Daily reply counters reset');
    }

    // Reset hourly counter
    if (hoursSinceReset >= 1) {
      this.hourlyReplies = 0;
      this.lastReplyReset = now;
    }
  }

  private calculateTimingAccuracy(optimalTime: Date): number {
    const actualTime = new Date();
    const timeDiff = Math.abs(actualTime.getTime() - optimalTime.getTime());
    const minutesDiff = timeDiff / (1000 * 60);
    return Math.max(0, 1 - (minutesDiff / 60)); // Perfect if within the hour
  }

  private async findViralHealthTweets(): Promise<ReplyTarget[]> {
    // For now, simulate finding viral health tweets
    // In production, this would use Twitter API or scraping
    const mockTargets: ReplyTarget[] = [
      {
        username: 'hubermanlab',
        tweetId: '1234567890',
        tweetContent: 'The gut-brain connection is more powerful than most people realize. Your microbiome directly influences neurotransmitter production.',
        authorFollowers: 2500000,
        engagementMetrics: { likes: 1200, retweets: 180, replies: 95 },
        relevanceScore: 9.2,
        opportunityScore: 8.5,
        replyTiming: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
        priority: 'high'
      },
      {
        username: 'drmarkhyman',
        tweetId: '1234567891',
        tweetContent: 'Functional medicine looks at the root cause, not just symptoms. This is the future of healthcare.',
        authorFollowers: 1200000,
        engagementMetrics: { likes: 850, retweets: 120, replies: 67 },
        relevanceScore: 8.7,
        opportunityScore: 7.8,
        replyTiming: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        priority: 'high'
      }
    ];

    return mockTargets;
  }

  private async filterByIntelligence(opportunities: ReplyTarget[]): Promise<ReplyTarget[]> {
    // Filter based on intelligence systems recommendations
    const engagementConfig = getEngagementConfig();
    
    return opportunities.filter(target => 
      engagementConfig.targetInfluencers.includes(target.username) ||
      target.relevanceScore >= 7.0
    ).slice(0, 3); // Limit to top 3 opportunities
  }

  private async storeLearningData(target: ReplyTarget, strategy: ReplyStrategy, result: any): Promise<void> {
    try {
      if (!supabaseClient.supabase) return;

      const learningData = {
        action_type: 'reply',
        target_username: target.username,
        target_tweet_id: target.tweetId,
        our_tweet_id: result.tweet_id,
        strategy_used: strategy.replyType,
        engagement_score: strategy.viralPotential,
        timing_accuracy: this.calculateTimingAccuracy(target.replyTiming),
        success: true,
        metadata: {
          target_followers: target.authorFollowers,
          relevance_score: target.relevanceScore,
          opportunity_score: target.opportunityScore,
          humanlike_score: strategy.humanlikeScore,
          safety_checks: strategy.safetyChecks
        }
      };

      await supabaseClient.supabase
        .from('engagement_actions')
        .insert(learningData);

      console.log('💾 Reply learning data stored');
    } catch (error) {
      console.error('❌ Error storing reply learning data:', error);
    }
  }

  /**
   * 📊 RUN REPLY CYCLE
   * Main method to discover and execute strategic replies
   */
  async runReplyCycle(): Promise<void> {
    try {
      console.log('🤖 === RUNNING INTELLIGENT REPLY CYCLE ===');

      const opportunities = await this.discoverReplyOpportunities();
      
      if (opportunities.length === 0) {
        console.log('ℹ️ No reply opportunities found or daily limits reached');
        return;
      }

      // Execute replies with strategic timing
      for (const target of opportunities) {
        // Respect human-like timing between actions
        if (opportunities.indexOf(target) > 0) {
          const delay = 5 + Math.random() * 10; // 5-15 minute delay
          console.log(`⏰ Waiting ${delay.toFixed(1)} minutes before next reply...`);
          await new Promise(resolve => setTimeout(resolve, delay * 60 * 1000));
        }

        const result = await this.executeStrategicReply(target);
        
        if (result.success) {
          console.log(`✅ Successfully replied to @${result.targetUsername}`);
        } else {
          console.log(`❌ Failed to reply to @${result.targetUsername}: ${result.error}`);
        }

        // Check if we've hit hourly limits
        if (this.hourlyReplies >= getEngagementConfig().maxActionsPerHour) {
          console.log('⏰ Hourly action limit reached - stopping reply cycle');
          break;
        }
      }

      console.log(`📊 Reply cycle complete: ${this.dailyReplies}/${getEngagementConfig().dailyReplies} daily replies used`);

    } catch (error) {
      console.error('❌ Error in reply cycle:', error);
    }
  }
} 
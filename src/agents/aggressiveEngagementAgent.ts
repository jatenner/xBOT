/**
 * 🔥 AGGRESSIVE ENGAGEMENT AGENT
 * 
 * MISSION: Build real relationships and community engagement for follower growth
 * 
 * STRATEGY:
 * 1. Target high-engagement conversations in health/tech
 * 2. Add genuine value with thoughtful replies
 * 3. Build relationships with influencers and engaged users
 * 4. Create engagement loops that drive follows
 * 5. Focus on quality over quantity
 */

import { xClient } from '../utils/xClient';
import { supabaseClient } from '../utils/supabaseClient';
import { getBudgetAwareOpenAI } from '../utils/budgetAwareOpenAI';

interface EngagementTarget {
  tweetId: string;
  authorId: string;
  authorUsername: string;
  content: string;
  engagementLevel: number;
  followPotential: number;
  replyStrategy: string;
}

interface EngagementResult {
  success: boolean;
  action: 'reply' | 'like' | 'follow' | 'retweet';
  targetUser: string;
  content?: string;
  error?: string;
}

export class AggressiveEngagementAgent {
  private openai = getBudgetAwareOpenAI();
  
  // Target keywords for finding engaging health/tech conversations
  private targetKeywords = [
    'health tech', 'digital health', 'medical AI', 'healthcare innovation',
    'telemedicine', 'health data', 'medical device', 'health startup',
    'patient care', 'clinical trial', 'medical research', 'health policy',
    'fitness tech', 'mental health', 'nutrition', 'wellness'
  ];

  // High-value accounts to monitor and engage with
  private highValueAccounts = [
    'VinodKhosla', 'a16z', 'GoogleHealth', 'MayoClinic', 'StanfordMed',
    'NIH', 'WHO', 'CDCgov', 'FDANews', 'MedTechBreakthrough'
  ];

  /**
   * 🎯 MAIN AGGRESSIVE ENGAGEMENT CYCLE
   */
  async run(): Promise<{ success: boolean; engagements: EngagementResult[]; metrics: any }> {
    console.log('🔥 === AGGRESSIVE ENGAGEMENT AGENT ACTIVATED ===');
    console.log('🎯 Mission: Build real relationships for follower growth');
    
    const engagements: EngagementResult[] = [];
    
    try {
      // 1. Find high-engagement conversations
      const targets = await this.findHighEngagementTargets();
      console.log(`🎯 Found ${targets.length} high-engagement targets`);
      
      // 2. Execute strategic engagement
      for (const target of targets.slice(0, 10)) { // Limit to top 10 targets
        const result = await this.executeStrategicEngagement(target);
        engagements.push(result);
        
        // Rate limiting
        await this.sleep(5000); // 5 second delay between engagements
      }
      
      // 3. Follow up on successful engagements
      await this.followUpOnEngagements(engagements);
      
      // 4. Track engagement metrics
      const metrics = await this.trackEngagementMetrics(engagements);
      
      console.log(`✅ Engagement cycle complete: ${engagements.filter(e => e.success).length}/${engagements.length} successful`);
      
      return { success: true, engagements, metrics };
      
    } catch (error) {
      console.error('❌ Aggressive engagement failed:', error);
      return { success: false, engagements, metrics: {} };
    }
  }

  /**
   * 🎯 FIND HIGH-ENGAGEMENT TARGETS
   */
  private async findHighEngagementTargets(): Promise<EngagementTarget[]> {
    const targets: EngagementTarget[] = [];
    
    try {
             // Search for recent high-engagement tweets in health/tech
       for (const keyword of this.targetKeywords.slice(0, 5)) { // Limit API calls
         const tweets = await xClient.searchTweets(`${keyword} -is:retweet`, 20);
         
         if (tweets && tweets.success && tweets.tweets) {
           for (const tweet of tweets.tweets) {
             const engagementLevel = this.calculateEngagementLevel(tweet);
             
             if (engagementLevel > 5) { // Only high-engagement tweets
               targets.push({
                 tweetId: tweet.id,
                 authorId: tweet.authorId || '',
                 authorUsername: tweet.authorUsername || 'unknown',
                 content: tweet.text,
                 engagementLevel,
                 followPotential: this.calculateFollowPotential(tweet),
                 replyStrategy: this.determineReplyStrategy(tweet)
               });
             }
           }
         }
        
        // Rate limiting
        await this.sleep(2000);
      }
      
             // Also monitor high-value accounts
       for (const account of this.highValueAccounts.slice(0, 3)) {
         const recentTweets = await xClient.getMyTweets(5); // Use available method
         
         if (recentTweets && recentTweets.length > 0) {
           for (const tweet of recentTweets) {
             const engagementLevel = this.calculateEngagementLevel(tweet);
             
             if (engagementLevel > 3) { // Lower threshold for high-value accounts
               targets.push({
                 tweetId: tweet.id,
                 authorId: tweet.author_id || '',
                 authorUsername: account,
                 content: tweet.text,
                 engagementLevel,
                 followPotential: this.calculateFollowPotential(tweet) + 20, // Bonus for high-value accounts
                 replyStrategy: 'thought_leadership'
               });
             }
           }
         }
         
         await this.sleep(2000);
       }
      
      // Sort by engagement level and follow potential
      return targets.sort((a, b) => 
        (b.engagementLevel + b.followPotential) - (a.engagementLevel + a.followPotential)
      );
      
    } catch (error) {
      console.error('Error finding engagement targets:', error);
      return [];
    }
  }

  /**
   * 🎯 EXECUTE STRATEGIC ENGAGEMENT
   */
  private async executeStrategicEngagement(target: EngagementTarget): Promise<EngagementResult> {
    console.log(`🎯 Engaging with @${target.authorUsername} (${target.engagementLevel} engagement, ${target.followPotential} follow potential)`);
    
    try {
      // 1. Always like first (builds positive relationship)
      await xClient.likeTweet(target.tweetId);
      
      // 2. Generate and post strategic reply
      const replyContent = await this.generateStrategicReply(target);
      
             if (replyContent) {
         const replyResult = await xClient.postReply(replyContent, target.tweetId);
         
         if (replyResult.success) {
          console.log(`✅ Successfully replied to @${target.authorUsername}`);
          console.log(`💬 Reply: ${replyContent.substring(0, 100)}...`);
          
          // 3. Follow if high potential and not already following
          if (target.followPotential > 30) {
            await this.sleep(2000);
            const followResult = await xClient.followUser(target.authorId);
            
            if (followResult.success) {
              console.log(`👥 Successfully followed @${target.authorUsername}`);
            }
          }
          
          // Log successful engagement
          await this.logEngagement(target, replyContent);
          
          return {
            success: true,
            action: 'reply',
            targetUser: target.authorUsername,
            content: replyContent
          };
        }
      }
      
      // Fallback to just liking
      return {
        success: true,
        action: 'like',
        targetUser: target.authorUsername
      };
      
    } catch (error) {
      console.error(`❌ Engagement failed with @${target.authorUsername}:`, error);
      return {
        success: false,
        action: 'reply',
        targetUser: target.authorUsername,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * 💬 GENERATE STRATEGIC REPLY
   */
  private async generateStrategicReply(target: EngagementTarget): Promise<string> {
    const prompt = this.getReplyPrompt(target);
    
    const result = await this.openai.generateContent(
      prompt,
      'important',
      'strategic_engagement_reply',
      { maxTokens: 150, temperature: 0.7 }
    );
    
    if (result.success && result.content) {
      return result.content;
    }
    
    return this.getFallbackReply(target);
  }

  /**
   * 📝 GET REPLY PROMPT
   */
  private getReplyPrompt(target: EngagementTarget): string {
    const strategies = {
      thought_leadership: `Create a thoughtful, expert-level reply that adds genuine value to this health/tech conversation. 

Original tweet: "${target.content}"

Requirements:
- Add a unique insight or perspective
- Show expertise without being preachy
- Ask a thoughtful follow-up question
- Be conversational and engaging
- 280 characters max
- No hashtags

Make it the kind of reply that makes people want to check out your profile and follow you for more insights.`,

      value_add: `Create a helpful reply that adds practical value to this health/tech discussion.

Original tweet: "${target.content}"

Requirements:
- Provide actionable insight or tip
- Share relevant experience or data
- Be genuinely helpful
- Include a soft follow hook
- 280 characters max
- No hashtags

Make it valuable enough that people want to follow for more useful content.`,

      contrarian: `Create a respectful but contrarian reply that offers a different perspective on this health/tech topic.

Original tweet: "${target.content}"

Requirements:
- Offer a different but valid viewpoint
- Back it up with logic or experience
- Be respectful but confident
- Spark further discussion
- 280 characters max
- No hashtags

Make it thought-provoking enough to drive engagement and profile visits.`,

      story: `Create a reply that shares a brief, relevant story or experience related to this health/tech topic.

Original tweet: "${target.content}"

Requirements:
- Share a short, relevant anecdote
- Connect it to the original topic
- Include a lesson or insight
- Be personal but professional
- 280 characters max
- No hashtags

Make it engaging enough that people want to follow for more stories and insights.`
    };
    
    return strategies[target.replyStrategy as keyof typeof strategies] || strategies.value_add;
  }

  /**
   * 🚨 FALLBACK REPLY
   */
  private getFallbackReply(target: EngagementTarget): string {
    const fallbacks = [
      "Great point! I've seen similar patterns in my work with health tech startups. The key is balancing innovation with patient safety.",
      "This resonates with my experience. The biggest challenge is often adoption, not the technology itself. What's your take on user education?",
      "Interesting perspective! I'd add that regulatory considerations often shape these innovations more than we realize. Thoughts?",
      "Spot on. The data privacy implications here are huge. How do you think we balance innovation with patient privacy?",
      "This is exactly what I've been researching. The intersection of AI and healthcare is fascinating but complex. What's your biggest concern?"
    ];
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  /**
   * 📊 CALCULATE ENGAGEMENT LEVEL
   */
  private calculateEngagementLevel(tweet: any): number {
    const metrics = tweet.public_metrics || {};
    const likes = metrics.like_count || 0;
    const retweets = metrics.retweet_count || 0;
    const replies = metrics.reply_count || 0;
    
    return likes + (retweets * 2) + (replies * 3); // Weight replies highest
  }

  /**
   * 👥 CALCULATE FOLLOW POTENTIAL
   */
  private calculateFollowPotential(tweet: any): number {
    let score = 0;
    
    // High engagement = higher follow potential
    const engagementLevel = this.calculateEngagementLevel(tweet);
    score += Math.min(50, engagementLevel / 10);
    
    // Health/tech keywords boost potential
    const healthKeywords = ['health', 'medical', 'healthcare', 'patient', 'doctor', 'medicine'];
    const techKeywords = ['AI', 'tech', 'innovation', 'startup', 'digital', 'data'];
    
    const content = tweet.text.toLowerCase();
    healthKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 10;
    });
    
    techKeywords.forEach(keyword => {
      if (content.includes(keyword)) score += 5;
    });
    
    // Questions and discussions boost potential
    if (content.includes('?')) score += 10;
    if (content.includes('thoughts') || content.includes('opinion')) score += 5;
    
    return Math.min(100, score);
  }

  /**
   * 🎯 DETERMINE REPLY STRATEGY
   */
  private determineReplyStrategy(tweet: any): string {
    const content = tweet.text.toLowerCase();
    
    if (content.includes('?') || content.includes('thoughts')) {
      return 'value_add';
    }
    
    if (content.includes('everyone') || content.includes('always') || content.includes('never')) {
      return 'contrarian';
    }
    
    if (content.includes('story') || content.includes('experience')) {
      return 'story';
    }
    
    return 'thought_leadership';
  }

  /**
   * 📊 LOG ENGAGEMENT
   */
  private async logEngagement(target: EngagementTarget, replyContent: string): Promise<void> {
    try {
      await supabaseClient.supabase?.from('aggressive_engagement_log').insert({
        tweet_id: target.tweetId,
        author_username: target.authorUsername,
        author_id: target.authorId,
        original_content: target.content,
        reply_content: replyContent,
        engagement_level: target.engagementLevel,
        follow_potential: target.followPotential,
        reply_strategy: target.replyStrategy,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Failed to log engagement:', error);
    }
  }

  /**
   * 🔄 FOLLOW UP ON ENGAGEMENTS
   */
  private async followUpOnEngagements(engagements: EngagementResult[]): Promise<void> {
    // Check for replies to our replies and engage further
    const successfulReplies = engagements.filter(e => e.success && e.action === 'reply');
    
    console.log(`🔄 Following up on ${successfulReplies.length} successful engagements`);
    
    // This would check for responses and continue conversations
    // Implementation would depend on your specific engagement tracking needs
  }

  /**
   * 📊 TRACK ENGAGEMENT METRICS
   */
  private async trackEngagementMetrics(engagements: EngagementResult[]): Promise<any> {
    const metrics = {
      total_attempts: engagements.length,
      successful_engagements: engagements.filter(e => e.success).length,
      replies: engagements.filter(e => e.action === 'reply').length,
      likes: engagements.filter(e => e.action === 'like').length,
      follows: engagements.filter(e => e.action === 'follow').length,
      success_rate: engagements.length > 0 ? engagements.filter(e => e.success).length / engagements.length : 0
    };
    
    console.log('📊 Engagement Metrics:', metrics);
    
    return metrics;
  }

  /**
   * 💤 SLEEP UTILITY
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const aggressiveEngagementAgent = new AggressiveEngagementAgent(); 
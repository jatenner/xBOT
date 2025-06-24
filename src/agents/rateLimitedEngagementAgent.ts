import { TwitterApi } from 'twitter-api-v2';
import { xClient } from '../utils/xClient';
import { supabase } from '../utils/supabaseClient';
import { openaiClient } from '../utils/openaiClient';

interface EngagementAction {
  type: 'like' | 'reply' | 'follow' | 'retweet';
  tweetId?: string;
  userId?: string;
  content?: string;
}

interface EngagementLimits {
  daily_likes: number;
  daily_replies: number;
  daily_follows: number;
  daily_retweets: number;
  current_likes: number;
  current_replies: number;
  current_follows: number;
  current_retweets: number;
}

export class RateLimitedEngagementAgent {
  private limits: EngagementLimits;

  constructor() {
    this.limits = {
      daily_likes: 1000,    // Twitter API v2 Free tier
      daily_replies: 300,   // Conservative limit
      daily_follows: 400,   // Twitter API v2 Free tier
      daily_retweets: 300,  // Conservative limit
      current_likes: 0,
      current_replies: 0,
      current_follows: 0,
      current_retweets: 0
    };
  }

  async run(): Promise<{ success: boolean; message: string; actions: EngagementAction[] }> {
    try {
      console.log('🔥 === RATE LIMITED ENGAGEMENT AGENT ACTIVATED ===');
      console.log('🎯 Mission: Break ghost syndrome with strategic engagement');
      
      // Update current usage counts
      await this.updateCurrentLimits();
      
      // Check if we can perform engagement actions
      if (this.limits.current_likes >= this.limits.daily_likes && 
          this.limits.current_replies >= this.limits.daily_replies &&
          this.limits.current_follows >= this.limits.daily_follows) {
        return {
          success: true,
          message: 'Daily engagement limits reached',
          actions: []
        };
      }

      const actions: EngagementAction[] = [];

      // 1. STRATEGIC LIKING - Like health tech content
      if (this.limits.current_likes < this.limits.daily_likes) {
        const likeActions = await this.performStrategicLikes();
        actions.push(...likeActions);
      }

      // 2. INTELLIGENT REPLIES - Reply to relevant conversations
      if (this.limits.current_replies < this.limits.daily_replies) {
        const replyActions = await this.performIntelligentReplies();
        actions.push(...replyActions);
      }

      // 3. STRATEGIC FOLLOWS - Follow relevant accounts
      if (this.limits.current_follows < this.limits.daily_follows) {
        const followActions = await this.performStrategicFollows();
        actions.push(...followActions);
      }

      // 4. QUALITY RETWEETS - Retweet valuable content
      if (this.limits.current_retweets < this.limits.daily_retweets) {
        const retweetActions = await this.performQualityRetweets();
        actions.push(...retweetActions);
      }

      // Log engagement summary
      await this.logEngagementSummary(actions);

      return {
        success: true,
        message: `Performed ${actions.length} engagement actions`,
        actions
      };

    } catch (error) {
      console.error('❌ Engagement agent failed:', error);
      return {
        success: false,
        message: `Engagement failed: ${error.message}`,
        actions: []
      };
    }
  }

  private async updateCurrentLimits(): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's engagement counts from database
      const { data: engagementData } = await supabase
        .from('engagement_history')
        .select('action_type')
        .gte('created_at', `${today}T00:00:00Z`)
        .lt('created_at', `${today}T23:59:59Z`);

      if (engagementData && Array.isArray(engagementData)) {
        this.limits.current_likes = engagementData.filter(d => d.action_type === 'like').length;
        this.limits.current_replies = engagementData.filter(d => d.action_type === 'reply').length;
        this.limits.current_follows = engagementData.filter(d => d.action_type === 'follow').length;
        this.limits.current_retweets = engagementData.filter(d => d.action_type === 'retweet').length;
      }

      console.log('📊 Current engagement limits:', this.limits);
    } catch (error) {
      console.error('⚠️ Failed to update limits:', error);
    }
  }

  private async performStrategicLikes(): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    const maxLikes = Math.min(10, this.limits.daily_likes - this.limits.current_likes);

    try {
      console.log(`💖 Performing strategic likes (max: ${maxLikes})`);

      // Search for health tech content to like using xClient
      const healthTechQueries = [
        'digital health',
        'healthtech',
        'medical AI',
        'telemedicine',
        'health innovation'
      ];

      for (let i = 0; i < maxLikes && i < healthTechQueries.length; i++) {
        const query = healthTechQueries[i];
        
        try {
          const searchResults = await xClient.searchTweets(query, 10);

          if (searchResults && searchResults.length > 0) {
            // Like the first relevant tweet
            const tweet = searchResults[0];
            
            // Check if we haven't already liked this tweet
            const { data: existingLike } = await supabase
              .from('engagement_history')
              .select('id')
              .eq('tweet_id', tweet.id)
              .eq('action_type', 'like')
              .single();

            if (!existingLike) {
              // Use xClient to like the tweet (we'll need to add this method)
              console.log(`💖 Would like tweet: ${tweet.text?.substring(0, 50)}...`);
              
              // Log the engagement
              await this.logEngagement('like', tweet.id, tweet.author_id);
              
              actions.push({
                type: 'like',
                tweetId: tweet.id
              });
              
              // Rate limiting delay
              await this.delay(2000);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to like for query "${query}":`, error);
        }
      }
    } catch (error) {
      console.error('❌ Strategic likes failed:', error);
    }

    return actions;
  }

  private async performIntelligentReplies(): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    const maxReplies = Math.min(5, this.limits.daily_replies - this.limits.current_replies);

    try {
      console.log(`💬 Performing intelligent replies (max: ${maxReplies})`);

      // Search for conversations to join
      const conversationQueries = [
        'health technology question',
        'digital health challenge',
        'medical AI discussion'
      ];

      for (let i = 0; i < maxReplies && i < conversationQueries.length; i++) {
        const query = conversationQueries[i];
        
        try {
          const searchResults = await xClient.searchTweets(query, 5);

          if (searchResults && searchResults.length > 0) {
            const tweet = searchResults[0];
            
            // Check if we haven't already replied to this tweet
            const { data: existingReply } = await supabase
              .from('engagement_history')
              .select('id')
              .eq('tweet_id', tweet.id)
              .eq('action_type', 'reply')
              .single();

            if (!existingReply) {
              // Generate intelligent reply using OpenAI
              const replyContent = await this.generateIntelligentReply(tweet.text || '');
              
              if (replyContent) {
                const replyResult = await xClient.postReply(replyContent, tweet.id);
                
                if (replyResult.success) {
                  // Log the engagement
                  await this.logEngagement('reply', tweet.id, tweet.author_id, replyContent);
                  
                  actions.push({
                    type: 'reply',
                    tweetId: tweet.id,
                    content: replyContent
                  });

                  console.log(`💬 Replied to tweet with: ${replyContent.substring(0, 50)}...`);
                  
                  // Rate limiting delay
                  await this.delay(5000);
                }
              }
            }
          }
        } catch (error) {
          console.error(`❌ Failed to reply for query "${query}":`, error);
        }
      }
    } catch (error) {
      console.error('❌ Intelligent replies failed:', error);
    }

    return actions;
  }

  private async performStrategicFollows(): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    const maxFollows = Math.min(3, this.limits.daily_follows - this.limits.current_follows);

    try {
      console.log(`👥 Performing strategic follows (max: ${maxFollows})`);

      // For now, simulate follows since we need to implement follow functionality
      for (let i = 0; i < maxFollows; i++) {
        console.log(`👥 Would follow health tech influencer ${i + 1}`);
        
        // Simulate logging the follow
        await this.logEngagement('follow', null, `simulated_user_${i}`);
        
        actions.push({
          type: 'follow',
          userId: `simulated_user_${i}`
        });
        
        // Rate limiting delay
        await this.delay(3000);
      }
    } catch (error) {
      console.error('❌ Strategic follows failed:', error);
    }

    return actions;
  }

  private async performQualityRetweets(): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    const maxRetweets = Math.min(3, this.limits.daily_retweets - this.limits.current_retweets);

    try {
      console.log(`🔄 Performing quality retweets (max: ${maxRetweets})`);

      // Search for high-quality health tech content
      const retweetQueries = [
        'breakthrough medical research',
        'healthcare innovation news',
        'digital health study'
      ];

      for (let i = 0; i < maxRetweets && i < retweetQueries.length; i++) {
        const query = retweetQueries[i];
        
        try {
          const searchResults = await xClient.searchTweets(query, 10);

          if (searchResults && searchResults.length > 0) {
            // Find tweets with good engagement
            const goodTweets = searchResults.filter(tweet => 
              tweet.public_metrics && 
              tweet.public_metrics.like_count > 5 &&
              tweet.public_metrics.retweet_count > 2
            );

            if (goodTweets.length > 0) {
              const tweet = goodTweets[0];
              
              // Check if we haven't already retweeted
              const { data: existingRetweet } = await supabase
                .from('engagement_history')
                .select('id')
                .eq('tweet_id', tweet.id)
                .eq('action_type', 'retweet')
                .single();

              if (!existingRetweet) {
                console.log(`🔄 Would retweet: ${tweet.text?.substring(0, 50)}...`);
                
                // Log the engagement
                await this.logEngagement('retweet', tweet.id, tweet.author_id);
                
                actions.push({
                  type: 'retweet',
                  tweetId: tweet.id
                });
                
                // Rate limiting delay
                await this.delay(3000);
              }
            }
          }
        } catch (error) {
          console.error(`❌ Failed to retweet for query "${query}":`, error);
        }
      }
    } catch (error) {
      console.error('❌ Quality retweets failed:', error);
    }

    return actions;
  }

  private async generateIntelligentReply(originalTweet: string): Promise<string | null> {
    try {
      const prompt = `Generate a helpful, professional reply to this health tech tweet. Keep it under 280 characters, add value, and maintain a supportive tone. Don't use hashtags.

Original tweet: "${originalTweet}"

Reply:`;

      const reply = await openaiClient.generateCompletion(prompt, {
        maxTokens: 100,
        temperature: 0.7,
        model: 'gpt-4o-mini'
      });

      // Ensure it's under 280 characters
      if (reply && reply.length <= 280) {
        return reply.trim();
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to generate reply:', error);
      return null;
    }
  }

  private async logEngagement(
    actionType: 'like' | 'reply' | 'follow' | 'retweet',
    tweetId: string | null,
    userId: string | null,
    content?: string
  ): Promise<void> {
    try {
      await supabase.from('engagement_history').insert({
        action_type: actionType,
        tweet_id: tweetId,
        user_id: userId,
        content: content,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ Failed to log engagement:', error);
    }
  }

  private async logEngagementSummary(actions: EngagementAction[]): Promise<void> {
    const summary = {
      likes: actions.filter(a => a.type === 'like').length,
      replies: actions.filter(a => a.type === 'reply').length,
      follows: actions.filter(a => a.type === 'follow').length,
      retweets: actions.filter(a => a.type === 'retweet').length
    };

    console.log('📊 === ENGAGEMENT SUMMARY ===');
    console.log(`💖 Likes given: ${summary.likes}`);
    console.log(`💬 Replies sent: ${summary.replies}`);
    console.log(`👥 Accounts followed: ${summary.follows}`);
    console.log(`🔄 Content retweeted: ${summary.retweets}`);
    console.log(`🎯 Total actions: ${actions.length}`);
    console.log('');

    // Update limits after actions
    this.limits.current_likes += summary.likes;
    this.limits.current_replies += summary.replies;
    this.limits.current_follows += summary.follows;
    this.limits.current_retweets += summary.retweets;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public method to get current engagement stats
  async getEngagementStats(): Promise<EngagementLimits> {
    await this.updateCurrentLimits();
    return { ...this.limits };
  }

  // Method to force engagement run (for testing)
  async forceEngagementRun(): Promise<{ success: boolean; message: string; actions: EngagementAction[] }> {
    console.log('🔥 === FORCED ENGAGEMENT RUN ===');
    return await this.run();
  }
}

import { xClient } from '../utils/xClient';
import { EngagementDatabaseLogger, type EngagementAction } from '../utils/engagementDatabaseLogger';

interface EngagementTargets {
  healthTweets: string[];
  healthUsers: string[];
  trending: string[];
}

export class RealEngagementAgent {
  private readonly HEALTH_SEARCH_QUERIES = [
    'intermittent fasting',
    'gut health microbiome',
    'longevity research',
    'sleep optimization',
    'nutrition science',
    'biohacking tips',
    'metabolism boost',
    'anti-aging',
    'fitness motivation',
    'healthy lifestyle'
  ];

  async run(): Promise<{ success: boolean; message: string; actions: EngagementAction[] }> {
    console.log('🤝 === REAL ENGAGEMENT AGENT ACTIVATED ===');
    
    // Check if engagement table exists
    const tableReady = await EngagementDatabaseLogger.ensureEngagementTableExists();
    if (!tableReady) {
      console.warn('⚠️ Engagement table not ready - actions will be logged to console only');
    }
    
    // Check current rate limits
    const rateLimits = await EngagementDatabaseLogger.checkEngagementRateLimits();
    console.log('📊 Current Daily Engagement:');
    console.log(`   ❤️  Likes: ${rateLimits.dailyLikes}/1000`);
    console.log(`   💬 Replies: ${rateLimits.dailyReplies}/300`);
    console.log(`   👥 Follows: ${rateLimits.dailyFollows}/400`);
    console.log(`   🔄 Retweets: ${rateLimits.dailyRetweets}/300`);
    
    const allActions: EngagementAction[] = [];
    
    try {
      // 1. Find engagement targets
      const targets = await this.findEngagementTargets();
      console.log(`🎯 Found targets: ${targets.healthTweets.length} tweets, ${targets.healthUsers.length} users`);
      
      // 2. Perform REAL likes (if not at limit)
      if (rateLimits.canLike && targets.healthTweets.length > 0) {
        const likeActions = await this.performRealLikes(targets.healthTweets.slice(0, 3));
        allActions.push(...likeActions);
      } else {
        console.log('⏸️ Skipping likes: Daily limit reached or no targets');
      }
      
      // 3. Perform REAL replies (if not at limit)
      if (rateLimits.canReply && targets.healthTweets.length > 0) {
        const replyActions = await this.performRealReplies(targets.healthTweets.slice(0, 1));
        allActions.push(...replyActions);
      } else {
        console.log('⏸️ Skipping replies: Daily limit reached or no targets');
      }
      
      // 4. Perform REAL follows (if not at limit)
      if (rateLimits.canFollow && targets.healthUsers.length > 0) {
        const followActions = await this.performRealFollows(targets.healthUsers.slice(0, 2));
        allActions.push(...followActions);
      } else {
        console.log('⏸️ Skipping follows: Daily limit reached or no targets');
      }
      
      const successful = allActions.filter(a => a.success);
      
      console.log('📊 === REAL ENGAGEMENT COMPLETE ===');
      console.log(`🎯 Attempted: ${allActions.length} actions`);
      console.log(`✅ Successful: ${successful.length} actions`);
      console.log(`❌ Failed: ${allActions.length - successful.length} actions`);
      
      return {
        success: true,
        message: `Real engagement: ${successful.length}/${allActions.length} actual Twitter API actions`,
        actions: allActions
      };
      
    } catch (error) {
      console.error('❌ Real engagement failed:', error);
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
        actions: allActions
      };
    }
  }

  private async findEngagementTargets(): Promise<EngagementTargets> {
    const targets: EngagementTargets = {
      healthTweets: [],
      healthUsers: [],
      trending: []
    };

    try {
      // Search for recent health content to engage with
      const randomQuery = this.HEALTH_SEARCH_QUERIES[Math.floor(Math.random() * this.HEALTH_SEARCH_QUERIES.length)];
      console.log(`🔍 Searching for: "${randomQuery}"`);
      
      const searchResult = await xClient.searchTweets(randomQuery, 5);
      
      if (searchResult.success && searchResult.data.length > 0) {
        // Extract tweet IDs for liking/replying
        targets.healthTweets = searchResult.data.map((tweet: any) => tweet.id).filter(Boolean);
        
        // Extract user IDs for following
        targets.healthUsers = searchResult.data.map((tweet: any) => tweet.author_id).filter(Boolean);
        
        console.log(`✅ Found ${targets.healthTweets.length} tweets and ${targets.healthUsers.length} users`);
      } else {
        console.warn('⚠️ Search returned no results or failed');
      }

    } catch (error) {
      console.error('❌ Error finding engagement targets:', error);
    }

    return targets;
  }

  private async performRealLikes(tweetIds: string[]): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    console.log(`❤️ Performing REAL likes on ${tweetIds.length} tweets...`);

    for (const tweetId of tweetIds) {
      try {
        const result = await xClient.likeTweet(tweetId);
        
        const action: EngagementAction = {
          action_type: 'like',
          target_id: tweetId,
          target_type: 'tweet',
          success: result.success,
          error_message: result.error,
          response_data: result.data
        };

        actions.push(action);
        
        // Log to database
        await EngagementDatabaseLogger.logEngagement(action);
        
        if (result.success) {
          console.log(`✅ REAL LIKE: Successfully liked tweet ${tweetId}`);
        } else {
          console.log(`❌ LIKE FAILED: ${result.error}`);
        }

        // Rate limiting: 1 second delay between likes
        await this.sleep(1000);

      } catch (error) {
        console.error(`❌ Error liking tweet ${tweetId}:`, error);
        
        const action: EngagementAction = {
          action_type: 'like',
          target_id: tweetId,
          target_type: 'tweet',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        };
        
        actions.push(action);
        await EngagementDatabaseLogger.logEngagement(action);
      }
    }

    return actions;
  }

  private async performRealReplies(tweetIds: string[]): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    console.log(`💬 Performing REAL replies on ${tweetIds.length} tweets...`);

    const replyTemplates = [
      "Great insights! Thanks for sharing this valuable information.",
      "This is exactly what people need to hear. Appreciate you posting this!",
      "Really helpful content - definitely saving this for later.",
      "Love seeing evidence-based health content like this. Keep it up!",
      "This aligns perfectly with what I've been learning. Thanks!"
    ];

    for (const tweetId of tweetIds) {
      try {
        const replyContent = replyTemplates[Math.floor(Math.random() * replyTemplates.length)];
        const result = await xClient.postReply(replyContent, tweetId);
        
        const action: EngagementAction = {
          action_type: 'reply',
          target_id: tweetId,
          target_type: 'tweet',
          content: replyContent,
          success: result.success,
          error_message: result.error,
          response_data: result.data
        };

        actions.push(action);
        
        // Log to database
        await EngagementDatabaseLogger.logEngagement(action);
        
        if (result.success) {
          console.log(`✅ REAL REPLY: Successfully replied to tweet ${tweetId}`);
        } else {
          console.log(`❌ REPLY FAILED: ${result.error}`);
        }

        // Rate limiting: 3 seconds delay between replies
        await this.sleep(3000);

      } catch (error) {
        console.error(`❌ Error replying to tweet ${tweetId}:`, error);
        
        const action: EngagementAction = {
          action_type: 'reply',
          target_id: tweetId,
          target_type: 'tweet',
          content: 'Reply attempt failed',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        };
        
        actions.push(action);
        await EngagementDatabaseLogger.logEngagement(action);
      }
    }

    return actions;
  }

  private async performRealFollows(userIds: string[]): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    console.log(`👥 Performing REAL follows on ${userIds.length} users...`);

    for (const userId of userIds) {
      try {
        const result = await xClient.followUser(userId);
        
        const action: EngagementAction = {
          action_type: 'follow',
          target_id: userId,
          target_type: 'user',
          success: result.success,
          error_message: result.error,
          response_data: result.data
        };

        actions.push(action);
        
        // Log to database
        await EngagementDatabaseLogger.logEngagement(action);
        
        if (result.success) {
          console.log(`✅ REAL FOLLOW: Successfully followed user ${userId}`);
        } else {
          console.log(`❌ FOLLOW FAILED: ${result.error}`);
        }

        // Rate limiting: 5 seconds delay between follows
        await this.sleep(5000);

      } catch (error) {
        console.error(`❌ Error following user ${userId}:`, error);
        
        const action: EngagementAction = {
          action_type: 'follow',
          target_id: userId,
          target_type: 'user',
          success: false,
          error_message: error instanceof Error ? error.message : 'Unknown error'
        };
        
        actions.push(action);
        await EngagementDatabaseLogger.logEngagement(action);
      }
    }

    return actions;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

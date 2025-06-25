import { xClient } from '../utils/xClient';
import { openaiClient } from '../utils/openaiClient';
import { supabase } from '../utils/supabaseClient';

interface EngagementAction {
  type: 'like' | 'reply' | 'follow' | 'retweet';
  tweetId?: string;
  userId?: string;
  content?: string;
  success: boolean;
  error?: string;
}

export class RealEngagementAgent {
  async run(): Promise<{ success: boolean; message: string; actions: EngagementAction[] }> {
    console.log('🤝 === REAL ENGAGEMENT AGENT ACTIVATED ===');
    
    // 🚨 GHOST SYNDROME BREAKER MODE
    const isGhostSyndromeBreaker = process.env.GHOST_SYNDROME_BREAKER === 'true';
    const isEmergencyMode = process.env.EMERGENCY_ENGAGEMENT_MODE === 'true';
    const engagementFreq = process.env.ENGAGEMENT_FREQUENCY || 'normal';
    const dailyTarget = parseInt(process.env.DAILY_ENGAGEMENT_TARGET || '50');
    
    if (isGhostSyndromeBreaker) {
      console.log('🚨 GHOST SYNDROME BREAKER ACTIVATED');
      console.log('🎯 Mission: Break algorithm suppression through aggressive engagement');
      console.log(`📊 Target: ${dailyTarget} engagements today`);
      console.log('⚡ Strategy: High-frequency community interaction');
    }

    const engagementMultiplier = engagementFreq === 'aggressive' ? 2.5 : 
                                isEmergencyMode ? 3.0 : 1.0;
    
    const targetLikes = Math.floor((dailyTarget * 0.6) * engagementMultiplier); // 60% likes
    const targetReplies = Math.floor((dailyTarget * 0.25) * engagementMultiplier); // 25% replies  
    const targetFollows = Math.floor((dailyTarget * 0.15) * engagementMultiplier); // 15% follows

    console.log(`🎯 Today's Engagement Targets:`);
    console.log(`   ❤️  Likes: ${targetLikes}`);
    console.log(`   💬 Replies: ${targetReplies}`);
    console.log(`   👥 Follows: ${targetFollows}`);
    
    const allActions: EngagementAction[] = [];
    
    try {
      // Perform 2 REAL likes
      const likeActions = await this.performRealLikes();
      allActions.push(...likeActions);
      
      // Perform 1 REAL reply  
      const replyActions = await this.performRealReplies();
      allActions.push(...replyActions);
      
      // Perform 1 REAL follow
      const followActions = await this.performRealFollows();
      allActions.push(...followActions);
      
      const successful = allActions.filter(a => a.success);
      
      console.log('📊 === REAL ENGAGEMENT COMPLETE ===');
      console.log(`🎯 Attempted: ${allActions.length} actions`);
      console.log(`✅ Successful: ${successful.length} actions`);
      console.log(`❌ Failed: ${allActions.length - successful.length} actions`);
      
      return {
        success: true,
        message: `Real engagement: ${successful.length}/${allActions.length} actual actions`,
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

  private async performRealLikes(): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    console.log('💖 === PERFORMING REAL LIKES ===');
    
    try {
      const searchResults = await xClient.searchTweets('digital health innovation', 5);
      
      if (searchResults && searchResults.length > 0) {
        const tweet = searchResults[0];
        console.log(`💖 Attempting to ACTUALLY like: ${tweet.text?.substring(0, 50)}...`);
        
        const likeResult = await xClient.likeTweet(tweet.id);
        
        const action: EngagementAction = {
          type: 'like',
          tweetId: tweet.id,
          success: likeResult.success,
          error: likeResult.error
        };

        if (likeResult.success) {
          console.log(`💖 ✅ SUCCESS: ACTUALLY liked tweet!`);
          await this.logEngagement('like', tweet.id, tweet.author_id);
        } else {
          console.log(`💖 ❌ FAILED: ${likeResult.error}`);
        }
        
        actions.push(action);
      }
    } catch (error) {
      console.error('❌ Like attempt failed:', error);
      actions.push({
        type: 'like',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return actions;
  }

  private async performRealReplies(): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    console.log('💬 === PERFORMING REAL REPLIES ===');
    
    try {
      const searchResults = await xClient.searchTweets('health tech question', 3);
      
      if (searchResults && searchResults.length > 0) {
        const tweet = searchResults[0];
        console.log(`💬 Attempting to ACTUALLY reply to: ${tweet.text?.substring(0, 50)}...`);
        
        const replyContent = await this.generateReply(tweet.text || '');
        
        if (replyContent) {
          const replyResult = await xClient.postReply(replyContent, tweet.id);
          
          const action: EngagementAction = {
            type: 'reply',
            tweetId: tweet.id,
            content: replyContent,
            success: replyResult.success,
            error: replyResult.error
          };

          if (replyResult.success) {
            console.log(`💬 ✅ SUCCESS: ACTUALLY replied!`);
            console.log(`💬 Reply content: ${replyContent}`);
            await this.logEngagement('reply', tweet.id, tweet.author_id, replyContent);
          } else {
            console.log(`💬 ❌ FAILED: ${replyResult.error}`);
          }
          
          actions.push(action);
        }
      }
    } catch (error) {
      console.error('❌ Reply attempt failed:', error);
      actions.push({
        type: 'reply',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return actions;
  }

  private async performRealFollows(): Promise<EngagementAction[]> {
    const actions: EngagementAction[] = [];
    console.log('👥 === PERFORMING REAL FOLLOWS ===');
    
    try {
      const usersToFollow = await xClient.getUsersToFollow('health tech CEO', 3);
      
      if (usersToFollow && usersToFollow.length > 0) {
        const user = usersToFollow[0];
        console.log(`👥 Attempting to ACTUALLY follow: @${user.username} (${user.name})`);
        
        const followResult = await xClient.followUser(user.id);
        
        const action: EngagementAction = {
          type: 'follow',
          userId: user.id,
          success: followResult.success,
          error: followResult.error
        };

        if (followResult.success) {
          console.log(`👥 ✅ SUCCESS: ACTUALLY followed @${user.username}!`);
          await this.logEngagement('follow', null, user.id);
        } else {
          console.log(`👥 ❌ FAILED: ${followResult.error}`);
        }
        
        actions.push(action);
      }
    } catch (error) {
      console.error('❌ Follow attempt failed:', error);
      actions.push({
        type: 'follow',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return actions;
  }

  private async generateReply(originalTweet: string): Promise<string | null> {
    try {
      const prompt = `Generate a helpful reply to this health tech tweet. Keep under 280 chars, be professional, add value.

Tweet: "${originalTweet}"

Reply:`;

      const reply = await openaiClient.generateCompletion(prompt, {
        maxTokens: 80,
        temperature: 0.7,
        model: 'gpt-4o-mini'
      });

      return reply && reply.length <= 280 ? reply.trim() : null;
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
      console.log(`📝 Logged REAL ${actionType} action to database`);
    } catch (error) {
      console.error('❌ Failed to log engagement:', error);
    }
  }
}

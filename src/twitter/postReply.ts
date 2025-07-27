import { xClient } from '../utils/xClient';
import { ultimateQuotaManager } from '../utils/ultimateQuotaManager';
import { emergencyBudgetLockdown } from '../utils/emergencyBudgetLockdown';
import { ReplyResult } from '../agents/replyAgent';
import { ScrapedTweet } from '../scraper/scrapeTweets';
import * as fs from 'fs';
import * as path from 'path';

// Reply posting result interface
export interface ReplyPostResult {
  success: boolean;
  replyId?: string;
  originalTweetId: string;
  replyContent: string;
  author: string;
  timestamp: string;
  cost?: number;
  quotaRemaining?: number;
  error?: string;
  reason?: string;
}

// Reply tracking for avoiding duplicates
interface ReplyLog {
  replyId: string;
  originalTweetId: string;
  author: string;
  content: string;
  timestamp: string;
  engagement?: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export class ReplyPoster {
  private repliesLogPath = path.join(process.cwd(), 'logs', 'replies.json');
  private postedReplies: Set<string> = new Set(); // Track tweet IDs we've replied to
  private dailyReplyCount = 0;
  private readonly MAX_DAILY_REPLIES = 17; // Same as tweet limit
  private readonly MIN_REPLY_INTERVAL = 5 * 60 * 1000; // 5 minutes between replies
  private lastReplyTime = 0;

  constructor() {
    this.ensureLogsDirectory();
    this.loadReplyHistory();
  }

  private ensureLogsDirectory(): void {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * 📚 Load reply history to avoid duplicates
   */
  private loadReplyHistory(): void {
    try {
      if (fs.existsSync(this.repliesLogPath)) {
        const data = JSON.parse(fs.readFileSync(this.repliesLogPath, 'utf8'));
        const replies: ReplyLog[] = data.replies || [];
        
        // Load today's replies
        const today = new Date().toDateString();
        let todayCount = 0;
        
        replies.forEach(reply => {
          const replyDate = new Date(reply.timestamp).toDateString();
          if (replyDate === today) {
            todayCount++;
          }
          this.postedReplies.add(reply.originalTweetId);
        });
        
        this.dailyReplyCount = todayCount;
        console.log(`📊 Loaded reply history: ${todayCount} replies posted today`);
      }
    } catch (error) {
      console.warn('⚠️ Could not load reply history:', error);
    }
  }

  /**
   * 💾 Save reply to log
   */
  private saveReplyToLog(replyLog: ReplyLog): void {
    try {
      let data = { replies: [] };
      
      if (fs.existsSync(this.repliesLogPath)) {
        data = JSON.parse(fs.readFileSync(this.repliesLogPath, 'utf8'));
      }
      
      data.replies.push(replyLog);
      
      // Keep only last 100 replies to prevent file bloat
      if (data.replies.length > 100) {
        data.replies = data.replies.slice(-100);
      }
      
      fs.writeFileSync(this.repliesLogPath, JSON.stringify(data, null, 2));
      console.log(`💾 Reply logged: ${replyLog.replyId}`);
    } catch (error) {
      console.warn('⚠️ Could not save reply to log:', error);
    }
  }

  /**
   * 🐦 Post reply to Twitter using existing infrastructure
   */
  async postReply(
    replyResult: ReplyResult, 
    originalTweet: ScrapedTweet
  ): Promise<ReplyPostResult> {
    
    const startTime = Date.now();
    console.log(`🎯 Attempting to post reply to @${originalTweet.author.username}...`);

    try {
      // Security check: Daily quota
      if (this.dailyReplyCount >= this.MAX_DAILY_REPLIES) {
        return {
          success: false,
          originalTweetId: originalTweet.tweetId,
          replyContent: replyResult.reply,
          author: originalTweet.author.username,
          timestamp: new Date().toISOString(),
          reason: `Daily reply limit reached (${this.dailyReplyCount}/${this.MAX_DAILY_REPLIES})`
        };
      }

      // Security check: Avoid duplicate replies
      if (this.postedReplies.has(originalTweet.tweetId)) {
        return {
          success: false,
          originalTweetId: originalTweet.tweetId,
          replyContent: replyResult.reply,
          author: originalTweet.author.username,
          timestamp: new Date().toISOString(),
          reason: 'Already replied to this tweet'
        };
      }

      // Security check: Rate limiting
      const timeSinceLastReply = Date.now() - this.lastReplyTime;
      if (timeSinceLastReply < this.MIN_REPLY_INTERVAL) {
        const waitTime = Math.ceil((this.MIN_REPLY_INTERVAL - timeSinceLastReply) / 1000);
        return {
          success: false,
          originalTweetId: originalTweet.tweetId,
          replyContent: replyResult.reply,
          author: originalTweet.author.username,
          timestamp: new Date().toISOString(),
          reason: `Rate limit: wait ${waitTime} seconds before next reply`
        };
      }

      // Budget protection check
      await emergencyBudgetLockdown.enforceBeforeAICall('reply-posting');

      // Check Twitter API quota
      const quotaStatus = await ultimateQuotaManager.getQuotaStatus();
      if (!quotaStatus.can_post) {
        return {
          success: false,
          originalTweetId: originalTweet.tweetId,
          replyContent: replyResult.reply,
          author: originalTweet.author.username,
          timestamp: new Date().toISOString(),
          reason: `Twitter quota exhausted (${quotaStatus.daily_used}/${quotaStatus.daily_limit})`,
          quotaRemaining: quotaStatus.daily_limit - quotaStatus.daily_used
        };
      }

      // Post the reply using Twitter API v2
      console.log(`📝 Posting reply: "${replyResult.reply.substring(0, 60)}..."`);
      
      const twitterResult = await this.postReplyToTwitter(
        replyResult.reply,
        originalTweet.tweetId
      );

      if (twitterResult.success && twitterResult.replyId) {
        // Update tracking
        this.postedReplies.add(originalTweet.tweetId);
        this.dailyReplyCount++;
        this.lastReplyTime = Date.now();

        // Log the successful reply
        const replyLog: ReplyLog = {
          replyId: twitterResult.replyId,
          originalTweetId: originalTweet.tweetId,
          author: originalTweet.author.username,
          content: replyResult.reply,
          timestamp: new Date().toISOString()
        };
        
        this.saveReplyToLog(replyLog);

        // Quota tracking is handled by the Twitter API wrapper
        const duration = Date.now() - startTime;
        console.log(`✅ Reply posted successfully in ${duration}ms: ${twitterResult.replyId}`);
        console.log(`📊 Daily replies: ${this.dailyReplyCount}/${this.MAX_DAILY_REPLIES}`);

        return {
          success: true,
          replyId: twitterResult.replyId,
          originalTweetId: originalTweet.tweetId,
          replyContent: replyResult.reply,
          author: originalTweet.author.username,
          timestamp: new Date().toISOString(),
          quotaRemaining: quotaStatus.daily_limit - quotaStatus.daily_used - 1
        };

      } else {
        return {
          success: false,
          originalTweetId: originalTweet.tweetId,
          replyContent: replyResult.reply,
          author: originalTweet.author.username,
          timestamp: new Date().toISOString(),
          error: twitterResult.error || 'Unknown Twitter error'
        };
      }

    } catch (error) {
      console.error('❌ Failed to post reply:', error);
      return {
        success: false,
        originalTweetId: originalTweet.tweetId,
        replyContent: replyResult.reply,
        author: originalTweet.author.username,
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * 🔌 Post reply to Twitter API with reply-specific parameters
   */
  private async postReplyToTwitter(
    content: string,
    originalTweetId: string
  ): Promise<{ success: boolean; replyId?: string; error?: string }> {
    
    try {
      // Use the existing xClient but with reply parameters
      // Note: We'll need to extend xClient to support replies
      
      const replyPayload = {
        text: content,
        reply: {
          in_reply_to_tweet_id: originalTweetId
        }
      };

      // Call Twitter API v2 directly through xClient
      const result = await this.postTweetWithReply(replyPayload);
      
      if (result.success && result.tweetId) {
        return {
          success: true,
          replyId: result.tweetId
        };
      } else {
        return {
          success: false,
          error: result.error || 'Failed to post reply'
        };
      }

    } catch (error) {
      console.error('❌ Twitter API reply error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔧 Extended tweet posting with reply support
   * This extends the existing xClient functionality
   */
  private async postTweetWithReply(payload: any): Promise<{ success: boolean; tweetId?: string; error?: string }> {
    try {
      // Access the internal Twitter client from xClient
      const client = (xClient as any).client;
      
      if (!client) {
        throw new Error('Twitter client not available');
      }

      const result = await client.v2.tweet(payload);
      
      if (result && result.data && result.data.id) {
        console.log(`✅ Reply posted successfully: ${result.data.id}`);
        return {
          success: true,
          tweetId: result.data.id
        };
      } else {
        return {
          success: false,
          error: 'Invalid response from Twitter API'
        };
      }

    } catch (error) {
      // Handle Twitter API errors
      if (error.code === 429) {
        console.log('⚠️ Twitter rate limit hit for replies');
        return {
          success: false,
          error: 'Twitter rate limit exceeded'
        };
      }
      
      if (error.code === 403) {
        console.log('⚠️ Twitter permission error for replies');
        return {
          success: false,
          error: 'Twitter permission denied - check API access level'
        };
      }

      return {
        success: false,
        error: error.message || 'Unknown Twitter error'
      };
    }
  }

  /**
   * 📊 Get reply statistics
   */
  getReplyStats(): any {
    return {
      dailyReplies: this.dailyReplyCount,
      maxDailyReplies: this.MAX_DAILY_REPLIES,
      remainingReplies: this.MAX_DAILY_REPLIES - this.dailyReplyCount,
      totalRepliedTweets: this.postedReplies.size,
      lastReplyTime: new Date(this.lastReplyTime).toISOString(),
      canReplyNow: this.canReplyNow()
    };
  }

  /**
   * ✅ Check if we can post a reply right now
   */
  canReplyNow(): boolean {
    const hasQuota = this.dailyReplyCount < this.MAX_DAILY_REPLIES;
    const isNotRateLimited = (Date.now() - this.lastReplyTime) >= this.MIN_REPLY_INTERVAL;
    return hasQuota && isNotRateLimited;
  }

  /**
   * 🔄 Reset daily counters (call this once per day)
   */
  resetDailyCounters(): void {
    this.dailyReplyCount = 0;
    this.postedReplies.clear();
    console.log('✅ Daily reply counters reset');
  }

  /**
   * 🚫 Check if we've already replied to a tweet
   */
  hasRepliedTo(tweetId: string): boolean {
    return this.postedReplies.has(tweetId);
  }
}

// Export singleton instance
export const replyPoster = new ReplyPoster(); 
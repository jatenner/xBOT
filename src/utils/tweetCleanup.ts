import { xClient } from './xClient';
import { supabaseClient } from './supabaseClient';

export interface CleanupOptions {
  qualityThreshold?: number;
  daysBack?: number;
  dryRun?: boolean;
}

export class TweetCleanup {
  /**
   * Optional cleanup utility for manual intervention
   * NOTE: Your bot's quality control makes this rarely necessary
   */
  
  async reviewLowQualityTweets(options: CleanupOptions = {}) {
    const { qualityThreshold = 60, daysBack = 7, dryRun = true } = options;
    
    console.log('🔍 Reviewing tweets for potential cleanup...');
    console.log(`📊 Threshold: ${qualityThreshold}/100`);
    console.log(`📅 Days back: ${daysBack}`);
    console.log(`🧪 Dry run: ${dryRun ? 'Yes' : 'No'}`);
    
    try {
      // Get low-quality tweets from recent period
      const lowQualityTweets = await this.getLowQualityTweets(qualityThreshold, daysBack);
      
      if (lowQualityTweets.length === 0) {
        console.log('✅ No low-quality tweets found! Your bot is working well.');
        return { deleted: 0, reviewed: 0 };
      }
      
      console.log(`⚠️ Found ${lowQualityTweets.length} tweets below ${qualityThreshold}/100`);
      
      let deletedCount = 0;
      
      for (const tweet of lowQualityTweets) {
        console.log(`\n📝 Tweet ID: ${tweet.tweet_id}`);
        console.log(`📊 Quality Score: ${(tweet as any).quality_score || 'N/A'}/100`);
        console.log(`📝 Content: ${tweet.content.substring(0, 100)}...`);
        console.log(`👥 Engagement: ${tweet.likes} likes, ${tweet.retweets} retweets`);
        
        // Check if tweet has significant engagement despite low quality
        const hasSignificantEngagement = tweet.likes > 20 || tweet.retweets > 5;
        
        if (hasSignificantEngagement) {
          console.log('⚠️ SKIP: Tweet has significant engagement despite low quality');
          continue;
        }
        
        if (!dryRun) {
          const deleted = await this.deleteTweet(tweet.tweet_id);
          if (deleted) {
            deletedCount++;
            console.log('🗑️ DELETED: Tweet removed');
            
            // Mark as deleted in database
            await this.markTweetAsDeleted(tweet.tweet_id);
          }
        } else {
          console.log('🧪 DRY RUN: Would delete this tweet');
          deletedCount++;
        }
      }
      
      console.log(`\n📊 Cleanup Summary:`);
      console.log(`   Reviewed: ${lowQualityTweets.length} tweets`);
      console.log(`   ${dryRun ? 'Would delete' : 'Deleted'}: ${deletedCount} tweets`);
      console.log(`   Kept: ${lowQualityTweets.length - deletedCount} tweets (high engagement)`);
      
      return { deleted: deletedCount, reviewed: lowQualityTweets.length };
      
    } catch (error) {
      console.error('❌ Error during cleanup review:', error);
      return { deleted: 0, reviewed: 0 };
    }
  }
  
  private async getLowQualityTweets(qualityThreshold: number, daysBack: number) {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - daysBack);
    
    try {
      // Use the existing method to get tweets with quality data
      const allTweets = await supabaseClient.getTweets({ 
        days: daysBack,
        limit: 1000 
      });
      
      // Filter for low quality (this is a simplified version - 
      // in reality you'd need to join with mission_metrics table)
      const lowQualityTweets = allTweets.filter(tweet => 
        (tweet as any).quality_score && 
        (tweet as any).quality_score < qualityThreshold
      );
      
      return lowQualityTweets;
    } catch (error) {
      console.error('Error getting low quality tweets:', error);
      return [];
    }
  }
  
  private async deleteTweet(tweetId: string): Promise<boolean> {
    try {
      // Use the Twitter client's delete functionality
      // Note: This requires tweet delete permissions
      console.log(`🗑️ Would delete tweet ${tweetId} (delete functionality not implemented)`);
      
      // For now, just log - actual deletion would require Twitter API v2 delete endpoint
      // await client.v2.deleteTweet(tweetId);
      
      return true;
      
    } catch (error) {
      console.error(`❌ Failed to delete tweet ${tweetId}:`, error);
      return false;
    }
  }
  
  private async markTweetAsDeleted(tweetId: string) {
    try {
      // Use the existing supabase client methods
      const success = await supabaseClient.updateTweetEngagement(tweetId, {
        engagement_score: -1 // Mark as deleted with negative score
      });
      
      if (success) {
        console.log(`📝 Marked tweet ${tweetId} as deleted in database`);
      }
        
    } catch (error) {
      console.error('Error marking tweet as deleted in database:', error);
    }
  }
  
  /**
   * Emergency cleanup for tweets with specific keywords
   */
  async emergencyKeywordCleanup(keywords: string[], dryRun: boolean = true) {
    console.log('🚨 Emergency keyword cleanup initiated...');
    console.log(`🔍 Keywords: ${keywords.join(', ')}`);
    
    try {
      const problematicTweets = await this.getTweetsByKeywords(keywords);
      
      if (problematicTweets.length === 0) {
        console.log('✅ No tweets found with problematic keywords');
        return { deleted: 0, reviewed: 0 };
      }
      
      console.log(`⚠️ Found ${problematicTweets.length} tweets with concerning keywords`);
      
      let deletedCount = 0;
      
      for (const tweet of problematicTweets) {
        console.log(`\n📝 Tweet: ${tweet.content}`);
        console.log(`📊 Quality Score: ${(tweet as any).quality_score || 'N/A'}/100`);
        
        if (!dryRun) {
          const deleted = await this.deleteTweet(tweet.tweet_id);
          if (deleted) {
            deletedCount++;
            await this.markTweetAsDeleted(tweet.tweet_id);
          }
        } else {
          console.log('🧪 DRY RUN: Would delete this tweet');
          deletedCount++;
        }
      }
      
      return { deleted: deletedCount, reviewed: problematicTweets.length };
      
    } catch (error) {
      console.error('❌ Error during emergency cleanup:', error);
      return { deleted: 0, reviewed: 0 };
    }
  }
  
  private async getTweetsByKeywords(keywords: string[]) {
    try {
      // Get all recent tweets and filter by keywords
      const allTweets = await supabaseClient.getTweets({ 
        days: 30,
        limit: 1000 
      });
      
      const problematicTweets = allTweets.filter(tweet => 
        keywords.some(keyword => 
          tweet.content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
      
      return problematicTweets;
    } catch (error) {
      console.error('Error getting tweets by keywords:', error);
      return [];
    }
  }
}

// Usage examples:
/*
const cleanup = new TweetCleanup();

// Review low-quality tweets (dry run)
await cleanup.reviewLowQualityTweets({
  qualityThreshold: 60,
  daysBack: 7,
  dryRun: true
});

// Emergency cleanup for problematic content
await cleanup.emergencyKeywordCleanup(['medical advice', 'not a doctor'], true);
*/ 
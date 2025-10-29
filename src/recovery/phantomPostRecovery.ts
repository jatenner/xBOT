/**
 * 🔧 PHANTOM POST RECOVERY SYSTEM
 * 
 * Detects posts marked as "failed" that actually succeeded on Twitter
 * and automatically recovers them by:
 * 1. Scanning Twitter profile for recent posts
 * 2. Matching failed posts with actual tweets by content
 * 3. Updating database with correct tweet_id and status
 */

import { getSupabaseClient } from '../db/index';
import { BrowserManager } from '../browser/browserManager';

interface FailedPost {
  decision_id: string;
  content: string;
  created_at: string;
  error_message: string | null;
}

interface TwitterPost {
  content: string;
  tweetId: string;
  url: string;
  timestamp: string;
}

export class PhantomPostRecovery {
  private static instance: PhantomPostRecovery;
  
  private constructor() {}
  
  public static getInstance(): PhantomPostRecovery {
    if (!PhantomPostRecovery.instance) {
      PhantomPostRecovery.instance = new PhantomPostRecovery();
    }
    return PhantomPostRecovery.instance;
  }
  
  /**
   * Main recovery function - scans for phantom failures and fixes them
   */
  public async recoverPhantomPosts(): Promise<{
    checked: number;
    recovered: number;
    stillFailed: number;
  }> {
    console.log('[PHANTOM_RECOVERY] 🔧 Starting phantom post recovery...');
    
    try {
      // 1. Get failed posts from last 24 hours
      const failedPosts = await this.getRecentFailedPosts();
      
      if (failedPosts.length === 0) {
        console.log('[PHANTOM_RECOVERY] ✅ No failed posts found in last 24 hours');
        return { checked: 0, recovered: 0, stillFailed: 0 };
      }
      
      console.log(`[PHANTOM_RECOVERY] 📊 Found ${failedPosts.length} failed posts to check`);
      
      // 2. Scan Twitter profile for recent posts
      const twitterPosts = await this.scanTwitterProfile();
      
      if (twitterPosts.length === 0) {
        console.log('[PHANTOM_RECOVERY] ⚠️ Could not scan Twitter profile');
        return { checked: failedPosts.length, recovered: 0, stillFailed: failedPosts.length };
      }
      
      console.log(`[PHANTOM_RECOVERY] 📱 Found ${twitterPosts.length} tweets on Twitter`);
      
      // 3. Match and recover
      let recovered = 0;
      for (const failedPost of failedPosts) {
        const match = this.findMatchingTweet(failedPost, twitterPosts);
        
        if (match) {
          const success = await this.recoverPost(failedPost, match);
          if (success) {
            recovered++;
          }
        }
      }
      
      const stillFailed = failedPosts.length - recovered;
      
      console.log('[PHANTOM_RECOVERY] ═══════════════════════════════');
      console.log(`[PHANTOM_RECOVERY] ✅ Recovery complete!`);
      console.log(`[PHANTOM_RECOVERY] 📊 Checked: ${failedPosts.length}`);
      console.log(`[PHANTOM_RECOVERY] ✅ Recovered: ${recovered}`);
      console.log(`[PHANTOM_RECOVERY] ❌ Still failed: ${stillFailed}`);
      console.log('[PHANTOM_RECOVERY] ═══════════════════════════════');
      
      return { checked: failedPosts.length, recovered, stillFailed };
      
    } catch (error: any) {
      console.error('[PHANTOM_RECOVERY] ❌ Recovery failed:', error.message);
      throw error;
    }
  }
  
  /**
   * Get posts marked as failed in the last 24 hours
   */
  private async getRecentFailedPosts(): Promise<FailedPost[]> {
    const supabase = getSupabaseClient();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await supabase
      .from('content_metadata')
      .select('decision_id, content, created_at, error_message')
      .eq('status', 'failed')
      .eq('decision_type', 'single')
      .gte('created_at', yesterday)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[PHANTOM_RECOVERY] ❌ Failed to fetch failed posts:', error.message);
      return [];
    }
    
    return data || [];
  }
  
  /**
   * Scan Twitter profile for recent posts using browser
   */
  private async scanTwitterProfile(): Promise<TwitterPost[]> {
    const browserManager = BrowserManager.getInstance();
    
    try {
      const tweets = await browserManager.withContext('phantom_recovery', async (context) => {
        const page = await context.newPage();
        
        const username = process.env.TWITTER_USERNAME || 'Signal_Synapse';
        console.log(`[PHANTOM_RECOVERY] 📱 Scanning @${username} profile...`);
        
        await page.goto(`https://x.com/${username}`, { 
          waitUntil: 'domcontentloaded', 
          timeout: 60000 
        });
        
        // Wait for tweets to load
        await page.waitForTimeout(5000);
        
        // Scroll to load more tweets
        await page.evaluate(() => window.scrollBy(0, 1000));
        await page.waitForTimeout(2000);
        
        // Extract tweet data
        const tweets = await page.evaluate(() => {
          const articles = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
          
          return articles.map(article => {
            const textElement = article.querySelector('[data-testid="tweetText"]');
            const linkElement = article.querySelector('a[href*="/status/"]');
            const timeElement = article.querySelector('time');
            
            if (!textElement || !linkElement) return null;
            
            const url = linkElement.getAttribute('href') || '';
            const tweetId = url.split('/status/')[1]?.split('?')[0] || '';
            
            return {
              content: textElement.textContent || '',
              tweetId,
              url: `https://x.com${url}`,
              timestamp: timeElement?.getAttribute('datetime') || ''
            };
          }).filter(t => t !== null && t.tweetId.length > 0);
        });
        
        await page.close();
        return tweets;
      });
      
      return tweets;
      
    } catch (error: any) {
      console.error('[PHANTOM_RECOVERY] ⚠️ Twitter scan failed:', error.message);
      return [];
    }
  }
  
  /**
   * Find matching tweet for a failed post
   */
  private findMatchingTweet(
    failedPost: FailedPost,
    twitterPosts: TwitterPost[]
  ): TwitterPost | null {
    // Get first 100 characters for matching (enough to be unique)
    const postContent = failedPost.content.substring(0, 100).trim().toLowerCase();
    
    for (const tweet of twitterPosts) {
      const tweetContent = tweet.content.substring(0, 100).trim().toLowerCase();
      
      // Exact match
      if (postContent === tweetContent) {
        return tweet;
      }
      
      // Very close match (handles formatting differences)
      if (this.calculateSimilarity(postContent, tweetContent) > 0.9) {
        return tweet;
      }
    }
    
    return null;
  }
  
  /**
   * Calculate text similarity (0-1)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }
  
  /**
   * Recover a post by updating database
   */
  private async recoverPost(
    failedPost: FailedPost,
    match: TwitterPost
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    console.log(`[PHANTOM_RECOVERY] ✅ MATCH FOUND!`);
    console.log(`[PHANTOM_RECOVERY]    Content: "${failedPost.content.substring(0, 60)}..."`);
    console.log(`[PHANTOM_RECOVERY]    Tweet ID: ${match.tweetId}`);
    console.log(`[PHANTOM_RECOVERY]    URL: ${match.url}`);
    
    const { error } = await supabase
      .from('content_metadata')
      .update({
        status: 'posted',
        tweet_id: match.tweetId,
        posted_at: match.timestamp || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        error_message: 'Auto-recovered by phantom detection system'
      })
      .eq('decision_id', failedPost.decision_id);
    
    if (error) {
      console.error(`[PHANTOM_RECOVERY] ❌ Failed to update database:`, error.message);
      return false;
    }
    
    console.log(`[PHANTOM_RECOVERY] 💾 Database updated successfully!`);
    return true;
  }
}

/**
 * Standalone recovery function for cron/manual execution
 */
export async function runPhantomPostRecovery(): Promise<void> {
  const recovery = PhantomPostRecovery.getInstance();
  await recovery.recoverPhantomPosts();
}


/**
 * 🔍 VISUAL INTELLIGENCE: Account Scraper
 * 
 * Scrapes tweets from 100 monitored accounts for visual pattern analysis
 * Integrated with existing peer_scraper job (runs every 8 hours)
 * Feature flagged: Only runs if VISUAL_INTELLIGENCE_ENABLED=true
 */

import { getSupabaseClient } from '../db/index';
import { log } from '../lib/logger';
import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import type { Page } from 'playwright';

export class VIAccountScraper {
  private supabase = getSupabaseClient();
  private browserPool = UnifiedBrowserPool.getInstance();
  
  /**
   * Main entry point: Scrape all active VI accounts
   * Called by peer_scraper job every 8 hours
   */
  async scrapeAllAccounts(): Promise<void> {
    log({ op: 'vi_account_scraper_start' });
    
    // Get active scrape targets
    const { data: targets, error } = await this.supabase
      .from('vi_scrape_targets')
      .select('*')
      .eq('is_active', true)
      .order('tier_weight', { ascending: false }); // Process high-value (micro) first
    
    if (error || !targets || targets.length === 0) {
      log({ op: 'vi_scraper_no_targets', error: error?.message });
      return;
    }
    
    log({ op: 'vi_scraper_targets', count: targets.length });
    
    let scraped = 0;
    let failed = 0;
    let newTweets = 0;
    
    // Process in batches to avoid overwhelming browser pool
    const BATCH_SIZE = 5; // 5 accounts at a time
    
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
      const batch = targets.slice(i, i + BATCH_SIZE);
      
      log({ op: 'vi_scraper_batch', batch_num: Math.floor(i / BATCH_SIZE) + 1, accounts: batch.length });
      
      // Scrape batch in parallel
      const results = await Promise.allSettled(
        batch.map(target => this.scrapeAccount(target))
      );
      
      // Process results
      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          scraped++;
          newTweets += result.value;
        } else {
          failed++;
          log({ 
            op: 'vi_scrape_failed', 
            username: batch[idx].username, 
            error: result.reason?.message 
          });
        }
      });
      
      // Rate limit between batches (5 seconds)
      if (i + BATCH_SIZE < targets.length) {
        await this.sleep(5000);
      }
    }
    
    log({ 
      op: 'vi_account_scraper_complete', 
      scraped, 
      failed, 
      new_tweets: newTweets 
    });
  }
  
  /**
   * Scrape individual account
   */
  private async scrapeAccount(target: any): Promise<number> {
    let page: Page | null = null;
    
    try {
      // Acquire page from browser pool (uses existing session)
      page = await this.browserPool.acquirePage(`vi_scrape_${target.username}`);
      
      // Navigate to user profile
      await page.goto(`https://twitter.com/${target.username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // Wait for tweets to load
      await page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
      
      // Auto-tier account if not yet tiered (first scrape)
      if (!target.tier || !target.tier_weight) {
        await this.autoTierAccount(page, target);
      }
      
      // Scroll to load more tweets (3 scrolls = ~10-15 tweets)
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000));
        await this.sleep(1000);
      }
      
      // Extract tweets
      const tweets = await page.evaluate(() => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        const results: any[] = [];
        
        tweetElements.forEach((tweetEl) => {
          try {
            // Get tweet text
            const textElement = tweetEl.querySelector('[data-testid="tweetText"]');
            const text = textElement?.textContent || '';
            
            // Get tweet ID from link
            const linkElement = tweetEl.querySelector('a[href*="/status/"]');
            const href = linkElement?.getAttribute('href') || '';
            const tweetId = href.split('/status/')[1]?.split('?')[0] || '';
            
            // Get engagement (visible metrics only)
            const likeElement = tweetEl.querySelector('[data-testid="like"]');
            const retweetElement = tweetEl.querySelector('[data-testid="retweet"]');
            const replyElement = tweetEl.querySelector('[data-testid="reply"]');
            
            const likesText = likeElement?.getAttribute('aria-label') || '0';
            const retweetsText = retweetElement?.getAttribute('aria-label') || '0';
            const repliesText = replyElement?.getAttribute('aria-label') || '0';
            
            if (text && tweetId && text.length > 10) {
              results.push({
                tweetId,
                text,
                likesText,
                retweetsText,
                repliesText
              });
            }
          } catch (e) {
            // Skip malformed tweets
          }
        });
        
        return results;
      });
      
      log({ 
        op: 'vi_scrape_account_success', 
        username: target.username, 
        tweets_found: tweets.length 
      });
      
      // Store tweets in database
      let storedCount = 0;
      for (const tweet of tweets) {
        const stored = await this.storeTweet(target, tweet);
        if (stored) storedCount++;
      }
      
      // Update scrape status
      await this.supabase
        .from('vi_scrape_targets')
        .update({
          last_scraped_at: new Date().toISOString(),
          scrape_success_count: (target.scrape_success_count || 0) + 1
        })
        .eq('username', target.username);
      
      return storedCount;
      
    } catch (error: any) {
      log({ 
        op: 'vi_scrape_account_error', 
        username: target.username, 
        error: error.message 
      });
      
      // Update failure count
      await this.supabase
        .from('vi_scrape_targets')
        .update({
          scrape_failure_count: (target.scrape_failure_count || 0) + 1
        })
        .eq('username', target.username);
      
      throw error;
      
    } finally {
      if (page) {
        await this.browserPool.releasePage(page);
      }
    }
  }
  
  /**
   * Auto-tier account based on follower count (first scrape only)
   */
  private async autoTierAccount(page: Page, target: any): Promise<void> {
    try {
      // Extract follower count
      const followers = await page.evaluate(() => {
        const followerLink = document.querySelector('a[href$="/verified_followers"] span, a[href$="/followers"] span');
        const text = followerLink?.textContent || '0';
        
        // Parse "5.2K" or "1.2M" format
        if (text.includes('M')) {
          return Math.round(parseFloat(text.replace('M', '')) * 1000000);
        }
        if (text.includes('K')) {
          return Math.round(parseFloat(text.replace('K', '')) * 1000);
        }
        return parseInt(text.replace(/,/g, '')) || 0;
      });
      
      // Determine tier and weight based on follower count
      let tier: string;
      let tierWeight: number;
      
      if (followers < 1000) {
        tier = 'micro';
        tierWeight = 2.0; // Still valuable if they have good content
      } else if (followers >= 1000 && followers <= 20000) {
        tier = 'micro';
        tierWeight = 2.0; // YOUR STAGE - highest priority
      } else if (followers > 20000 && followers <= 100000) {
        tier = 'growth';
        tierWeight = 1.0; // Aspirational
      } else {
        tier = 'established';
        tierWeight = 0.5; // Visual reference only
      }
      
      // Update account with tier info
      await this.supabase
        .from('vi_scrape_targets')
        .update({
          tier,
          tier_weight: tierWeight,
          followers_count: followers
        })
        .eq('username', target.username);
      
      log({ 
        op: 'vi_auto_tier', 
        username: target.username, 
        followers, 
        tier, 
        weight: tierWeight 
      });
      
    } catch (error: any) {
      log({ 
        op: 'vi_auto_tier_error', 
        username: target.username, 
        error: error.message 
      });
    }
  }
  
  /**
   * Store tweet in database
   */
  private async storeTweet(target: any, tweet: any): Promise<boolean> {
    try {
      // Parse engagement counts
      const likes = this.parseEngagement(tweet.likesText);
      const retweets = this.parseEngagement(tweet.retweetsText);
      const replies = this.parseEngagement(tweet.repliesText);
      
      // Calculate basic engagement rate (will be more accurate after we get views)
      const totalEngagement = likes + retweets + replies;
      const estimatedViews = Math.max(totalEngagement * 50, 100); // Rough estimate
      const engagementRate = estimatedViews > 0 ? totalEngagement / estimatedViews : 0;
      
      // Determine if viral (relative to account size)
      const isViral = target.followers_count > 0 
        ? (estimatedViews / target.followers_count) > 0.5 // 50% of followers saw it
        : false;
      
      const { error } = await this.supabase
        .from('vi_collected_tweets')
        .upsert({
          tweet_id: tweet.tweetId,
          author_username: target.username,
          tier: target.tier || 'unknown',
          tier_weight: target.tier_weight || 1.0,
          author_followers: target.followers_count || 0,
          content: tweet.text,
          is_thread: false, // Will be detected later if needed
          thread_length: 1,
          views: estimatedViews, // Estimated (real views require login)
          likes: likes,
          retweets: retweets,
          replies: replies,
          engagement_rate: engagementRate,
          is_viral: isViral,
          viral_multiplier: target.followers_count > 0 ? estimatedViews / target.followers_count : 0,
          posted_at: new Date().toISOString(), // Approximate, can't get exact from timeline
          scraped_at: new Date().toISOString(),
          classified: false,
          analyzed: false
        }, {
          onConflict: 'tweet_id',
          ignoreDuplicates: true
        });
      
      if (error) {
        log({ op: 'vi_store_tweet_error', tweet_id: tweet.tweetId, error: error.message });
        return false;
      }
      
      return true;
      
    } catch (error: any) {
      log({ op: 'vi_store_tweet_exception', error: error.message });
      return false;
    }
  }
  
  /**
   * Parse engagement count from aria-label text
   */
  private parseEngagement(text: string): number {
    if (!text) return 0;
    
    // Extract number from text like "1.2K likes" or "234 retweets"
    const match = text.match(/([\d.]+)([KM])?/);
    if (!match) return 0;
    
    const num = parseFloat(match[1]);
    const suffix = match[2];
    
    if (suffix === 'K') return Math.round(num * 1000);
    if (suffix === 'M') return Math.round(num * 1000000);
    return Math.round(num);
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Export function to be called by peer_scraper job
 */
export async function scrapeVIAccounts(): Promise<void> {
  const scraper = new VIAccountScraper();
  await scraper.scrapeAllAccounts();
}


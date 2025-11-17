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

type ScrapedTweet = {
  tweetId: string;
  text: string;
  viewsText: string;
  likesText: string;
  retweetsText: string;
  repliesText: string;
  timestamp?: string | null;
  mediaTypes: string[];
  hasMedia: boolean;
  isReply: boolean;
  isQuote: boolean;
  originalAuthor: string;
  rootTweetId?: string | null;
  replyToTweetId?: string | null;
};

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
    
    const stats = {
      scraped: 0,
      failed: 0,
      newTweets: 0
    };
    
    // ✅ OPTIMIZED FOR THOUSANDS: Increased default concurrency for faster collection
    const concurrency = Math.max(
      1,
      Number.parseInt(process.env.VI_SCRAPER_CONCURRENCY || '12', 10) // Increased from 8 to 12
    );
    const queue = [...targets];
    const workerCount = Math.min(concurrency, queue.length);
    
    const worker = async (workerId: number): Promise<void> => {
      while (queue.length > 0) {
        const target = queue.shift();
        if (!target) break;
        
        log({
          op: 'vi_scraper_worker_start',
          worker: workerId,
          username: target.username
        });
        
        try {
          const stored = await this.scrapeAccount(target);
          stats.scraped += 1;
          stats.newTweets += stored;
        } catch (error: any) {
          stats.failed += 1;
          log({
            op: 'vi_scrape_failed',
            username: target.username,
            error: error?.message
          });
        }
        
        // Soft rate limit between accounts to avoid hammering Twitter
        await this.sleep(Number(process.env.VI_SCRAPER_WORKER_DELAY_MS || '1500'));
      }
    };
    
    await Promise.all(
      Array.from({ length: workerCount }, (_, idx) => worker(idx + 1))
    );
    
    log({ 
      op: 'vi_account_scraper_complete', 
      scraped: stats.scraped, 
      failed: stats.failed, 
      new_tweets: stats.newTweets,
      concurrency: workerCount
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
      
      // ✅ OPTIMIZED FOR THOUSANDS: Increased default scroll rounds to collect more tweets per account
      const scrollRounds = Math.max(
        2,
        Number.parseInt(process.env.VI_SCRAPER_SCROLL_ROUNDS || '15', 10) // Increased from 5 to 15 (3x more tweets)
      );
      for (let i = 0; i < scrollRounds; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight));
        await this.sleep(750);
      }
      
      // Extract tweets
      const targetLower = (target.username || '').toLowerCase();
      const tweets = await page.evaluate<ScrapedTweet[], string>((targetUsername) => {
        const tweetElements = document.querySelectorAll('[data-testid="tweet"]');
        const results: ScrapedTweet[] = [];
        
        tweetElements.forEach((tweetEl) => {
          try {
            const linkElement = tweetEl.querySelector('a[href*="/status/"]');
            if (!linkElement) return;
            
            const href = linkElement.getAttribute('href') || '';
            const cleanHref = href.split('?')[0];
            const match = cleanHref.match(/^\/([^/]+)\/status\/(\d+)/i);
            if (!match) return;
            
            const author = match[1];
            const tweetId = match[2];
            if (!tweetId) return;
            if (author.toLowerCase() !== targetUsername) return; // Skip retweets from other authors
            
            const textElement = tweetEl.querySelector('[data-testid="tweetText"]');
            const text = textElement?.textContent?.trim() || '';
            if (text.length < 10) return;
            
            const socialContext = tweetEl.querySelector('[data-testid="socialContext"]')?.textContent?.toLowerCase() || '';
            if (socialContext.includes('reposted') || socialContext.includes('liked')) {
              return; // Skip reposts/likes surfaced in timeline
            }
            
            const timeElement = tweetEl.querySelector('time');
            const timestamp = timeElement?.getAttribute('datetime') || null;
            
            const likeElement = tweetEl.querySelector('[data-testid="like"]');
            const retweetElement = tweetEl.querySelector('[data-testid="retweet"]');
            const replyElement = tweetEl.querySelector('[data-testid="reply"]');
            const viewElement = tweetEl.querySelector('a[href*="/analytics"] span, [aria-label*="views"]');
            
            const viewsText = viewElement?.textContent?.trim() || viewElement?.getAttribute('aria-label') || '0';
            const likesText = likeElement?.getAttribute('aria-label') || likeElement?.textContent || '0';
            const retweetsText = retweetElement?.getAttribute('aria-label') || retweetElement?.textContent || '0';
            const repliesText = replyElement?.getAttribute('aria-label') || replyElement?.textContent || '0';
            
            const hasReplyLabel = tweetEl.textContent?.toLowerCase().includes('replying to') || false;
            
            const mediaTypes: string[] = [];
            if (tweetEl.querySelector('[data-testid="tweetPhoto"], img[alt*="Image"]')) {
              mediaTypes.push('image');
            }
            if (tweetEl.querySelector('[data-testid="videoPlayer"], video')) {
              mediaTypes.push('video');
            }
            if (tweetEl.querySelector('[data-testid="animatedGif"]')) {
              mediaTypes.push('gif');
            }
            if (tweetEl.querySelector('[data-testid="card.wrapper"]')) {
              mediaTypes.push('card');
            }
            if (tweetEl.querySelector('[data-testid="poll"]')) {
              mediaTypes.push('poll');
            }
            
            const quoteElement = tweetEl.querySelector('[data-testid="tweetInline"], [data-testid="tweet"] article');
            const isQuote = !!quoteElement && quoteElement !== tweetEl;
            
            const rootTweetId = tweetEl.getAttribute('data-conversation-id') || null;
            
            results.push({
              tweetId,
              text,
              viewsText,
              likesText,
              retweetsText,
              repliesText,
              timestamp,
              mediaTypes: Array.from(new Set(mediaTypes)),
              hasMedia: mediaTypes.length > 0,
              isReply: hasReplyLabel,
              isQuote,
              originalAuthor: author,
              rootTweetId,
              replyToTweetId: null
            });
          } catch (e) {
            // Skip malformed tweets
          }
        });
        
        return results;
      }, targetLower);
      
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
  private async storeTweet(target: any, tweet: ScrapedTweet): Promise<boolean> {
    try {
      // Parse engagement counts (including REAL views from Twitter!)
      const views = this.parseEngagement(tweet.viewsText);
      const likes = this.parseEngagement(tweet.likesText);
      const retweets = this.parseEngagement(tweet.retweetsText);
      const replies = this.parseEngagement(tweet.repliesText);
      
      // Calculate engagement rate using REAL views (if available)
      const totalEngagement = likes + retweets + replies;
      const effectiveViews = views > 0 ? views : Math.max(totalEngagement * 50, 100); // Fallback to estimate if views=0
      const engagementRate = effectiveViews > 0 ? totalEngagement / effectiveViews : 0;
      
      // Determine if viral (relative to account size)
      const isViral = target.followers_count > 0 
        ? (effectiveViews / target.followers_count) > 0.5 // 50% of followers saw it
        : false;
      
      const timestampDate = tweet.timestamp ? new Date(tweet.timestamp) : null;
      const postedAt = timestampDate && !Number.isNaN(timestampDate.getTime())
        ? timestampDate.toISOString()
        : new Date().toISOString();
      
      const { error } = await this.supabase
        .from('vi_collected_tweets')
        .upsert({
          tweet_id: tweet.tweetId,
          author_username: target.username,
          tier: target.tier || 'unknown',
          tier_weight: target.tier_weight || 1.0,
          author_followers: target.followers_count || 0,
          content: tweet.text,
          original_author: tweet.originalAuthor,
          is_thread: false, // TODO: detect thread depth
          thread_length: 1,
          is_reply: tweet.isReply,
          is_quote: tweet.isQuote,
          has_media: !!tweet.hasMedia,
          media_types: tweet.mediaTypes ?? [],
          views: effectiveViews,
          likes,
          retweets,
          replies,
          engagement_rate: engagementRate,
          is_viral: isViral,
          viral_multiplier: target.followers_count > 0 ? effectiveViews / target.followers_count : 0,
          posted_at: postedAt,
          scraped_at: new Date().toISOString(),
          reply_to_tweet_id: tweet.replyToTweetId,
          root_tweet_id: tweet.rootTweetId || tweet.tweetId,
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


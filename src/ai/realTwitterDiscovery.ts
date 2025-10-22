/**
 * REAL TWITTER DISCOVERY - Actual browser-based scraping
 * Replaces placeholder AI generation with real Twitter browsing
 */

import { UnifiedBrowserPool } from '../browser/UnifiedBrowserPool';
import { getSupabaseClient } from '../db';
import type { Page } from 'playwright';

export interface DiscoveredAccount {
  username: string;
  follower_count: number;
  following_count: number;
  tweet_count: number;
  bio: string;
  verified: boolean;
  discovery_method: 'hashtag' | 'network' | 'content' | 'follower_overlap';
  discovery_date: string;
  last_tweet_date?: string;
}

export interface ReplyOpportunity {
  account_username: string;
  tweet_id: string;
  tweet_url: string;
  tweet_content: string;
  tweet_author: string;
  reply_count: number;
  like_count: number;
  posted_minutes_ago: number;
  tweet_posted_at?: string; // ISO timestamp - needed for <24h filtering
  opportunity_score: number;
}

export class RealTwitterDiscovery {
  private static instance: RealTwitterDiscovery;
  
  private readonly HEALTH_ACCOUNTS = [
    'hubermanlab', 'peterattia', 'RhondaPatrick', 'drmarkhyman',
    'bengreenfieldhq', 'davidasinclair', 'foundmyfitness', 'LairdHamilton',
    'drdavinaguilera', 'drsten', 'DrLaPuma', 'WhitMD', 'KellyanneHulme'
  ];
  
  private readonly HEALTH_HASHTAGS = [
    'longevity', 'biohacking', 'nutrition', 'sleep', 'fitness',
    'wellness', 'health', 'neuroscience', 'exercise', 'fasting',
    'supplements', 'antiaging', 'healthspan', 'metabolichealth'
  ];

  private constructor() {}

  static getInstance(): RealTwitterDiscovery {
    if (!RealTwitterDiscovery.instance) {
      RealTwitterDiscovery.instance = new RealTwitterDiscovery();
    }
    return RealTwitterDiscovery.instance;
  }

  /**
   * Verify Twitter authentication
   */
  private async verifyAuth(page: Page): Promise<boolean> {
    try {
      // Navigate to Twitter homepage to activate session
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Wait for authenticated element with longer timeout (Twitter can be slow)
      await page.waitForSelector('[data-testid="SideNav_NewTweet_Button"]', { timeout: 30000 });
      
      console.log('[REAL_DISCOVERY] ✅ Authenticated session confirmed');
      return true;
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ❌ Not authenticated - ${error.message}`);
      
      // Try alternative auth check
      try {
        const url = page.url();
        if (url.includes('/home') || url.includes('/compose')) {
          console.log('[REAL_DISCOVERY] ⚠️ On Twitter home, assuming authenticated despite missing button');
          return true;
        }
      } catch {}
      
      return false;
    }
  }

  /**
   * Discover accounts via Twitter search (REAL SCRAPING)
   * SMART BATCH FIX: Updated selectors + rate limiting + fallbacks
   */
  async discoverAccountsViaSearch(hashtag: string, limit: number = 10): Promise<DiscoveredAccount[]> {
    console.log(`[REAL_DISCOVERY] 🔍 Searching Twitter for #${hashtag}...`);
    
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('hashtag_search');
    
    try {
      // 🔐 VERIFY AUTHENTICATION FIRST
      const isAuth = await this.verifyAuth(page);
      if (!isAuth) {
        console.error('[REAL_DISCOVERY] ⚠️ Skipping search - not authenticated');
        return [];
      }

      // SMART BATCH FIX: Use x.com and better search URL
      const searchUrl = `https://x.com/search?q=%23${hashtag}&src=typed_query&f=live`;
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // 🕐 GIVE TWITTER TIME TO LOAD
      await page.waitForTimeout(3000);
          
          // SMART BATCH FIX: Wait for tweets with multiple fallback selectors
          const tweetsLoaded = await Promise.race([
            page.waitForSelector('article[data-testid="tweet"]', { timeout: 15000 }).catch(() => null),
            page.waitForSelector('div[data-testid="cellInnerDiv"]', { timeout: 15000 }).catch(() => null),
            page.waitForSelector('article[role="article"]', { timeout: 15000 }).catch(() => null),
            page.waitForTimeout(10000).then(() => null)  // Give up after 10s
          ]);
          
          if (!tweetsLoaded) {
            console.warn(`[REAL_DISCOVERY] ⚠️ No tweets loaded for #${hashtag}`);
            return [];
          }
          
          // SMART BATCH FIX: Enhanced account extraction with multiple strategies
          const accounts = await page.evaluate(() => {
            const results: any[] = [];
            
            // Strategy 1: Try data-testid="tweet" articles
            let tweetElements = Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
            
            // Strategy 2: Fallback to any articles
            if (tweetElements.length === 0) {
              tweetElements = Array.from(document.querySelectorAll('article[role="article"]'));
            }
            
            // Strategy 3: Fallback to cell divs
            if (tweetElements.length === 0) {
              tweetElements = Array.from(document.querySelectorAll('div[data-testid="cellInnerDiv"]'));
            }
            
            for (let i = 0; i < Math.min(tweetElements.length, 20); i++) {
              const tweet = tweetElements[i];
              
              // Multiple strategies to extract username
              let username = '';
              
              // Strategy A: User-Name testid
              const userNameEl = tweet.querySelector('[data-testid="User-Name"]');
              if (userNameEl) {
                const text = userNameEl.textContent || '';
                const matches = text.match(/@(\w+)/);
                if (matches && matches[1]) {
                  username = matches[1];
                }
              }
              
              // Strategy B: Profile link
              if (!username) {
                const profileLink = tweet.querySelector('a[href^="/"][href*="status"]');
                if (profileLink) {
                  const href = profileLink.getAttribute('href') || '';
                  const pathParts = href.split('/');
                  if (pathParts.length >= 2 && pathParts[1]) {
                    username = pathParts[1];
                  }
                }
              }
              
              // Strategy C: Any link with username pattern
              if (!username) {
                const links = tweet.querySelectorAll('a[href^="/"]');
                // Convert NodeList to Array for iteration
                for (const link of Array.from(links)) {
                  const href = link.getAttribute('href') || '';
                  const match = href.match(/^\/([a-zA-Z0-9_]+)$/);
                  if (match && match[1] && !match[1].includes('status')) {
                    username = match[1];
                    break;
                  }
                }
              }
              
              if (username && username !== 'home' && username !== 'search' && username !== 'notifications') {
                results.push({
                  username: username,
                  discovery_method: 'hashtag'
                });
              }
            }
            
            // Remove duplicates
            const unique = results.filter((item, index, arr) => 
              arr.findIndex(other => other.username === item.username) === index
            );
            
            return unique;
          });
          
          console.log(`[REAL_DISCOVERY] ✅ Found ${accounts.length} accounts for #${hashtag}`);
          
          // SMART BATCH FIX: Rate limit between account detail fetches
          const discovered: DiscoveredAccount[] = [];
          for (const account of accounts.slice(0, limit)) {
            try {
              const details = await this.getAccountDetails(page, account.username);
              if (details) {
                discovered.push({
                  ...details,
                  discovery_method: 'hashtag',
                  discovery_date: new Date().toISOString()
                });
              }
              
              // Rate limit: 3 seconds between account fetches
              await new Promise(resolve => setTimeout(resolve, 3000));
              
            } catch (err) {
              console.warn(`[REAL_DISCOVERY] ⚠️ Failed to get details for @${account.username}`);
              continue;
            }
          }
          
          return discovered;
          
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ❌ Search failed for #${hashtag}:`, error.message);
      return [];
    } finally {
      await pool.releasePage(page);
    }
  }

  /**
   * Discover reply opportunities from an account (REAL SCRAPING)
   */
  async findReplyOpportunitiesFromAccount(username: string): Promise<ReplyOpportunity[]> {
    console.log(`[REAL_DISCOVERY] 🎯 Finding reply opportunities from @${username}...`);
    
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('timeline_scrape');
    
    try {
      // 🔐 VERIFY AUTHENTICATION FIRST
      const isAuth = await this.verifyAuth(page);
      if (!isAuth) {
        console.error(`[REAL_DISCOVERY] ⚠️ Skipping @${username} - not authenticated`);
        return [];
      }

      // Navigate to account timeline - FIXED: x.com + domcontentloaded
      await page.goto(`https://x.com/${username}`, { 
        waitUntil: 'domcontentloaded', 
        timeout: 30000 
      });
      
      // 🕐 GIVE TWITTER TIME TO LOAD
      await page.waitForTimeout(3000);
          
          // Extract recent tweets
          const opportunities = await page.evaluate(() => {
            const results: any[] = [];
            const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
            
            // 🔥 SCALE: Extract up to 20 tweets per account (was 10)
            for (let i = 0; i < Math.min(tweetElements.length, 20); i++) {
              const tweet = tweetElements[i];
              
              // Get tweet content
              const contentEl = tweet.querySelector('[data-testid="tweetText"]');
              const content = contentEl?.textContent || '';
              
              // Get tweet link
              const linkEl = tweet.querySelector('a[href*="/status/"]');
              const href = linkEl?.getAttribute('href') || '';
              const match = href.match(/\/status\/(\d+)/);
              const tweetId = match ? match[1] : '';
              
              // 🕐 EXTRACT REAL TIMESTAMP from Twitter
              const timeEl = tweet.querySelector('time');
              const datetime = timeEl?.getAttribute('datetime') || '';
              let postedMinutesAgo = 999999; // Default: very old
              if (datetime) {
                const tweetTime = new Date(datetime);
                const now = new Date();
                postedMinutesAgo = Math.floor((now.getTime() - tweetTime.getTime()) / 60000);
              }
              
              // Get engagement metrics
              const replyEl = tweet.querySelector('[data-testid="reply"]');
              const likeEl = tweet.querySelector('[data-testid="like"]');
              const replyText = replyEl?.textContent || '0';
              const likeText = likeEl?.textContent || '0';
              const replyCount = parseInt(replyText.replace(/[^\d]/g, '')) || 0;
              const likeCount = parseInt(likeText.replace(/[^\d]/g, '')) || 0;
              
              // Get author
              const authorEl = tweet.querySelector('[data-testid="User-Name"]');
              const authorMatch = (authorEl?.textContent || '').match(/@(\w+)/);
              const author = authorMatch ? authorMatch[1] : '';
              
              // Filter criteria for reply opportunities
              const hasContent = content.length > 20;
              const notTooManyReplies = replyCount < 100; // Sweet spot for visibility
              const hasEngagement = likeCount > 5; // Some social proof
              const noLinks = !content.includes('http'); // Avoid promotional tweets
              const isRecent = postedMinutesAgo <= 1440; // 🔥 ONLY <24 hours old (1440 min = 24hr)
              
              if (hasContent && notTooManyReplies && hasEngagement && noLinks && isRecent && tweetId && author) {
                results.push({
                  tweet_id: tweetId,
                  tweet_url: `https://x.com/${author}/status/${tweetId}`,
                  tweet_content: content,
                  tweet_author: author,
                  reply_count: replyCount,
                  like_count: likeCount,
                  posted_minutes_ago: postedMinutesAgo // 🕐 REAL timestamp!
                });
              }
            }
            
            return results;
          });
          
          console.log(`[REAL_DISCOVERY] ✅ Found ${opportunities.length} reply opportunities from @${username}`);
          
          // Calculate opportunity scores (use real timestamps from scraper!)
          return opportunities.map((opp: any) => ({
            ...opp,
            account_username: username,
            // posted_minutes_ago already extracted from Twitter! No hardcoding.
            opportunity_score: this.calculateOpportunityScore(opp.like_count, opp.reply_count)
          }));
          
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ❌ Failed to find opportunities from @${username}:`, error.message);
      return [];
    } finally {
      await pool.releasePage(page);
    }
  }

  /**
   * Get full account details (REAL SCRAPING)
   */
  private async getAccountDetails(page: Page, username: string): Promise<DiscoveredAccount | null> {
    try {
      await page.goto(`https://x.com/${username}`, { 
        waitUntil: 'domcontentloaded', 
        timeout: 20000 
      });
      await page.waitForTimeout(2000);
      
      const details = await page.evaluate(() => {
        // Extract follower count
        const followerLinkEl = document.querySelector('a[href$="/verified_followers"]');
        const followerText = followerLinkEl?.textContent || '0';
        const followerMatch = followerText.match(/([\d.]+)([KMB]?)/);
        let followers = 0;
        if (followerMatch) {
          const num = parseFloat(followerMatch[1]);
          const multiplier = followerMatch[2];
          followers = multiplier === 'K' ? num * 1000 :
                     multiplier === 'M' ? num * 1000000 :
                     multiplier === 'B' ? num * 1000000000 : num;
        }
        
        // Extract bio
        const bioEl = document.querySelector('[data-testid="UserDescription"]');
        const bio = bioEl?.textContent || '';
        
        // Check if verified
        const verified = !!document.querySelector('[data-testid="icon-verified"]');
        
        return {
          follower_count: Math.round(followers),
          following_count: 0,
          tweet_count: 0,
          bio,
          verified
        };
      });
      
      return {
        username,
        ...details,
        discovery_method: 'content',
        discovery_date: new Date().toISOString()
      };
      
    } catch (error: any) {
      console.error(`[REAL_DISCOVERY] ⚠️ Could not get details for @${username}:`, error.message);
      return null;
    }
  }

  /**
   * Calculate opportunity score for a tweet
   */
  private calculateOpportunityScore(likes: number, replies: number): number {
    // High likes + low replies = best opportunity (high visibility, low competition)
    const engagementScore = Math.min(likes / 100, 50); // Max 50 points
    const competitionScore = Math.max(50 - (replies / 2), 0); // Max 50 points
    return Math.min(engagementScore + competitionScore, 100);
  }

  /**
   * Batch discover accounts from health seed list
   */
  async discoverFromHealthAccounts(limit: number = 5): Promise<DiscoveredAccount[]> {
    console.log('[REAL_DISCOVERY] 🏥 Discovering from known health accounts...');
    
    const discovered: DiscoveredAccount[] = [];
    
    for (const username of this.HEALTH_ACCOUNTS.slice(0, limit)) {
      try {
        const account = await this.getAccountDetailsStandalone(username);
        if (account) {
          discovered.push({
            ...account,
            discovery_method: 'content',
            discovery_date: new Date().toISOString()
          });
        }
        
        // Small delay between accounts
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`[REAL_DISCOVERY] ⚠️ Failed to discover @${username}`);
      }
    }
    
    console.log(`[REAL_DISCOVERY] ✅ Discovered ${discovered.length} accounts from health seed list`);
    return discovered;
  }

  /**
   * Standalone method to get account details with its own page
   * PUBLIC: Used by accountDiscovery to scrape fallback accounts
   */
  public async getAccountDetailsStandalone(username: string): Promise<DiscoveredAccount | null> {
    const pool = UnifiedBrowserPool.getInstance();
    const page = await pool.acquirePage('account_details');
    
    try {
      return await this.getAccountDetails(page, username);
    } catch (error) {
      return null;
    } finally {
      await pool.releasePage(page);
    }
  }

  /**
   * Store discovered accounts in database
   */
  async storeAccounts(accounts: DiscoveredAccount[]): Promise<void> {
    if (accounts.length === 0) return;
    
    const supabase = getSupabaseClient();
    
    for (const account of accounts) {
      try {
        await supabase
          .from('discovered_accounts')
          .upsert({
            username: account.username,
            follower_count: account.follower_count,
            following_count: account.following_count,
            tweet_count: account.tweet_count,
            bio: account.bio,
            verified: account.verified,
            discovery_method: account.discovery_method,
            discovery_date: account.discovery_date,
            last_updated: new Date().toISOString()
          }, {
            onConflict: 'username'
          });
      } catch (error: any) {
        console.error(`[REAL_DISCOVERY] ⚠️ Failed to store @${account.username}:`, error.message);
      }
    }
    
    console.log(`[REAL_DISCOVERY] 💾 Stored ${accounts.length} accounts in database`);
  }

  /**
   * Store reply opportunities in database
   */
  async storeOpportunities(opportunities: ReplyOpportunity[]): Promise<void> {
    if (opportunities.length === 0) return;
    
    const supabase = getSupabaseClient();
    
    for (const opp of opportunities) {
      try {
        await supabase
          .from('reply_opportunities')
          .upsert({
            account_username: opp.account_username,
            tweet_id: opp.tweet_id,
            tweet_url: opp.tweet_url,
            tweet_content: opp.tweet_content,
            tweet_author: opp.tweet_author,
            reply_count: opp.reply_count,
            like_count: opp.like_count,
            posted_minutes_ago: opp.posted_minutes_ago,
            opportunity_score: opp.opportunity_score,
            discovered_at: new Date().toISOString(),
            status: 'pending'
          }, {
            onConflict: 'tweet_id'
          });
      } catch (error: any) {
        console.error(`[REAL_DISCOVERY] ⚠️ Failed to store opportunity ${opp.tweet_id}:`, error.message);
      }
    }
    
    console.log(`[REAL_DISCOVERY] 💾 Stored ${opportunities.length} reply opportunities in database`);
  }
}

export const realTwitterDiscovery = RealTwitterDiscovery.getInstance();


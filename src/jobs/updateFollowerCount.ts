/**
 * 📈 FOLLOWER COUNT TRACKER
 * 
 * Daily scraping of follower count using Playwright stealth mode.
 * Tracks growth trends and stores in Supabase for analytics.
 */

import { chromium, Browser, Page } from 'playwright';
import { minimalSupabaseClient } from '../utils/minimalSupabaseClient';
import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '../utils/supabaseClient';
import { getChromiumLaunchOptions } from '../utils/playwrightUtils';

interface FollowerData {
  followerCount: number;
  followingCount: number;
  engagementRate: number;
  growthSinceYesterday: number;
  recordedAt: Date;
}

interface FollowerTrackingResult {
  success: boolean;
  data?: FollowerData;
  error?: string;
  previousCount?: number;
}

export class FollowerTracker {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private sessionPath = path.join(process.cwd(), 'twitter-auth.json');
  private username: string = 'SignalAndSynapse'; // Your bot username

  constructor(username?: string) {
    if (username) {
      this.username = username;
    }
  }

  /**
   * 🚀 Initialize the follower tracker
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('📈 Initializing Follower Tracker...');

      // Get launch options with correct executable path
      const launchOptions = getChromiumLaunchOptions();

      // Launch browser with stealth settings and correct executable
      this.browser = await chromium.launch(launchOptions);

      // Create page with realistic settings
      this.page = await this.browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1366, height: 768 },
        locale: 'en-US',
        timezoneId: 'America/New_York'
      });

      // Load session if available
      await this.loadSession();

      console.log('✅ Follower Tracker initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Error initializing Follower Tracker:', error);
      return false;
    }
  }

  /**
   * 📊 Execute daily follower count update
   */
  async updateFollowerCount(): Promise<FollowerTrackingResult> {
    if (!this.browser || !this.page) {
      const initialized = await this.initialize();
      if (!initialized) {
        return {
          success: false,
          error: 'Failed to initialize Follower Tracker'
        };
      }
    }

    try {
      console.log(`📈 Tracking follower count for @${this.username}...`);

      // Get previous day's count for comparison
      const previousCount = await this.getPreviousFollowerCount();

      // Scrape current follower data
      const currentData = await this.scrapeFollowerData();
      if (!currentData) {
        return {
          success: false,
          error: 'Failed to scrape follower data'
        };
      }

      // Calculate growth
      const growthSinceYesterday = currentData.followerCount - (previousCount || 0);

      const followerData: FollowerData = {
        ...currentData,
        growthSinceYesterday,
        recordedAt: new Date()
      };

      // Save to database
      await this.saveFollowerData(followerData);

      console.log(`✅ Follower tracking complete: ${followerData.followerCount} followers (+${growthSinceYesterday})`);

      return {
        success: true,
        data: followerData,
        previousCount
      };

    } catch (error) {
      console.error('❌ Error updating follower count:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 🔍 Scrape follower data from Twitter profile
   */
  private async scrapeFollowerData(): Promise<{followerCount: number, followingCount: number, engagementRate: number} | null> {
    try {
      if (!this.page) {
        throw new Error('Page not initialized');
      }

      const profileUrl = `https://twitter.com/${this.username}`;
      
      // Navigate to profile with improved timeout and fallback
      try {
        await this.page.goto(profileUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 60000
        });
      } catch (gotoError) {
        console.log('🔧 Profile navigation failed, trying fallback...');
        await this.page.screenshot({ path: `profile-error-${this.username}.png` });
        
        await this.page.goto(profileUrl, {
          waitUntil: 'load',
          timeout: 60000
        });
      }

      // Wait for profile elements to load
      try {
        await this.page.waitForSelector('[data-testid="UserName"]', { timeout: 15000 });
      } catch (selectorError) {
        // Fallback: wait for any profile indicator
        await this.page.waitForSelector('h1', { timeout: 15000 });
      }

      // Human-like delay
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

      // Extract follower and following counts
      const metrics = await this.page.evaluate(() => {
        try {
          // Look for follower/following links or text
          const followerSelectors = [
            'a[href*="/followers"] span',
            'a[href*="/verified_followers"] span',
            '[data-testid*="follower"] span',
            'span:has-text("Followers")',
            'div:has-text("Followers")'
          ];

          const followingSelectors = [
            'a[href*="/following"] span',
            '[data-testid*="following"] span',
            'span:has-text("Following")',
            'div:has-text("Following")'
          ];

          let followerCount = 0;
          let followingCount = 0;

          // Try multiple selector strategies
          for (const selector of followerSelectors) {
            try {
              const elements = (document as any).querySelectorAll(selector);
              for (const element of elements) {
                const text = element.textContent || '';
                const match = text.match(/[\d,]+/);
                if (match) {
                  const count = parseInt(match[0].replace(/,/g, ''));
                  if (count > followerCount) {
                    followerCount = count;
                  }
                }
              }
            } catch (e) {
              continue;
            }
          }

          for (const selector of followingSelectors) {
            try {
              const elements = (document as any).querySelectorAll(selector);
              for (const element of elements) {
                const text = element.textContent || '';
                const match = text.match(/[\d,]+/);
                if (match) {
                  const count = parseInt(match[0].replace(/,/g, ''));
                  if (count > followingCount && count < followerCount * 2) { // Sanity check
                    followingCount = count;
                  }
                }
              }
            } catch (e) {
              continue;
            }
          }

          // Fallback: look for any numbers that might be follower counts
          if (followerCount === 0) {
            const allText = (document as any).body.textContent || '';
            const numberMatches = allText.match(/\b\d{1,7}\b/g);
            if (numberMatches) {
              // Heuristic: follower count is likely the largest reasonable number
              const numbers = numberMatches.map(n => parseInt(n)).filter(n => n > 0 && n < 10000000);
              if (numbers.length > 0) {
                followerCount = Math.max(...numbers);
              }
            }
          }

          return {
            followerCount,
            followingCount,
            success: followerCount > 0
          };

        } catch (error) {
          console.error('Error in page evaluation:', error);
          return {
            followerCount: 0,
            followingCount: 0,
            success: false
          };
        }
      });

      if (!metrics.success || metrics.followerCount === 0) {
        console.log('⚠️ Could not extract follower metrics, taking screenshot for debugging...');
        await this.page.screenshot({ path: `follower-debug-${Date.now()}.png` });
        return null;
      }

      // Calculate rough engagement rate (will be improved with actual engagement data)
      const engagementRate = await this.calculateEngagementRate(metrics.followerCount);

      return {
        followerCount: metrics.followerCount,
        followingCount: metrics.followingCount,
        engagementRate
      };

    } catch (error) {
      console.error('❌ Error scraping follower data:', error);
      return null;
    }
  }

  /**
   * 📊 Calculate engagement rate based on recent tweets
   */
  private async calculateEngagementRate(followerCount: number): Promise<number> {
    try {
      // Get recent tweet engagement from database
      const { data: recentTweets } = await minimalSupabaseClient.supabase
        .from('tweets')
        .select('likes, retweets, replies')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      if (!recentTweets || recentTweets.length === 0) {
        return 0;
      }

      const totalEngagement = recentTweets.reduce((sum, tweet) => 
        sum + (tweet.likes || 0) + (tweet.retweets || 0) + (tweet.replies || 0), 0
      );

      const averageEngagement = totalEngagement / recentTweets.length;
      const engagementRate = (averageEngagement / Math.max(followerCount, 1)) * 100;

      return Math.round(engagementRate * 100) / 100; // Round to 2 decimal places

    } catch (error) {
      console.error('❌ Error calculating engagement rate:', error);
      return 0;
    }
  }

  /**
   * 📊 Get previous day's follower count
   */
  private async getPreviousFollowerCount(): Promise<number | null> {
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const { data } = await minimalSupabaseClient.supabase
        .from('follower_log')
        .select('follower_count')
        .gte('recorded_at', yesterday)
        .lt('recorded_at', new Date().toISOString().split('T')[0])
        .order('recorded_at', { ascending: false })
        .limit(1);

      return data && data.length > 0 ? data[0].follower_count : null;

    } catch (error) {
      console.error('❌ Error getting previous follower count:', error);
      return null;
    }
  }

  /**
   * 💾 Save follower data to database
   */
  private async saveFollowerData(data: FollowerData): Promise<void> {
    try {
      await minimalSupabaseClient.supabase
        .from('follower_log')
        .insert({
          follower_count: data.followerCount,
          following_count: data.followingCount,
          engagement_rate: data.engagementRate,
          growth_since_yesterday: data.growthSinceYesterday,
          recorded_at: data.recordedAt.toISOString()
        });

      console.log('💾 Follower data saved to database');

    } catch (error) {
      console.error('❌ Error saving follower data:', error);
    }
  }

  /**
   * 💾 Load Twitter session from file
   */
  private async loadSession(): Promise<void> {
    try {
      if (fs.existsSync(this.sessionPath)) {
        const sessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
        
        if (this.page && sessionData.cookies) {
          await this.page.context().addCookies(sessionData.cookies);
          console.log(`✅ Twitter session loaded (${sessionData.cookies.length} cookies)`);
        }
      } else {
        console.log('⚠️ No Twitter session found - some data may be limited');
      }
    } catch (error) {
      console.error('❌ Failed to load session:', error);
    }
  }

  /**
   * 📊 Get follower growth history
   */
  async getFollowerHistory(days: number = 30): Promise<{date: string, count: number, growth: number}[]> {
    try {
      const { data } = await minimalSupabaseClient.supabase
        .from('follower_log')
        .select('follower_count, growth_since_yesterday, recorded_at')
        .gte('recorded_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('recorded_at', { ascending: true });

      return data?.map(record => ({
        date: new Date(record.recorded_at).toLocaleDateString(),
        count: record.follower_count,
        growth: record.growth_since_yesterday
      })) || [];

    } catch (error) {
      console.error('❌ Error getting follower history:', error);
      return [];
    }
  }

  /**
   * 🔒 Close browser resources
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
      }
      
      if (this.browser) {
        await this.browser.close();
      }
      
      console.log('✅ Follower tracker browser closed');
    } catch (error) {
      console.error('❌ Error closing follower tracker:', error);
    }
  }
}

// Create singleton instance
export const followerTracker = new FollowerTracker();

// Export for testing
export default FollowerTracker; 
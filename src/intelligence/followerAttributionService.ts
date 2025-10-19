/**
 * 📊 FOLLOWER ATTRIBUTION SERVICE
 * 
 * Tracks follower changes and attributes them to specific posts
 * Integrates with existing analytics system - pure addition, no replacements
 */

import { getSupabaseClient } from '../db';

export class FollowerAttributionService {
  private static instance: FollowerAttributionService;
  
  private constructor() {}
  
  static getInstance(): FollowerAttributionService {
    if (!FollowerAttributionService.instance) {
      FollowerAttributionService.instance = new FollowerAttributionService();
    }
    return FollowerAttributionService.instance;
  }

  /**
   * Capture follower count BEFORE posting
   * Called from postingQueue before tweet is published
   */
  async captureFollowerCountBefore(tweetId: string): Promise<void> {
    try {
      const currentFollowers = await this.scrapeCurrentFollowers();
      
      console.log(`[ATTRIBUTION] 📊 Before post ${tweetId}: ${currentFollowers} followers`);
      
      // Update outcomes table
      const supabase = getSupabaseClient();
      await supabase
        .from('outcomes')
        .update({ 
          followers_before: currentFollowers,
          post_hour: new Date().getHours()
        })
        .eq('tweet_id', tweetId);
      
      // Store snapshot for historical tracking
      await supabase
        .from('follower_snapshots')
        .insert({
          account_id: 'main',
          follower_count: currentFollowers,
          source: 'pre_post'
        });
      
    } catch (error: any) {
      console.warn('[ATTRIBUTION] ⚠️ Failed to capture before count:', error.message);
    }
  }

  /**
   * Capture follower count AFTER analytics collection (24h later)
   * Called from analyticsCollector after final pass
   */
  async captureFollowerCountAfter(tweetId: string): Promise<void> {
    try {
      const currentFollowers = await this.scrapeCurrentFollowers();
      
      const supabase = getSupabaseClient();
      
      // Get the "before" count
      const { data: outcome } = await supabase
        .from('outcomes')
        .select('followers_before')
        .eq('tweet_id', tweetId)
        .single();
      
      if (!outcome || outcome.followers_before === null) {
        console.warn('[ATTRIBUTION] ⚠️ No "before" count for', tweetId);
        return;
      }
      
      const followersBefore = Number(outcome.followers_before) || 0;
      const gained = currentFollowers - followersBefore;
      
      // Update outcomes
      await supabase
        .from('outcomes')
        .update({ 
          followers_after: currentFollowers,
          followers_gained: gained
        })
        .eq('tweet_id', tweetId);
      
      // Store snapshot
      await supabase
        .from('follower_snapshots')
        .insert({
          account_id: 'main',
          follower_count: currentFollowers,
          source: 'post_post'
        });
      
      console.log(`[ATTRIBUTION] ✅ Post ${tweetId}: ${gained > 0 ? '+' : ''}${gained} followers`);
      
      // Update generator performance stats (Autonomous Learning!)
      if (gained !== 0) {
        try {
          const { data: metadata } = await supabase
            .from('content_metadata')
            .select('generator_name')
            .eq('tweet_id', tweetId)
            .single();
          
          if (metadata && metadata.generator_name && typeof metadata.generator_name === 'string') {
            // Recalculate all stats for this generator (including total_followers_gained)
            const { getGeneratorPerformanceTracker } = await import('../learning/generatorPerformanceTracker');
            const tracker = getGeneratorPerformanceTracker();
            await tracker.updateGeneratorStats(metadata.generator_name as string);
            
            console.log(`[ATTRIBUTION] 📊 Updated generator stats: ${metadata.generator_name} ${gained > 0 ? '+' : ''}${gained} followers`);
          }
        } catch (statsError: any) {
          console.warn(`[ATTRIBUTION] ⚠️ Failed to update generator stats:`, statsError.message);
        }
      }
      
    } catch (error: any) {
      console.warn('[ATTRIBUTION] ⚠️ Failed to capture after count:', error.message);
    }
  }

  /**
   * Scrape current follower count from profile
   * SMART BATCH FIX: Enhanced with multiple strategies and better selectors
   */
  private async scrapeCurrentFollowers(): Promise<number> {
    try {
      // Use existing browser manager and scraper
      const browserManager = (await import('../lib/browser')).default;
      const page = await browserManager.newPage();
      
      // Navigate to our profile (updated username)
      const username = process.env.TWITTER_USERNAME || 'SignalAndSynapse';
      await page.goto(`https://x.com/${username}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      await page.waitForTimeout(5000); // Wait longer for profile to load
      
      // SMART BATCH FIX: Multiple strategies to extract follower count
      let followers = 0;
      
      // Strategy 1: Try follower link
      try {
        const followerText = await page.locator('a[href*="/followers"] span').first().innerText({ timeout: 5000 });
        followers = this.parseFollowerCount(followerText);
        if (followers > 0) {
          console.log(`[ATTRIBUTION] ✅ Strategy 1 success: ${followers} followers`);
          await page.close();
          return followers;
        }
      } catch (e) {
        console.log(`[ATTRIBUTION] ⚠️ Strategy 1 failed, trying strategy 2...`);
      }
      
      // Strategy 2: Look for any element containing "followers"
      try {
        const followersElements = await page.locator('*:has-text("followers")').all();
        for (const el of followersElements) {
          const text = await el.innerText().catch(() => '');
          if (text.toLowerCase().includes('followers')) {
            const parsed = this.parseFollowerCount(text);
            if (parsed > 0) {
              followers = parsed;
              console.log(`[ATTRIBUTION] ✅ Strategy 2 success: ${followers} followers`);
              break;
            }
          }
        }
        if (followers > 0) {
          await page.close();
          return followers;
        }
      } catch (e) {
        console.log(`[ATTRIBUTION] ⚠️ Strategy 2 failed, trying strategy 3...`);
      }
      
      // Strategy 3: Evaluate in browser context
      try {
        followers = await page.evaluate(() => {
          // Look for follower count in various ways
          const elements = Array.from(document.querySelectorAll('*'));
          for (const el of elements) {
            const text = el.textContent || '';
            if (text.toLowerCase().includes('followers')) {
              const match = text.match(/([\d,\.]+[KMB]?)\s*followers/i);
              if (match) {
                const numStr = match[1].replace(/,/g, '');
                if (numStr.includes('K')) return Math.round(parseFloat(numStr) * 1000);
                if (numStr.includes('M')) return Math.round(parseFloat(numStr) * 1000000);
                if (numStr.includes('B')) return Math.round(parseFloat(numStr) * 1000000000);
                const num = parseInt(numStr);
                if (!isNaN(num) && num > 0) return num;
              }
            }
          }
          return 0;
        });
        
        if (followers > 0) {
          console.log(`[ATTRIBUTION] ✅ Strategy 3 success: ${followers} followers`);
        }
      } catch (e) {
        console.log(`[ATTRIBUTION] ⚠️ Strategy 3 failed`);
      }
      
      await page.close();
      
      return followers;
      
    } catch (error: any) {
      console.error('[ATTRIBUTION] ❌ Failed to scrape followers:', error.message);
      // Return last known count from database
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('follower_snapshots')
        .select('follower_count')
        .order('snapshot_at', { ascending: false })
        .limit(1)
        .single();
      
      return Number(data?.follower_count) || 0;
    }
  }

  /**
   * Parse follower count (handles K, M notation)
   */
  private parseFollowerCount(text: string): number {
    const match = text.match(/([0-9,.]+)([KM])?/);
    if (!match) return 0;
    
    const num = parseFloat(match[1].replace(/,/g, ''));
    const multiplier = match[2];
    
    if (multiplier === 'K') return Math.round(num * 1000);
    if (multiplier === 'M') return Math.round(num * 1000000);
    return Math.round(num);
  }

  /**
   * Get follower growth stats
   */
  async getGrowthStats() {
    const supabase = getSupabaseClient();
    
    // Total followers gained (last 30 days)
    const { data: outcomes } = await supabase
      .from('outcomes')
      .select('followers_gained')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .not('followers_gained', 'is', null);
    
    const totalGained = (outcomes || []).reduce((sum, o) => sum + (Number(o.followers_gained) || 0), 0);
    const postsWithGrowth = (outcomes || []).filter(o => (Number(o.followers_gained) || 0) > 0).length;
    
    return {
      totalGained,
      postsWithGrowth,
      totalPosts: outcomes?.length || 0,
      conversionRate: outcomes?.length ? (postsWithGrowth / outcomes.length) : 0
    };
  }
}

export const followerAttributionService = FollowerAttributionService.getInstance();


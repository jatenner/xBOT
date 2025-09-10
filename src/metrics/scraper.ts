import { Page, BrowserContext } from 'playwright';
import { SELECTORS } from '../utils/selectors';
import { parseNum, extractFirstNum } from '../utils/num';
import { retry, sleep } from '../utils/retry';
import { AdvancedDatabaseManager } from '../lib/advancedDatabaseManager';

export interface MetricSnapshot {
  post_id: string;
  snapshot_at: Date;
  impressions: number;
  likes: number;
  replies: number;
  bookmarks: number;
  retweets: number;
  profile_visits: number;
  follows: number;
}

export class MetricsScraper {
  private static instance: MetricsScraper;
  private db: AdvancedDatabaseManager;

  private constructor() {
    this.db = AdvancedDatabaseManager.getInstance();
  }

  public static getInstance(): MetricsScraper {
    if (!MetricsScraper.instance) {
      MetricsScraper.instance = new MetricsScraper();
    }
    return MetricsScraper.instance;
  }

  /**
   * Scrape metrics for a post at its permalink
   */
  public async scrapePostMetrics(postId: string, permalink: string, context: BrowserContext): Promise<MetricSnapshot> {
    console.log(`METRICS: scraping ${permalink}`);
    
    return retry(async () => {
      const page = await context.newPage();
      
      try {
        // Navigate to the post permalink
        await page.goto(permalink, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        });
        
        // Add random delay to appear human
        await sleep(1000 + Math.random() * 2000);
        
        // Scrape metrics using resilient selectors
        const metrics = await this.extractMetrics(page);
        
        console.log(`METRICS: scraped ${permalink} - likes: ${metrics.likes}, replies: ${metrics.replies}, impressions: ${metrics.impressions}`);
        
        return {
          post_id: postId,
          snapshot_at: new Date(),
          ...metrics
        };
        
      } finally {
        await page.close();
      }
    }, {
      maxAttempts: 3,
      baseDelay: 2000,
      jitter: true
    });
  }

  private async extractMetrics(page: Page): Promise<Omit<MetricSnapshot, 'post_id' | 'snapshot_at'>> {
    const metrics = {
      impressions: 0,
      likes: 0,
      replies: 0,
      bookmarks: 0,
      retweets: 0,
      profile_visits: 0,
      follows: 0
    };

    // Try to extract likes
    for (const selector of SELECTORS.metrics.likes) {
      try {
        const element = await page.locator(selector).first();
        const text = await element.textContent({ timeout: 2000 });
        if (text) {
          metrics.likes = extractFirstNum(text);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Try to extract replies
    for (const selector of SELECTORS.metrics.replies) {
      try {
        const element = await page.locator(selector).first();
        const text = await element.textContent({ timeout: 2000 });
        if (text) {
          metrics.replies = extractFirstNum(text);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Try to extract bookmarks
    for (const selector of SELECTORS.metrics.bookmarks) {
      try {
        const element = await page.locator(selector).first();
        const text = await element.textContent({ timeout: 2000 });
        if (text) {
          metrics.bookmarks = extractFirstNum(text);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Try to extract impressions/views
    for (const selector of SELECTORS.metrics.impressions) {
      try {
        const element = await page.locator(selector).first();
        const text = await element.textContent({ timeout: 2000 });
        if (text && text.toLowerCase().includes('view')) {
          metrics.impressions = extractFirstNum(text);
          break;
        }
      } catch {
        // Try next selector
      }
    }

    // Look for retweets (often combined with other metrics)
    try {
      const retweetElements = await page.locator('[data-testid="retweet"], [data-testid="unretweet"]').all();
      for (const element of retweetElements) {
        const text = await element.textContent();
        if (text) {
          const num = extractFirstNum(text);
          if (num > 0) {
            metrics.retweets = num;
            break;
          }
        }
      }
    } catch {
      // Retweets not found
    }

    return metrics;
  }

  /**
   * Store metrics snapshot in database
   */
  public async storeMetrics(metrics: MetricSnapshot): Promise<void> {
    await this.db.executeQuery('store_metrics', async (client) => {
      const { error } = await client
        .from('post_metrics')
        .insert({
          post_id: metrics.post_id,
          snapshot_at: metrics.snapshot_at.toISOString(),
          impressions: metrics.impressions,
          likes: metrics.likes,
          replies: metrics.replies,
          bookmarks: metrics.bookmarks,
          retweets: metrics.retweets,
          profile_visits: metrics.profile_visits,
          follows: metrics.follows
        });

      if (error) throw error;
      
      console.log(`METRICS: snapshot saved (${metrics.likes}L ${metrics.replies}R ${metrics.impressions}I)`);
      return { success: true };
    });
  }

  /**
   * Schedule and execute metric snapshots for posts
   */
  public async processScheduledSnapshots(): Promise<void> {
    const now = new Date();
    
    // Find posts that need metric snapshots
    const posts = await this.db.executeQuery('get_posts_needing_metrics', async (client) => {
      const { data, error } = await client
        .from('posts')
        .select('id, tweet_id, permalink, posted_at')
        .order('posted_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    });

    for (const post of posts) {
      const postedAt = new Date(post.posted_at);
      const timeSincePost = now.getTime() - postedAt.getTime();
      
      // Check if we need snapshots at 30m, 2h, or 24h
      const intervals = [
        { name: '30m', ms: 30 * 60 * 1000 },
        { name: '2h', ms: 2 * 60 * 60 * 1000 },
        { name: '24h', ms: 24 * 60 * 60 * 1000 }
      ];

      for (const interval of intervals) {
        if (timeSincePost >= interval.ms) {
          // Check if we already have a snapshot for this interval
          const existingSnapshot = await this.hasSnapshot(post.id, postedAt, interval.ms);
          
          if (!existingSnapshot) {
            await this.scheduleSnapshot(post, interval.name);
          }
        }
      }
    }
  }

  private async hasSnapshot(postId: string, postedAt: Date, intervalMs: number): Promise<boolean> {
    return this.db.executeQuery('check_snapshot', async (client) => {
      const targetTime = new Date(postedAt.getTime() + intervalMs);
      const windowStart = new Date(targetTime.getTime() - 10 * 60 * 1000); // 10 min before
      const windowEnd = new Date(targetTime.getTime() + 10 * 60 * 1000); // 10 min after
      
      const { data, error } = await client
        .from('post_metrics')
        .select('id')
        .eq('post_id', postId)
        .gte('snapshot_at', windowStart.toISOString())
        .lte('snapshot_at', windowEnd.toISOString())
        .limit(1);

      if (error) throw error;
      return data && data.length > 0;
    });
  }

  private async scheduleSnapshot(post: any, intervalName: string): Promise<void> {
    // Use jitter to distribute load
    const delay = Math.random() * 5000; // 0-5 second jitter
    
    setTimeout(async () => {
      try {
        // Check if browser metrics are enabled
        const { isBrowserEnabled } = await import('../lib/browser');
        if (!isBrowserEnabled()) {
          console.log(`🚫 METRICS_SCRAPER: Browser disabled, skipping ${intervalName}`);
          return;
        }
        
        // TODO: Update to use browser guard when withSharedContext is available
        console.log(`⏭️ METRICS_SCRAPER: Skipping ${intervalName} - awaiting browser integration`);
        return;
        
      } catch (error: any) {
        console.error(`❌ Failed to scrape metrics for ${post.tweet_id}:`, error.message);
      }
    }, delay);
  }

  private async getSessionState(): Promise<any> {
    try {
      const { loadSessionState } = await import('../utils/session');
      return await loadSessionState();
    } catch (error) {
      console.warn('⚠️ Failed to load session state for metrics:', error);
      return undefined;
    }
  }
}
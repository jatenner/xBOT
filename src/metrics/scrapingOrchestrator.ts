/**
 * 🎯 SCRAPING ORCHESTRATOR
 * PHASE 3: Unified coordination system for all engagement scraping
 * 
 * Benefits:
 * - Single entry point for all scraping
 * - Automatic validation before storage
 * - Redis caching to prevent duplicates
 * - Quality tracking and anomaly detection
 * - Screenshot capture on suspicious data
 */

import { ENV } from '../config/env';
import { log } from '../lib/logger';
import { Page } from 'playwright';
import { BulletproofTwitterScraper, ScrapedMetrics } from '../scrapers/bulletproofTwitterScraper';
import { EngagementValidator, ValidationResult } from './engagementValidator';
import { getSupabaseClient } from '../db/index';

// Redis is optional - gracefully degrade if not available
let Redis: any;
try {
  Redis = require('ioredis');
} catch (e) {
  // Redis not installed, will work without caching
}

export interface ScrapingMetadata {
  collectionPhase?: string; // e.g., 'collection_1', 'scheduled_job', 'on_demand'
  accountFollowerCount?: number;
  postedAt?: Date;
  contentLength?: number;
  persona?: string;
  emotion?: string;
  framework?: string;
}

export interface OrchestrationResult {
  success: boolean;
  metrics?: ScrapedMetrics & { _validation?: ValidationResult };
  validationResult?: ValidationResult;
  error?: string;
  cached?: boolean;
}

export class ScrapingOrchestrator {
  private static instance: ScrapingOrchestrator;
  private scraper: BulletproofTwitterScraper;
  private validator: EngagementValidator;
  private supabase: any;
  private redis: any | null = null;
  private redisInitialized: boolean = false;
  
  private constructor() {
    this.scraper = BulletproofTwitterScraper.getInstance();
    this.validator = new EngagementValidator();
    this.supabase = getSupabaseClient();
    this.initRedis();
  }
  
  static getInstance(): ScrapingOrchestrator {
    if (!ScrapingOrchestrator.instance) {
      ScrapingOrchestrator.instance = new ScrapingOrchestrator();
    }
    return ScrapingOrchestrator.instance;
  }
  
  /**
   * Initialize Redis (optional)
   */
  private async initRedis(): Promise<void> {
    if (!Redis || !ENV.REDIS_URL) {
      console.log('📊 ORCHESTRATOR: Redis not available, running without cache');
      this.redisInitialized = true;
      return;
    }
    
    try {
      this.redis = new Redis(process.env.REDIS_URL, {
        retryStrategy: (times: number) => {
          if (times > 3) return null; // Stop retrying after 3 attempts
          return Math.min(times * 200, 1000);
        }
      });
      
      await this.redis.ping();
      console.log('✅ ORCHESTRATOR: Redis connected');
      this.redisInitialized = true;
    } catch (error: any) {
      console.warn('⚠️ ORCHESTRATOR: Redis connection failed, continuing without cache:', error.message);
      this.redis = null;
      this.redisInitialized = true;
    }
  }
  
  /**
   * MAIN ENTRY POINT: Scrape, validate, and store metrics
   * 
   * This is the ONE method all systems should call for scraping
   */
  async scrapeAndStore(
    page: Page,
    tweetId: string,
    metadata?: ScrapingMetadata
  ): Promise<OrchestrationResult> {
    console.log(`📊 ORCHESTRATOR: Processing ${tweetId}...`);
    
    try {
      // Wait for Redis to initialize if needed
      if (!this.redisInitialized) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // STEP 1: Check cache (prevent duplicate scraping within same hour)
      const cached = await this.checkCache(tweetId);
      if (cached) {
        console.log(`  ✅ CACHE_HIT: Using cached metrics`);
        return {
          success: true,
          metrics: cached,
          cached: true
        };
      }
      
      // STEP 2: Scrape using BulletproofScraper
      console.log(`  🔍 SCRAPING: Using BulletproofTwitterScraper...`);
      const scrapingResult = await this.scraper.scrapeTweetMetrics(page, tweetId);
      
      if (!scrapingResult.success || !scrapingResult.metrics) {
        console.error(`  ❌ SCRAPING_FAILED: ${scrapingResult.error}`);
        return {
          success: false,
          error: scrapingResult.error || 'Scraping failed'
        };
      }
      
      const scrapedMetrics = scrapingResult.metrics;
      console.log(`  ✅ SCRAPED: ${scrapedMetrics.likes}❤️ ${scrapedMetrics.retweets}🔄 ${scrapedMetrics.replies}💬`);
      
      // STEP 3: Get context for validation
      const previousMetrics = await this.validator.getPreviousMetrics(tweetId);
      const accountAvgEngagement = await this.validator.getAccountAvgEngagement();
      
      const hoursSincePost = metadata?.postedAt
        ? (Date.now() - metadata.postedAt.getTime()) / (1000 * 60 * 60)
        : undefined;
      
      // STEP 4: Validate scraped data
      console.log(`  🔍 VALIDATING: Running quality checks...`);
      const validationResult = await this.validator.validateMetrics({
        tweetId,
        scrapedMetrics,
        accountFollowerCount: metadata?.accountFollowerCount,
        accountAvgEngagement,
        previousMetrics,
        hoursSincePost
      });
      
      // STEP 5: Handle validation results
      if (!validationResult.isValid) {
        console.warn(`  ⚠️ VALIDATION_WARNING: Anomalies detected`);
        console.warn(`     Anomalies: ${validationResult.anomalies.join(', ')}`);
        console.warn(`     Confidence: ${validationResult.confidence.toFixed(2)}`);
      }
      
      // STEP 6: Alert if critically suspicious
      if (validationResult.shouldAlert) {
        await this.alertSuspiciousData(tweetId, scrapedMetrics, validationResult, page);
      }
      
      // STEP 7: Store metrics (if confidence is acceptable)
      if (validationResult.shouldStore) {
        await this.storeMetrics(tweetId, scrapedMetrics, validationResult, metadata);
        console.log(`  💾 STORED: Confidence ${validationResult.confidence.toFixed(2)}`);
      } else {
        console.warn(`  ⚠️ NOT_STORED: Confidence too low (${validationResult.confidence.toFixed(2)})`);
      }
      
      // STEP 8: Cache result (only if valid and high confidence)
      if (validationResult.isValid && validationResult.confidence >= 0.8) {
        await this.cacheResult(tweetId, scrapedMetrics);
      }
      
      return {
        success: true,
        metrics: {
          ...scrapedMetrics,
          _validation: validationResult
        },
        validationResult,
        cached: false
      };
      
    } catch (error: any) {
      console.error(`❌ ORCHESTRATOR_ERROR: ${tweetId}:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  /**
   * Check Redis cache for recent scrape
   */
  private async checkCache(tweetId: string): Promise<ScrapedMetrics | null> {
    if (!this.redis) return null;
    
    try {
      const cacheKey = `metrics:${tweetId}:${new Date().getHours()}`;
      const cached = await this.redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      // Cache error - continue without cache
    }
    
    return null;
  }
  
  /**
   * Cache scraped result
   */
  private async cacheResult(tweetId: string, metrics: ScrapedMetrics): Promise<void> {
    if (!this.redis) return;
    
    try {
      const cacheKey = `metrics:${tweetId}:${new Date().getHours()}`;
      await this.redis.setex(cacheKey, 3600, JSON.stringify(metrics)); // 1 hour TTL
    } catch (error) {
      // Cache error - not critical
    }
  }
  
  /**
   * Store metrics in database with quality metadata
   */
  private async storeMetrics(
    tweetId: string,
    metrics: ScrapedMetrics,
    validation: ValidationResult,
    metadata?: ScrapingMetadata
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('real_tweet_metrics')
        .upsert({
          tweet_id: tweetId,
          
          // Core metrics
          likes: metrics.likes ?? 0,
          retweets: metrics.retweets ?? 0,
          replies: metrics.replies ?? 0,
          bookmarks: metrics.bookmarks ?? 0,
          impressions: metrics.views ?? null,
          engagement_rate: Number(((metrics.likes + metrics.retweets + metrics.replies) / (metrics.views || 1)) || 0),
          profile_clicks: null,
          
          // Metadata
          collection_phase: metadata?.collectionPhase || 'on_demand',
          content_length: metadata?.contentLength,
          persona: metadata?.persona,
          emotion: metadata?.emotion,
          framework: metadata?.framework,
          posted_at: metadata?.postedAt?.toISOString(),
          hours_after_post: metadata?.postedAt ? Math.round((Date.now() - metadata.postedAt.getTime()) / (1000 * 60 * 60)) : null,
          viral_score: 0,
          
          // Status
          is_verified: true,
          collected_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'tweet_id,collection_phase'
        });
      
      if (error) {
        console.error('❌ STORAGE_ERROR:', error.message);
        throw error;
      }
      
    } catch (error: any) {
      console.error(`❌ STORAGE_FAILED: ${tweetId}:`, error.message);
      throw error;
    }
  }
  
  /**
   * Alert on suspicious data (screenshot + log)
   */
  private async alertSuspiciousData(
    tweetId: string,
    metrics: ScrapedMetrics,
    validation: ValidationResult,
    page: Page
  ): Promise<void> {
    console.error(`🚨 SUSPICIOUS_DATA_ALERT: ${tweetId}`);
    console.error(`   Metrics: likes=${metrics.likes}, retweets=${metrics.retweets}, replies=${metrics.replies}`);
    console.error(`   Confidence: ${validation.confidence.toFixed(2)}`);
    console.error(`   Anomalies: ${validation.anomalies.join('; ')}`);
    
    // Take screenshot for manual review
    try {
      const screenshotPath = `artifacts/suspicious-${tweetId}-${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath, fullPage: false });
      console.error(`   📸 Screenshot saved: ${screenshotPath}`);
    } catch (error) {
      // Screenshot failed - not critical
    }
    
    // TODO: Add Slack/email notification here if needed
    // Example: await sendSlackAlert(`Suspicious metrics for ${tweetId}`, validation);
  }
  
  /**
   * Get follower count (cached)
   */
  async getAccountFollowerCount(): Promise<number | undefined> {
    if (!this.redis) return undefined;
    
    try {
      const cached = await this.redis.get('account:follower_count');
      if (cached) return parseInt(cached);
    } catch (error) {
      // Cache miss
    }
    
    // TODO: Scrape actual follower count and cache for 1 hour
    return undefined;
  }
  
  /**
   * Health check - get recent scraping stats
   */
  async getHealthStats(hours: number = 24): Promise<{
    totalScraped: number;
    avgConfidence: number;
    anomalyRate: number;
    validationPassRate: number;
    status: 'healthy' | 'warning' | 'critical';
  }> {
    try {
      const { data } = await this.supabase
        .from('real_tweet_metrics')
        .select('likes, retweets, replies, engagement_rate')
        .gte('collected_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());
      
      if (!data || data.length === 0) {
        return {
          totalScraped: 0,
          avgConfidence: 0,
          anomalyRate: 0,
          validationPassRate: 0,
          status: 'warning'
        };
      }
      
      const totalScraped = data.length;
      const avgEngagement = data.reduce((sum, r) => sum + Number(r.engagement_rate || 0), 0) / totalScraped;
      const withLikes = data.filter(r => Number(r.likes) > 0).length;
      
      const validationPassRate = withLikes / totalScraped;
      
      // Determine health status
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (avgEngagement < 0.01 || validationPassRate < 0.5) {
        status = 'critical';
      } else if (avgEngagement < 0.03 || validationPassRate < 0.8) {
        status = 'warning';
      }
      
      return {
        totalScraped,
        avgConfidence: parseFloat(avgEngagement.toFixed(3)),
        anomalyRate: parseFloat((1 - validationPassRate).toFixed(3)),
        validationPassRate: parseFloat(validationPassRate.toFixed(3)),
        status
      };
      
    } catch (error: any) {
      console.error('Health check failed:', error.message);
      return {
        totalScraped: 0,
        avgConfidence: 0,
        anomalyRate: 0,
        validationPassRate: 0,
        status: 'critical'
      };
    }
  }
}

// Export singleton
export const scrapingOrchestrator = ScrapingOrchestrator.getInstance();


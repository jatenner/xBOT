/**
 * 🔍 ENGAGEMENT VALIDATOR
 * PHASE 1: Data quality validation layer
 * 
 * Prevents storing impossible/suspicious metrics before they pollute the database
 * Catches anomalies like sudden spikes, impossible values, suspicious ratios
 */

import { getSupabaseClient } from '../db/index';

export interface ValidationResult {
  isValid: boolean;
  confidence: number; // 0-1
  anomalies: string[];
  warnings: string[];
  shouldStore: boolean;
  shouldAlert: boolean;
}

export interface ValidationContext {
  tweetId: string;
  scrapedMetrics: {
    likes: number | null;
    retweets: number | null;
    quote_tweets: number | null;
    replies: number | null;
    bookmarks: number | null;
    views: number | null;
  };
  accountFollowerCount?: number;
  accountAvgEngagement?: number;
  previousMetrics?: any;
  hoursSincePost?: number;
}

interface ValidationCheck {
  passed: boolean;
  anomalies: string[];
  confidence: number; // 0-1
}

export class EngagementValidator {
  private supabase: any;
  
  constructor() {
    this.supabase = getSupabaseClient();
  }
  
  /**
   * Main validation entry point
   * Runs all checks and aggregates results
   */
  async validateMetrics(context: ValidationContext): Promise<ValidationResult> {
    console.log(`🔍 VALIDATOR: Checking metrics for ${context.tweetId}...`);
    
    try {
      // Run all validation checks in parallel
      const checks = await Promise.all([
        this.checkImpossibleValues(context),
        this.checkSuspiciousSpikes(context),
        this.checkMetricRatios(context),
        this.checkHistoricalConsistency(context)
      ]);
      
      // Aggregate results
      const result = this.aggregateResults(checks, context);
      
      // Log results
      if (result.isValid) {
        console.log(`  ✅ VALIDATION: PASSED (confidence: ${result.confidence.toFixed(2)})`);
      } else {
        console.warn(`  ⚠️ VALIDATION: FAILED (confidence: ${result.confidence.toFixed(2)})`);
        console.warn(`  Anomalies: ${result.anomalies.join(', ')}`);
      }
      
      return result;
      
    } catch (error: any) {
      console.error(`❌ VALIDATOR_ERROR: ${context.tweetId}:`, error.message);
      
      // On error, return low-confidence result but allow storing
      return {
        isValid: false,
        confidence: 0.5,
        anomalies: [`Validation error: ${error.message}`],
        warnings: [],
        shouldStore: true, // Store anyway with low confidence
        shouldAlert: false
      };
    }
  }
  
  /**
   * CHECK 1: Impossible Values
   * Catches values that are physically impossible or extremely unlikely
   */
  private async checkImpossibleValues(context: ValidationContext): Promise<ValidationCheck> {
    const { scrapedMetrics, accountFollowerCount } = context;
    const anomalies: string[] = [];
    
    // Check 1.1: Likes can't exceed followers by too much (unless extremely viral)
    if (accountFollowerCount && scrapedMetrics.likes) {
      // Allow up to 20x followers for viral tweets, but flag above that
      if (scrapedMetrics.likes > accountFollowerCount * 20) {
        anomalies.push(
          `Likes (${scrapedMetrics.likes}) exceeds followers (${accountFollowerCount}) by ${Math.floor(scrapedMetrics.likes / accountFollowerCount)}x - extremely unlikely`
        );
      }
    }
    
    // Check 1.2: Engagement rate > 50% is extremely rare
    if (scrapedMetrics.views && scrapedMetrics.likes && scrapedMetrics.views > 0) {
      const engagementRate = scrapedMetrics.likes / scrapedMetrics.views;
      if (engagementRate > 0.5) {
        anomalies.push(
          `Engagement rate ${(engagementRate * 100).toFixed(1)}% is unrealistically high (>50%)`
        );
      }
    }
    
    // Check 1.3: Views should be >= total engagement
    const totalEngagement = (scrapedMetrics.likes ?? 0) + 
                           (scrapedMetrics.retweets ?? 0) + 
                           (scrapedMetrics.replies ?? 0) + 
                           (scrapedMetrics.bookmarks ?? 0);
    
    if (scrapedMetrics.views && totalEngagement > scrapedMetrics.views) {
      anomalies.push(
        `Total engagement (${totalEngagement}) exceeds views (${scrapedMetrics.views}) - impossible`
      );
    }
    
    // Check 1.4: Retweets >> likes is unusual (controversial tweets exception)
    if (scrapedMetrics.retweets && scrapedMetrics.likes) {
      if (scrapedMetrics.retweets > scrapedMetrics.likes * 3) {
        anomalies.push(
          `Retweets (${scrapedMetrics.retweets}) significantly exceed likes (${scrapedMetrics.likes}) - unusual pattern`
        );
      }
    }
    
    return {
      passed: anomalies.length === 0,
      anomalies,
      confidence: anomalies.length === 0 ? 1.0 : 0.3
    };
  }
  
  /**
   * CHECK 2: Suspicious Spikes
   * Catches growth rates that are too fast to be realistic
   */
  private async checkSuspiciousSpikes(context: ValidationContext): Promise<ValidationCheck> {
    const { tweetId, scrapedMetrics, previousMetrics, hoursSincePost } = context;
    
    // Skip if no previous data
    if (!previousMetrics) {
      return { passed: true, anomalies: [], confidence: 1.0 };
    }
    
    const anomalies: string[] = [];
    const timeDiffMinutes = hoursSincePost ? hoursSincePost * 60 : null;
    
    if (!timeDiffMinutes || timeDiffMinutes <= 0) {
      return { passed: true, anomalies: [], confidence: 0.9 };
    }
    
    // Check 2.1: Impossible growth rate
    const likeGrowth = (scrapedMetrics.likes ?? 0) - (previousMetrics.likes ?? 0);
    const maxRealisticGrowthPerMinute = 20; // Generous: 20 likes/min is already very fast
    const maxRealisticGrowth = timeDiffMinutes * maxRealisticGrowthPerMinute;
    
    if (likeGrowth > maxRealisticGrowth) {
      anomalies.push(
        `Like growth (${likeGrowth} in ${timeDiffMinutes.toFixed(0)}min) exceeds realistic rate (max ${maxRealisticGrowth} @ ${maxRealisticGrowthPerMinute}/min)`
      );
    }
    
    // Check 2.2: Metrics should NEVER decrease (unless tweet deleted/reposted)
    if ((scrapedMetrics.likes ?? 0) < (previousMetrics.likes ?? 0)) {
      anomalies.push(
        `Likes decreased from ${previousMetrics.likes} to ${scrapedMetrics.likes} - impossible without deletion`
      );
    }
    
    if ((scrapedMetrics.retweets ?? 0) < (previousMetrics.retweets ?? 0)) {
      anomalies.push(
        `Retweets decreased from ${previousMetrics.retweets} to ${scrapedMetrics.retweets} - impossible`
      );
    }
    
    return {
      passed: anomalies.length === 0,
      anomalies,
      confidence: anomalies.length === 0 ? 0.95 : 0.2
    };
  }
  
  /**
   * CHECK 3: Metric Ratios
   * Validates relationships between metrics
   */
  private async checkMetricRatios(context: ValidationContext): Promise<ValidationCheck> {
    const { scrapedMetrics } = context;
    const anomalies: string[] = [];
    
    // Check 3.1: Quote tweets shouldn't significantly exceed retweets
    if (scrapedMetrics.quote_tweets && scrapedMetrics.retweets && scrapedMetrics.retweets > 0) {
      const quoteRatio = scrapedMetrics.quote_tweets / scrapedMetrics.retweets;
      if (quoteRatio > 2) {
        anomalies.push(
          `Quote tweets (${scrapedMetrics.quote_tweets}) significantly exceed retweets (${scrapedMetrics.retweets}) - ratio: ${quoteRatio.toFixed(1)}`
        );
      }
    }
    
    // Check 3.2: Bookmarks typically correlate with likes (usually less)
    if (scrapedMetrics.bookmarks && scrapedMetrics.likes) {
      const bookmarkRatio = scrapedMetrics.bookmarks / scrapedMetrics.likes;
      if (bookmarkRatio > 2) {
        anomalies.push(
          `Bookmarks (${scrapedMetrics.bookmarks}) significantly exceed likes (${scrapedMetrics.likes}) - unusual`
        );
      }
    }
    
    // Check 3.3: Replies usually correlate with engagement level
    if (scrapedMetrics.replies && scrapedMetrics.likes && scrapedMetrics.likes > 100) {
      const replyRatio = scrapedMetrics.replies / scrapedMetrics.likes;
      if (replyRatio > 0.5) {
        // More than 50% reply rate is very high (controversial content)
        anomalies.push(
          `Very high reply ratio (${(replyRatio * 100).toFixed(1)}%) - may indicate controversial content`
        );
      }
    }
    
    return {
      passed: anomalies.length === 0,
      anomalies,
      confidence: anomalies.length === 0 ? 1.0 : 0.7 // Less critical than other checks
    };
  }
  
  /**
   * CHECK 4: Historical Consistency
   * Compares to account's typical performance
   */
  private async checkHistoricalConsistency(context: ValidationContext): Promise<ValidationCheck> {
    const { scrapedMetrics, accountAvgEngagement } = context;
    
    // Skip if no historical data
    if (!accountAvgEngagement) {
      return { passed: true, anomalies: [], confidence: 0.8 };
    }
    
    const anomalies: string[] = [];
    
    // Calculate current engagement
    const currentEngagement = (scrapedMetrics.likes ?? 0) + 
                             (scrapedMetrics.retweets ?? 0) + 
                             (scrapedMetrics.replies ?? 0);
    
    // Check if this is wildly different from typical performance
    // Allow 50x variance for viral tweets
    if (currentEngagement > accountAvgEngagement * 50) {
      anomalies.push(
        `Engagement (${currentEngagement}) is ${Math.floor(currentEngagement / accountAvgEngagement)}x higher than average (${accountAvgEngagement}) - possibly viral or error`
      );
    }
    
    return {
      passed: anomalies.length === 0,
      anomalies,
      confidence: anomalies.length === 0 ? 0.9 : 0.6 // Viral tweets can be legitimate
    };
  }
  
  /**
   * Aggregate all check results into final validation result
   */
  private aggregateResults(checks: ValidationCheck[], context: ValidationContext): ValidationResult {
    // Collect all anomalies
    const allAnomalies = checks.flatMap(c => c.anomalies);
    
    // Calculate average confidence (weighted by importance)
    const avgConfidence = checks.reduce((sum, c) => sum + c.confidence, 0) / checks.length;
    
    // Determine if all passed
    const allPassed = checks.every(c => c.passed);
    
    // Determine if we should store (store if confidence >= 0.7 OR all checks passed)
    const shouldStore = avgConfidence >= 0.7 || allPassed;
    
    // Determine if we should alert (alert if failed AND low confidence)
    const shouldAlert = !allPassed && avgConfidence < 0.5;
    
    // Collect warnings (less critical anomalies)
    const warnings = allAnomalies.filter(a => 
      a.includes('unusual') || a.includes('high') || a.includes('may indicate')
    );
    
    const criticalAnomalies = allAnomalies.filter(a => !warnings.includes(a));
    
    return {
      isValid: allPassed,
      confidence: parseFloat(avgConfidence.toFixed(3)),
      anomalies: criticalAnomalies,
      warnings,
      shouldStore,
      shouldAlert
    };
  }
  
  /**
   * Get previous metrics for comparison
   */
  async getPreviousMetrics(tweetId: string): Promise<any | null> {
    try {
      const { data } = await this.supabase
        .from('real_tweet_metrics')
        .select('*')
        .eq('tweet_id', tweetId)
        .order('collected_at', { ascending: false })
        .limit(1)
        .single();
      
      return data;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get account's average engagement for context
   */
  async getAccountAvgEngagement(days: number = 30): Promise<number> {
    try {
      const { data } = await this.supabase
        .from('real_tweet_metrics')
        .select('likes, retweets, replies')
        .gte('collected_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .eq('is_verified', true);
      
      if (!data || data.length === 0) return 10; // Default fallback
      
      const totalEngagement = data.reduce((sum: number, row: any) => 
        sum + (row.likes || 0) + (row.retweets || 0) + (row.replies || 0), 0
      );
      
      return Math.floor(totalEngagement / data.length);
    } catch (error) {
      return 10; // Fallback
    }
  }
}

export const engagementValidator = new EngagementValidator();


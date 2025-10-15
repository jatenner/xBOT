/**
 * Scraping Health Monitor
 * 
 * Tracks scraping success rates and alerts if reliability drops
 */

import { getSupabaseClient } from '../db';

interface ScrapingAttempt {
  tweetId: string;
  success: boolean;
  attempts: number;
  dataSource: 'scraped' | 'scraping_failed';
  timestamp: Date;
  error?: string;
}

export class ScrapingHealthMonitor {
  private static instance: ScrapingHealthMonitor;
  private attempts: ScrapingAttempt[] = [];
  private readonly MAX_HISTORY = 100; // Keep last 100 attempts
  private readonly SUCCESS_THRESHOLD = 0.95; // Alert if below 95%

  private constructor() {}

  static getInstance(): ScrapingHealthMonitor {
    if (!ScrapingHealthMonitor.instance) {
      ScrapingHealthMonitor.instance = new ScrapingHealthMonitor();
    }
    return ScrapingHealthMonitor.instance;
  }

  /**
   * Record a scraping attempt
   */
  recordAttempt(
    tweetId: string,
    success: boolean,
    attempts: number,
    dataSource: 'scraped' | 'scraping_failed',
    error?: string
  ): void {
    this.attempts.push({
      tweetId,
      success,
      attempts,
      dataSource,
      timestamp: new Date(),
      error
    });

    // Keep only recent history
    if (this.attempts.length > this.MAX_HISTORY) {
      this.attempts = this.attempts.slice(-this.MAX_HISTORY);
    }

    // Check if success rate is below threshold
    this.checkHealthStatus();

    // Log to database for historical tracking
    this.logToDatabase(tweetId, success, attempts, dataSource, error);
  }

  /**
   * Get current success rate
   */
  getSuccessRate(): {
    total: number;
    successful: number;
    rate: number;
    lastHour: number;
  } {
    const total = this.attempts.length;
    const successful = this.attempts.filter(a => a.success).length;
    const rate = total > 0 ? successful / total : 0;

    // Calculate success rate for last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const lastHourAttempts = this.attempts.filter(a => a.timestamp >= oneHourAgo);
    const lastHourSuccess = lastHourAttempts.filter(a => a.success).length;
    const lastHour = lastHourAttempts.length > 0 ? lastHourSuccess / lastHourAttempts.length : 0;

    return {
      total,
      successful,
      rate,
      lastHour
    };
  }

  /**
   * Get detailed statistics
   */
  getDetailedStats(): {
    successRate: number;
    avgAttemptsOnSuccess: number;
    avgAttemptsOnFailure: number;
    lastHourRate: number;
    commonErrors: { error: string; count: number }[];
  } {
    const stats = this.getSuccessRate();

    const successful = this.attempts.filter(a => a.success);
    const failed = this.attempts.filter(a => !a.success);

    const avgAttemptsOnSuccess = successful.length > 0
      ? successful.reduce((sum, a) => sum + a.attempts, 0) / successful.length
      : 0;

    const avgAttemptsOnFailure = failed.length > 0
      ? failed.reduce((sum, a) => sum + a.attempts, 0) / failed.length
      : 0;

    // Count common errors
    const errorCounts = new Map<string, number>();
    failed.forEach(a => {
      if (a.error) {
        const count = errorCounts.get(a.error) || 0;
        errorCounts.set(a.error, count + 1);
      }
    });

    const commonErrors = Array.from(errorCounts.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      successRate: stats.rate,
      avgAttemptsOnSuccess,
      avgAttemptsOnFailure,
      lastHourRate: stats.lastHour,
      commonErrors
    };
  }

  /**
   * Check health and alert if below threshold
   */
  private checkHealthStatus(): void {
    const stats = this.getSuccessRate();

    // Need at least 10 attempts to assess reliability
    if (stats.total < 10) {
      return;
    }

    // Alert if success rate drops below threshold
    if (stats.rate < this.SUCCESS_THRESHOLD) {
      console.error(`🚨 SCRAPING_HEALTH: Success rate dropped to ${(stats.rate * 100).toFixed(1)}% (threshold: ${this.SUCCESS_THRESHOLD * 100}%)`);
      console.error(`   Recent attempts: ${stats.successful}/${stats.total} successful`);
      console.error(`   Last hour: ${(stats.lastHour * 100).toFixed(1)}%`);

      // TODO: Send alert notification (email, Slack, etc.)
    } else if (stats.rate >= 0.99) {
      // Excellent performance
      if (stats.total % 20 === 0) { // Log every 20th attempt
        console.log(`✅ SCRAPING_HEALTH: Excellent performance - ${(stats.rate * 100).toFixed(1)}% success rate`);
      }
    }
  }

  /**
   * Log scraping attempt to database for historical tracking
   */
  private async logToDatabase(
    tweetId: string,
    success: boolean,
    attempts: number,
    dataSource: string,
    error?: string
  ): Promise<void> {
    try {
      const supabase = getSupabaseClient();

      await supabase.from('scraping_attempts').insert([{
        tweet_id: tweetId,
        success,
        attempts,
        data_source: dataSource,
        error_message: error,
        created_at: new Date().toISOString()
      }]);
    } catch (dbError) {
      // Database logging failed - not critical
      // Table might not exist yet
    }
  }

  /**
   * Get recent failures for debugging
   */
  getRecentFailures(limit: number = 10): ScrapingAttempt[] {
    return this.attempts
      .filter(a => !a.success)
      .slice(-limit)
      .reverse();
  }

  /**
   * Print health report
   */
  printHealthReport(): void {
    const stats = this.getDetailedStats();
    const recent = this.getSuccessRate();

    console.log('\n' + '='.repeat(80));
    console.log('📊 SCRAPING HEALTH REPORT');
    console.log('='.repeat(80));
    console.log(`✅ Success Rate: ${(stats.successRate * 100).toFixed(1)}% (${recent.successful}/${recent.total} attempts)`);
    console.log(`⏱️  Last Hour: ${(stats.lastHourRate * 100).toFixed(1)}%`);
    console.log(`📈 Avg Attempts on Success: ${stats.avgAttemptsOnSuccess.toFixed(1)}`);
    console.log(`📉 Avg Attempts on Failure: ${stats.avgAttemptsOnFailure.toFixed(1)}`);

    if (stats.commonErrors.length > 0) {
      console.log('\n🔍 Common Errors:');
      stats.commonErrors.forEach(e => {
        console.log(`   - ${e.error} (${e.count}x)`);
      });
    }

    console.log('='.repeat(80) + '\n');
  }
}

export const getScrapingHealthMonitor = () => ScrapingHealthMonitor.getInstance();


/**
 * 🚨 ERROR AGGREGATION AND TRACKING SYSTEM
 * Monitors, aggregates, and alerts on system errors
 */

import { getSupabaseClient } from '../db/index';

interface ErrorStats {
  category: string;
  count: number;
  first_seen: Date;
  last_seen: Date;
  recent_messages: string[];
}

class ErrorAggregator {
  private static instance: ErrorAggregator;
  private errorCounts: Map<string, ErrorStats> = new Map();
  private hourlyAlerts: Set<string> = new Set();
  
  private constructor() {
    // Reset hourly alerts every hour
    setInterval(() => {
      this.hourlyAlerts.clear();
    }, 60 * 60 * 1000);
    
    // Print summary every hour
    setInterval(() => {
      this.printSummary();
    }, 60 * 60 * 1000);
  }
  
  static getInstance(): ErrorAggregator {
    if (!ErrorAggregator.instance) {
      ErrorAggregator.instance = new ErrorAggregator();
    }
    return ErrorAggregator.instance;
  }
  
  /**
   * Track an error occurrence
   */
  async trackError(category: string, error: Error | string, context?: Record<string, any>): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : error;
    const key = `${category}:${errorMessage.substring(0, 100)}`;
    
    if (!this.errorCounts.has(key)) {
      this.errorCounts.set(key, {
        category,
        count: 0,
        first_seen: new Date(),
        last_seen: new Date(),
        recent_messages: []
      });
    }
    
    const stats = this.errorCounts.get(key)!;
    stats.count++;
    stats.last_seen = new Date();
    
    // Keep last 5 messages
    stats.recent_messages.push(errorMessage);
    if (stats.recent_messages.length > 5) {
      stats.recent_messages.shift();
    }
    
    // Alert if high frequency
    if (stats.count === 5 || stats.count === 20 || stats.count === 50) {
      await this.sendAlert(category, stats);
    }
    
    // Store to database for historical analysis
    try {
      const supabase = getSupabaseClient();
      await supabase.from('system_errors').insert({
        error_category: category,
        error_message: errorMessage,
        error_stack: error instanceof Error ? error.stack : null,
        context: context ? JSON.stringify(context) : null,
        severity: this.calculateSeverity(stats.count),
        created_at: new Date().toISOString()
      });
    } catch (dbError: any) {
      // Non-critical - don't fail if DB write fails
      console.warn('[ERROR_TRACKER] ⚠️ Could not persist error:', dbError.message);
    }
  }
  
  /**
   * Calculate error severity based on frequency
   */
  private calculateSeverity(count: number): 'low' | 'medium' | 'high' | 'critical' {
    if (count >= 50) return 'critical';
    if (count >= 20) return 'high';
    if (count >= 5) return 'medium';
    return 'low';
  }
  
  /**
   * Send alert for high-frequency errors
   */
  private async sendAlert(category: string, stats: ErrorStats): Promise<void> {
    const alertKey = `${category}_${stats.count}`;
    
    // Don't spam alerts - once per hour per error type
    if (this.hourlyAlerts.has(alertKey)) {
      return;
    }
    
    this.hourlyAlerts.add(alertKey);
    
    console.error('');
    console.error('🚨═══════════════════════════════════════════════════════════');
    console.error(`🚨 HIGH ERROR RATE ALERT: ${category}`);
    console.error('🚨═══════════════════════════════════════════════════════════');
    console.error(`   Count: ${stats.count} occurrences`);
    console.error(`   First seen: ${stats.first_seen.toLocaleString()}`);
    console.error(`   Last seen: ${stats.last_seen.toLocaleString()}`);
    console.error(`   Severity: ${this.calculateSeverity(stats.count)}`);
    console.error('');
    console.error('   Recent messages:');
    stats.recent_messages.forEach((msg, i) => {
      console.error(`   ${i + 1}. ${msg.substring(0, 100)}`);
    });
    console.error('');
    console.error('🚨═══════════════════════════════════════════════════════════');
    console.error('');
    
    // Could extend this to send to Discord/Slack/Email
    // await this.sendDiscordAlert(category, stats);
  }
  
  /**
   * Get error stats for a category
   */
  getStats(category: string): ErrorStats[] {
    return Array.from(this.errorCounts.entries())
      .filter(([key]) => key.startsWith(category + ':'))
      .map(([_, stats]) => stats);
  }
  
  /**
   * Get all error stats
   */
  getAllStats(): Map<string, ErrorStats> {
    return new Map(this.errorCounts);
  }
  
  /**
   * Get top errors by frequency
   */
  getTopErrors(limit: number = 10): Array<{key: string; stats: ErrorStats}> {
    return Array.from(this.errorCounts.entries())
      .map(([key, stats]) => ({ key, stats }))
      .sort((a, b) => b.stats.count - a.stats.count)
      .slice(0, limit);
  }
  
  /**
   * Print error summary
   */
  printSummary(): void {
    const topErrors = this.getTopErrors(10);
    
    if (topErrors.length === 0) {
      console.log('\n✅ [ERROR_SUMMARY] No errors in the last hour\n');
      return;
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 ERROR SUMMARY (Last Hour)');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    topErrors.forEach((e, i) => {
      const severity = this.calculateSeverity(e.stats.count);
      const icon = severity === 'critical' ? '🔴' :
                   severity === 'high' ? '🟠' :
                   severity === 'medium' ? '🟡' : '⚪';
      
      console.log(`${i + 1}. ${icon} ${e.stats.category}`);
      console.log(`   Count: ${e.stats.count}`);
      console.log(`   Last: ${e.stats.recent_messages[e.stats.recent_messages.length - 1]?.substring(0, 80)}...`);
      console.log('');
    });
    
    console.log('═══════════════════════════════════════════════════════════\n');
  }
  
  /**
   * Reset all counts
   */
  reset(): void {
    this.errorCounts.clear();
    console.log('[ERROR_TRACKER] 🔄 Error counts reset');
  }
}

export const errorAggregator = ErrorAggregator.getInstance();

/**
 * Helper function to track errors easily
 */
export function trackError(category: string, error: Error | string, context?: Record<string, any>): void {
  errorAggregator.trackError(category, error, context).catch(err => {
    console.warn('[ERROR_TRACKER] Failed to track error:', err);
  });
}


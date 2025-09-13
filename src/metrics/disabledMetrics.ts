/**
 * Disabled Real Metrics Handler
 * Short-circuits real metrics collection when disabled
 */

import { isRealMetricsEnabled } from '../config/realMetrics';

/**
 * No-op real metrics collector for when disabled
 */
export class DisabledRealMetricsCollector {
  private static hasLoggedDisabled = false;
  
  public trackTweet(tweetData: any): void {
    if (!DisabledRealMetricsCollector.hasLoggedDisabled) {
      console.log('🚫 REAL_METRICS: disabled in prod');
      DisabledRealMetricsCollector.hasLoggedDisabled = true;
    }
    // No-op
  }
  
  public static getInstance(): DisabledRealMetricsCollector {
    return new DisabledRealMetricsCollector();
  }
}

/**
 * Factory function that returns appropriate metrics collector
 */
export function createRealMetricsCollector(): any {
  if (isRealMetricsEnabled()) {
    // Import and return the real collector
    const { RealTwitterMetricsCollector } = require('./realTwitterMetricsCollector');
    return RealTwitterMetricsCollector.getInstance();
  } else {
    // Return disabled collector
    return DisabledRealMetricsCollector.getInstance();
  }
}

/**
 * Conditional scheduler that only runs when metrics are enabled
 */
export function scheduleRealMetricsCollection(callback: () => void, interval: number): NodeJS.Timeout | null {
  if (!isRealMetricsEnabled()) {
    return null; // Don't schedule anything
  }
  
  return setInterval(callback, interval);
}

/**
 * Safe cleanup for conditional schedulers
 */
export function clearRealMetricsSchedule(timer: NodeJS.Timeout | null): void {
  if (timer) {
    clearInterval(timer);
  }
}

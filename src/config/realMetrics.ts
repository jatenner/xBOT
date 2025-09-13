/**
 * Real Metrics Configuration
 * Auto-disable browser-based metrics collection by default
 */

// Environment configuration
const REAL_METRICS_ENABLED = process.env.REAL_METRICS_ENABLED === 'true';
const POSTING_DISABLED = process.env.POSTING_DISABLED === 'true';
const ENVIRONMENT = process.env.NODE_ENV || 'production';

/**
 * Check if real metrics collection is enabled
 */
export function isRealMetricsEnabled(): boolean {
  // Disable by default in API service mode
  if (!REAL_METRICS_ENABLED) {
    return false;
  }
  
  // Also disable if posting is disabled (no point collecting metrics)
  if (POSTING_DISABLED) {
    return false;
  }
  
  return true;
}

/**
 * Get real metrics configuration
 */
export function getRealMetricsConfig() {
  const enabled = isRealMetricsEnabled();
  
  return {
    enabled,
    reason: enabled 
      ? 'Real metrics enabled' 
      : `Real metrics disabled (REAL_METRICS_ENABLED=${REAL_METRICS_ENABLED}, POSTING_DISABLED=${POSTING_DISABLED})`,
    browserRequired: enabled,
    collectionInterval: enabled ? 300000 : 0, // 5 minutes or disabled
    maxConcurrentCollections: enabled ? 3 : 0
  };
}

/**
 * Log real metrics status on startup (once only)
 */
export function logRealMetricsStatus(): void {
  const config = getRealMetricsConfig();
  
  if (config.enabled) {
    console.log('✅ REAL_METRICS: Enabled for browser-based collection');
  } else {
    console.log('🚫 REAL_METRICS: disabled in prod');
  }
}

// Static flag to prevent spam logging
let hasLoggedDisabled = false;

/**
 * Skip real metrics collection with appropriate logging
 */
export function skipRealMetricsCollection(context: string, tweetId?: string): void {
  const config = getRealMetricsConfig();
  
  if (!config.enabled) {
    // Log once, not repeatedly
    if (!hasLoggedDisabled) {
      console.log(`🚫 REAL_METRICS: Disabled - ${config.reason}`);
      hasLoggedDisabled = true;
    }
    return;
  }
  
  // If metrics are enabled but browser unavailable
  console.log(`🚫 REAL_METRICS: ${context}${tweetId ? ` for ${tweetId}` : ''} - browser unavailable`);
}

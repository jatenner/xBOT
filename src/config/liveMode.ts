/**
 * Centralized LIVE_POSTING_ENABLED configuration
 * Provides robust parsing with single startup log
 */

// Parse LIVE_POSTING_ENABLED with robust string handling
const rawValue = process.env.LIVE_POSTING_ENABLED;
const normalizedValue = rawValue?.trim().toLowerCase();
export const LIVE_MODE = normalizedValue === 'true';

// Log exactly once during module initialization
if (LIVE_MODE) {
  console.log('[LIVE] Live posting enabled - tweets will be posted to Twitter');
} else {
  console.log('[DRY RUN] Dry run mode - no tweets will be posted');
} 
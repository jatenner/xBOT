/**
 * Centralized LIVE_POSTING_ENABLED configuration
 * Provides robust parsing with single startup log
 */

import dotenv from 'dotenv';
import path from 'path';

// Force early .env loading (but skip in test environment to allow test control)
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

// Robust parser that handles multiple truthy formats
export const LIVE_MODE = /^(1|true|yes)$/i.test((process.env.LIVE_POSTING_ENABLED ?? '').trim());

// Log exactly once during module initialization (but skip in test environment)
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  if (LIVE_MODE) {
    console.log('[LIVE] Live posting enabled – tweets will be posted to Twitter');
  } else {
    console.log('[DRY RUN] Dry run mode – no tweets will be posted');
  }
} 
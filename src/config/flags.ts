/**
 * 🚩 FEATURE FLAGS - Thread posting control system
 */

// Core thread pipeline control
export const THREAD_PIPELINE_ONLY = process.env.THREAD_PIPELINE_ONLY === 'true';
export const AGGRESSIVE_SCHEDULER_ENABLED = process.env.AGGRESSIVE_SCHEDULER_ENABLED === 'true';
export const ENHANCED_ORCHESTRATOR_ENABLED = process.env.ENHANCED_ORCHESTRATOR_ENABLED === 'true';

// Safety controls
export const POSTING_DISABLED = process.env.POSTING_DISABLED === 'true';
export const DRY_RUN = process.env.DRY_RUN === 'true';

// Thread configuration
export const THREAD_MAX_TWEETS = parseInt(process.env.THREAD_MAX_TWEETS || '9');
export const THREAD_REPLY_DELAY_SEC = parseInt(process.env.THREAD_REPLY_DELAY_SEC || '2');
export const THREAD_RETRY_ATTEMPTS = parseInt(process.env.THREAD_RETRY_ATTEMPTS || '3');
export const PLAYWRIGHT_SAFE_SELECTORS = process.env.PLAYWRIGHT_SAFE_SELECTORS === 'true';
export const PLAYWRIGHT_NAV_TIMEOUT_MS = parseInt(process.env.PLAYWRIGHT_NAV_TIMEOUT_MS || '30000');

console.log('🚩 FEATURE_FLAGS_LOADED:', {
  THREAD_PIPELINE_ONLY,
  AGGRESSIVE_SCHEDULER_ENABLED,
  ENHANCED_ORCHESTRATOR_ENABLED,
  POSTING_DISABLED,
  DRY_RUN
});

export default {
  THREAD_PIPELINE_ONLY,
  AGGRESSIVE_SCHEDULER_ENABLED,
  ENHANCED_ORCHESTRATOR_ENABLED,
  POSTING_DISABLED,
  DRY_RUN,
  THREAD_MAX_TWEETS,
  THREAD_REPLY_DELAY_SEC,
  THREAD_RETRY_ATTEMPTS,
  PLAYWRIGHT_SAFE_SELECTORS,
  PLAYWRIGHT_NAV_TIMEOUT_MS
};

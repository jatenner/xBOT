/**
 * 🚩 SINGLE-SOURCE FEATURE FLAGS & MODE NORMALIZATION
 * Prevents legacy env vars from silently disabling posting in live mode
 */

import { resolveMode, type UnifiedMode } from './mode';

export function getMode(): UnifiedMode {
  return resolveMode().mode;
}

export const flags = (() => {
  const mode = getMode();
  const live = mode === 'live';
  
  // Posting can only be disabled by explicit DISABLE_POSTING flag, NOT by legacy vars
  const postingEnabled = live && process.env.DISABLE_POSTING !== 'true';

  // Normalize legacy envs so they cannot silently disable posting in live
  if (live) {
    process.env.DRY_RUN = 'false';
    process.env.POSTING_DISABLED = postingEnabled ? 'false' : 'true';
  }

  return {
    mode,
    MODE: mode,
    live,
    postingEnabled,
    plannerEnabled: true,
    replyEnabled: true,
    learnEnabled: true,
  };
})();

// Log mode on import for immediate visibility
console.log(`🚩 FEATURE_FLAGS: mode=${flags.mode} posting=${flags.postingEnabled ? 'ON' : 'OFF'}`);

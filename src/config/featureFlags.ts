/**
 * 🚩 SINGLE-SOURCE FEATURE FLAGS & MODE NORMALIZATION
 * Prevents legacy env vars from silently disabling posting in live mode
 */

export type Mode = 'live' | 'shadow' | 'dev' | 'test';

export function getMode(): Mode {
  const m = (process.env.MODE || 'dev').toLowerCase() as Mode;
  return (['live','shadow','dev','test'] as const).includes(m) ? m : 'dev';
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
    live,
    postingEnabled,
    plannerEnabled: true,
    replyEnabled: true,
    learnEnabled: true,
  };
})();

// Log mode on import for immediate visibility
console.log(`🚩 FEATURE_FLAGS: mode=${flags.mode} posting=${flags.postingEnabled ? 'ON' : 'OFF'}`);

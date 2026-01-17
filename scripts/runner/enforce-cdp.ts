#!/usr/bin/env tsx
/**
 * 🔒 ENFORCE CDP MODE HELPER
 * 
 * Ensures RUNNER_BROWSER=cdp when RUNNER_MODE=true
 * Call this at the start of any runner script
 */

export function enforceCDPMode(): void {
  if (process.env.RUNNER_MODE === 'true') {
    if (!process.env.RUNNER_BROWSER) {
      process.env.RUNNER_BROWSER = 'cdp';
    }
    if (process.env.RUNNER_BROWSER !== 'cdp') {
      console.warn(`[RUNNER] ⚠️ RUNNER_BROWSER=${process.env.RUNNER_BROWSER}, forcing to 'cdp'`);
      process.env.RUNNER_BROWSER = 'cdp';
    }
    console.log(`[RUNNER] ✅ Using RUNNER_BROWSER=cdp`);
  }
}

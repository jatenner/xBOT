/**
 * 🎯 EXECUTION MODE - Single Source of Truth
 * 
 * Centralized execution mode detection and validation.
 * All mode checks must use this module.
 */

import { isShadowMode } from '../safety/shadowMode';

/**
 * Get execution mode from environment
 * Default: 'control' (fail-closed)
 */
export function getExecutionMode(): 'control' | 'executor' {
  const mode = process.env.EXECUTION_MODE;
  if (mode === 'executor' || mode === 'control') {
    return mode;
  }
  return 'control'; // Default: fail-closed
}

/**
 * Check if RUNNER_MODE is enabled
 */
export function isRunnerMode(): boolean {
  return process.env.RUNNER_MODE === 'true';
}

/**
 * Check if current process is executor mode
 * Requires: EXECUTION_MODE=executor AND RUNNER_MODE=true
 */
export function isExecutor(): boolean {
  return getExecutionMode() === 'executor' && isRunnerMode();
}

/**
 * Validate executor mode requirements
 * Throws if not in executor mode
 */
export function requireExecutorMode(): void {
  if (!isExecutor()) {
    const mode = getExecutionMode();
    const runnerMode = isRunnerMode();
    throw new Error(
      `Executor mode required but not enabled: EXECUTION_MODE=${mode}, RUNNER_MODE=${runnerMode}. ` +
      `Required: EXECUTION_MODE=executor AND RUNNER_MODE=true`
    );
  }
}

/**
 * Get mode label for logging
 */
export function getModeLabel(): string {
  if (isExecutor()) {
    return 'executor';
  }
  return 'control';
}

/**
 * CDP mode: true when RUNNER_MODE=true and RUNNER_BROWSER=cdp (local authenticated executor path).
 */
export function isCdpExecutorMode(): boolean {
  return isRunnerMode() && (process.env.RUNNER_BROWSER || '').toLowerCase() === 'cdp';
}

/**
 * Log execution context for audit/debug (EXECUTION_MODE, RUNNER_MODE, BROWSER_POOL_MODE, auth source, SHADOW_MODE, local CDP active).
 * Call at start of reply_v2 planner/audit runs so logs show the actual path used.
 */
export function logExecutionContext(tag = 'EXECUTION_CONTEXT'): void {
  const executionMode = getExecutionMode();
  const runnerMode = isRunnerMode();
  const runnerBrowser = process.env.RUNNER_BROWSER || 'not set';
  const cdpMode = isCdpExecutorMode();
  const browserPoolMode = cdpMode ? 'CDP' : 'PLAYWRIGHT_LAUNCH';
  const authSource = isExecutor() ? 'local_chrome_profile' : 'railway_cookie_blob';
  const shadowMode = isShadowMode();
  const localCdpActive = cdpMode;
  console.log(
    `[${tag}] EXECUTION_MODE=${executionMode} RUNNER_MODE=${runnerMode} RUNNER_BROWSER=${runnerBrowser} BROWSER_POOL_MODE=${browserPoolMode} auth_source=${authSource} SHADOW_MODE=${shadowMode} local_cdp_profile_active=${localCdpActive}`
  );
}

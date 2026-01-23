/**
 * 🎯 EXECUTION MODE - Single Source of Truth
 * 
 * Centralized execution mode detection and validation.
 * All mode checks must use this module.
 */

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

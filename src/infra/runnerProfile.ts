/**
 * 🗂️ RUNNER PROFILE - Single Source of Truth
 * 
 * Centralized runner profile directory resolution and path utilities.
 * All executor paths must use this module.
 */

import * as path from 'path';
import * as fs from 'fs';

/**
 * Resolve runner profile directory (absolute path)
 * Default: ./.runner-profile relative to process.cwd()
 */
export function resolveRunnerProfileDir(): string {
  const envDir = process.env.RUNNER_PROFILE_DIR;
  if (envDir) {
    return path.isAbsolute(envDir) ? envDir : path.resolve(process.cwd(), envDir);
  }
  return path.resolve(process.cwd(), '.runner-profile');
}

/**
 * Ensure runner profile directory exists
 */
export function ensureRunnerProfileDir(): string {
  const dir = resolveRunnerProfileDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Get absolute path for a file under runner profile dir
 */
export function getRunnerProfilePath(relativePath: string): string {
  const profileDir = resolveRunnerProfileDir();
  return path.resolve(profileDir, relativePath);
}

/**
 * Common paths
 */
export const RUNNER_PROFILE_PATHS = {
  profileDir: () => resolveRunnerProfileDir(),
  pidFile: () => getRunnerProfilePath('executor.pid'),
  stopSwitch: () => getRunnerProfilePath('STOP_EXECUTOR'),
  authRequired: () => getRunnerProfilePath('AUTH_REQUIRED'),
  executorConfig: () => getRunnerProfilePath('EXECUTOR_CONFIG.json'),
  chromeProfile: () => getRunnerProfilePath('executor-chrome-profile'),
  logs: () => getRunnerProfilePath('executor.log'),
} as const;

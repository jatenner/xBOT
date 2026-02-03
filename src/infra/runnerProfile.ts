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
  authOk: () => getRunnerProfilePath('AUTH_OK.json'),
  executorConfig: () => getRunnerProfilePath('EXECUTOR_CONFIG.json'),
  chromeProfile: () => getRunnerProfilePath('executor-chrome-profile'),
  logs: () => getRunnerProfilePath('executor.log'),
} as const;

/**
 * 🔍 PHASE 1: Shared runner paths helper
 * 
 * Computes and returns all runner-related paths for consistent use across
 * auth/proof/daemon commands. Logs paths on every run.
 */
export interface RunnerPaths {
  runner_profile_dir_raw: string;
  runner_profile_dir_abs: string;
  user_data_dir_abs: string;
  auth_marker_path: string;
  cwd: string;
}

export function getRunnerPaths(): RunnerPaths {
  const cwd = process.cwd();
  const runnerProfileDirRaw = process.env.RUNNER_PROFILE_DIR || './.runner-profile';
  const runnerProfileDirAbs = resolveRunnerProfileDir();
  const userDataDirAbs = path.resolve(RUNNER_PROFILE_PATHS.chromeProfile());
  const authMarkerPath = RUNNER_PROFILE_PATHS.authOk();
  
  // Log paths on every run
  console.log(`[RUNNER_PATHS] 📋 Computed paths:`);
  console.log(`[RUNNER_PATHS]    CWD: ${cwd}`);
  console.log(`[RUNNER_PATHS]    RUNNER_PROFILE_DIR (raw): ${runnerProfileDirRaw}`);
  console.log(`[RUNNER_PATHS]    runner_profile_dir_abs: ${runnerProfileDirAbs}`);
  console.log(`[RUNNER_PATHS]    user_data_dir_abs: ${userDataDirAbs}`);
  console.log(`[RUNNER_PATHS]    auth_marker_path: ${authMarkerPath}`);
  console.log('');
  
  return {
    runner_profile_dir_raw: runnerProfileDirRaw,
    runner_profile_dir_abs: runnerProfileDirAbs,
    user_data_dir_abs: userDataDirAbs,
    auth_marker_path: authMarkerPath,
    cwd,
  };
}

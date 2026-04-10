/**
 * 🎯 CENTRALIZED SESSION PATH RESOLVER
 *
 * Single source of truth for resolving Twitter session file path:
 * 1. SESSION_CANONICAL_PATH env var (highest priority)
 * 2. /data/twitter_session.json if /data exists (Railway volume)
 * 3. RUNNER_MODE: .runner-profile/twitter_session.json (local Mac executor)
 * 4. /app/data/twitter_session.json (Railway container fallback)
 * 5. data/twitter_session.json under cwd (other local)
 */

import fs from 'fs';
import path from 'path';
import { resolveRunnerProfileDir } from '../infra/runnerProfile';

let resolvedPath: string | null = null;

/** True when running as local Mac executor/runner (repo-local paths only, never /app/data). */
function isRunnerMode(): boolean {
  const v = process.env.RUNNER_MODE;
  return v === 'true' || v === '1' || v === true;
}

/**
 * Resolve the canonical session file path
 * Priority:
 * 1. X_COOKIE_PATH env var (account-specific, for Shadow Mode multi-account)
 * 2. SESSION_CANONICAL_PATH env var
 * 3. RUNNER_MODE → .runner-profile/twitter_session.json (local executor; never use cache so we never return /app/data)
 * 4. /data/twitter_session.json if /data directory exists (Railway volume)
 * 5. /app/data/twitter_session.json if /app/data exists (Railway container)
 * 6. cwd/data/twitter_session.json (local dev)
 */
export function resolveSessionPath(): string {
  // When RUNNER_MODE: always use repo-local runner path first (never /app/data or SESSION_CANONICAL_PATH)
  if (isRunnerMode()) {
    const runnerDir = resolveRunnerProfileDir();
    const pathResolved = path.join(runnerDir, 'twitter_session.json');
    resolvedPath = pathResolved;
    return pathResolved;
  }

  // Cache for non-runner mode only
  if (resolvedPath) {
    return ensureRunnerPathIfNeeded(resolvedPath);
  }

  // Priority 0: Account-specific cookie path (Shadow Mode multi-account)
  if (process.env.X_COOKIE_PATH) {
    resolvedPath = process.env.X_COOKIE_PATH;
    return resolvedPath;
  }

  // Priority 1: Explicit env var (not used in runner mode – handled above)
  if (process.env.SESSION_CANONICAL_PATH) {
    resolvedPath = process.env.SESSION_CANONICAL_PATH;
    return resolvedPath;
  }

  // Priority 3: Check if /data exists (Railway volume)
  try {
    if (fs.existsSync('/data') && fs.statSync('/data').isDirectory()) {
      try {
        fs.accessSync('/data', fs.constants.W_OK);
        resolvedPath = '/data/twitter_session.json';
        console.log(`[SESSION_PATH] ✅ Using Railway volume: /data/twitter_session.json`);
        return resolvedPath;
      } catch (accessError: any) {
        console.warn(`[SESSION_PATH] ⚠️ /data exists but not writable: ${accessError.message}, using anyway`);
        resolvedPath = '/data/twitter_session.json';
        return resolvedPath;
      }
    }
  } catch (e: any) {
    // /data doesn't exist or not accessible
  }

  // Priority 4: Railway container – /app/data exists
  if (fs.existsSync('/app/data')) {
    resolvedPath = '/app/data/twitter_session.json';
    return ensureRunnerPathIfNeeded(resolvedPath);
  }

  // Priority 5: Other local (e.g. dev without runner) – cwd/data
  resolvedPath = path.join(process.cwd(), 'data', 'twitter_session.json');
  return ensureRunnerPathIfNeeded(resolvedPath);
}

/**
 * Ensure returned path is never /app/data when RUNNER_MODE is set (safety net for any cached or legacy path).
 */
function ensureRunnerPathIfNeeded(resolved: string): string {
  if (isRunnerMode() && resolved.startsWith('/app/data')) {
    const runnerDir = resolveRunnerProfileDir();
    return path.join(runnerDir, 'twitter_session.json');
  }
  return resolved;
}

/**
 * Get session path info for logging
 */
export function getSessionPathInfo(): {
  envVar: string | undefined;
  resolvedPath: string;
  exists: boolean;
  size?: number;
  mtime?: string;
  writable: boolean;
} {
  const envVar = process.env.SESSION_CANONICAL_PATH;
  const path = resolveSessionPath();
  let exists = false;
  let size: number | undefined;
  let mtime: string | undefined;
  let writable = false;
  
  try {
    if (fs.existsSync(path)) {
      exists = true;
      const stats = fs.statSync(path);
      size = stats.size;
      mtime = stats.mtime.toISOString();
    }
    
    // Check if directory is writable
    const dir = path.substring(0, path.lastIndexOf('/'));
    try {
      fs.accessSync(dir, fs.constants.W_OK);
      writable = true;
    } catch {
      writable = false;
    }
  } catch (e) {
    // Path doesn't exist or not accessible
  }
  
  return {
    envVar,
    resolvedPath: path,
    exists,
    size,
    mtime,
    writable,
  };
}

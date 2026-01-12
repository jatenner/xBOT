/**
 * 🎯 CENTRALIZED SESSION PATH RESOLVER
 * 
 * Single source of truth for resolving Twitter session file path:
 * 1. SESSION_CANONICAL_PATH env var (highest priority)
 * 2. /data/twitter_session.json if /data exists (Railway volume)
 * 3. /app/data/twitter_session.json (fallback)
 */

import fs from 'fs';

let resolvedPath: string | null = null;

/**
 * Resolve the canonical session file path
 * Priority:
 * 1. SESSION_CANONICAL_PATH env var
 * 2. /data/twitter_session.json if /data directory exists
 * 3. /app/data/twitter_session.json (fallback)
 */
export function resolveSessionPath(): string {
  if (resolvedPath) {
    return resolvedPath;
  }
  
  // Priority 1: Explicit env var
  if (process.env.SESSION_CANONICAL_PATH) {
    resolvedPath = process.env.SESSION_CANONICAL_PATH;
    return resolvedPath;
  }
  
  // Priority 2: Check if /data exists (Railway volume)
  // 🎯 REQUIREMENT: If /data exists, MUST use it (it's a real volume)
  try {
    if (fs.existsSync('/data') && fs.statSync('/data').isDirectory()) {
      // Check if writable
      try {
        fs.accessSync('/data', fs.constants.W_OK);
        resolvedPath = '/data/twitter_session.json';
        console.log(`[SESSION_PATH] ✅ Using Railway volume: /data/twitter_session.json`);
        return resolvedPath;
      } catch (accessError: any) {
        // /data exists but not writable - log warning but still use it (may be permission issue)
        console.warn(`[SESSION_PATH] ⚠️ /data exists but not writable: ${accessError.message}, using anyway`);
        resolvedPath = '/data/twitter_session.json';
        return resolvedPath;
      }
    } else {
      // /data doesn't exist - log warning and use fallback
      console.warn(`[SESSION_PATH] ⚠️ Railway volume /data not found, using fallback /app/data/twitter_session.json`);
    }
  } catch (e: any) {
    // /data doesn't exist or not accessible
    console.warn(`[SESSION_PATH] ⚠️ Could not check /data: ${e.message}, using fallback`);
  }
  
  // Priority 3: Fallback to /app/data (always writable in Railway containers)
  resolvedPath = '/app/data/twitter_session.json';
  return resolvedPath;
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

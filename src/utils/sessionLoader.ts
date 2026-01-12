import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';

export interface SessionLoadResult {
  ok: boolean;
  cookieCount: number;
  path: string;
  source: 'env' | 'file' | 'none';
  reason?: string;
  updatedAt?: string;
}

interface SessionData {
  cookies?: Array<{ name: string; [key: string]: any }>;
  origins?: any[];
}

/**
 * Robust session loader with bulletproof validation and diagnostics
 */
export class SessionLoader {
  private static lastResult: SessionLoadResult | null = null;
  
  /**
   * Main session loading function with robust validation
   */
  static load(): SessionLoadResult {
    const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
    // Railway volumes are typically mounted at /data, fallback to /app/data for local/dev
    const canonicalPath = process.env.SESSION_CANONICAL_PATH || 
      (process.env.RAILWAY_ENVIRONMENT ? '/data/twitter_session.json' : '/app/data/twitter_session.json');
    
    // Calculate fingerprint (first 12 chars of SHA256)
    const hasB64 = !!sessionB64;
    const b64Len = sessionB64?.length || 0;
    let b64Sha12 = 'none';
    if (sessionB64) {
      const sha256 = createHash('sha256').update(sessionB64).digest('hex');
      b64Sha12 = sha256.substring(0, 12);
    }
    
    // Log session fingerprint on load
    console.log(`[SESSION] has_b64=${hasB64} b64_len=${b64Len} b64_sha12=${b64Sha12}`);
    
    // Ensure directory exists
    const dir = path.dirname(canonicalPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Try to load from environment variable first
    if (sessionB64 && sessionB64.length > 0) {
      const envResult = this.loadFromEnv(sessionB64, canonicalPath);
      if (envResult.ok) {
        this.lastResult = envResult;
        return envResult;
      }
      // If env failed, try existing file (don't overwrite good file with bad env)
    }

    // Try to load from existing file
    const fileResult = this.loadFromFile(canonicalPath);
    this.lastResult = fileResult;
    return fileResult;
  }

  /**
   * Load and validate session from environment variable
   */
  private static loadFromEnv(sessionB64: string, canonicalPath: string): SessionLoadResult {
    try {
      let jsonString: string;
      
      // If string starts with "{", treat as raw JSON (not base64)
      if (sessionB64.startsWith('{')) {
        jsonString = sessionB64;
      } else {
        // Try base64 decode
        try {
          jsonString = Buffer.from(sessionB64, 'base64').toString('utf8');
        } catch (error) {
          console.log(`SESSION_LOADER: invalid base64 in TWITTER_SESSION_B64 (length=${sessionB64.length}); ignoring env`);
          return { ok: false, cookieCount: 0, path: canonicalPath, source: 'none', reason: 'invalid_b64' };
        }
      }

      // Try JSON parse
      let sessionData: SessionData;
      try {
        sessionData = JSON.parse(jsonString);
      } catch (error) {
        console.log(`SESSION_LOADER: decoded string is not JSON; ignoring env`);
        return { ok: false, cookieCount: 0, path: canonicalPath, source: 'none', reason: 'not_json' };
      }

      // Validate shape has cookies array
      if (!sessionData.cookies || !Array.isArray(sessionData.cookies)) {
        console.log(`SESSION_LOADER: parsed JSON missing cookies array; ignoring env`);
        return { ok: false, cookieCount: 0, path: canonicalPath, source: 'none', reason: 'no_cookies' };
      }

      // Write atomically to avoid corruption
      const cookieCount = sessionData.cookies.length;
      const tempPath = canonicalPath + '.tmp';
      
      try {
        const sessionJson = JSON.stringify(sessionData, null, 2);
        fs.writeFileSync(tempPath, sessionJson);
        fs.renameSync(tempPath, canonicalPath);
        
        // Log session file write
        const fileBytes = Buffer.byteLength(sessionJson, 'utf8');
        console.log(`[SESSION] wrote_session_file=${canonicalPath} cookies_count=${cookieCount} bytes=${fileBytes}`);
        console.log(`SESSION_LOADER: wrote valid session to ${canonicalPath} (cookies=${cookieCount})`);
        
        return {
          ok: true,
          cookieCount,
          path: canonicalPath,
          source: 'env',
          updatedAt: new Date().toISOString()
        };
      } catch (writeError) {
        console.error(`SESSION_LOADER: failed to write session file: ${writeError}`);
        return { ok: false, cookieCount: 0, path: canonicalPath, source: 'none', reason: 'write_failed' };
      }

    } catch (error) {
      console.log(`SESSION_LOADER: unexpected error processing env; ignoring env`);
      return { ok: false, cookieCount: 0, path: canonicalPath, source: 'none', reason: 'unexpected_error' };
    }
  }

  /**
   * Load session from existing file
   */
  private static loadFromFile(canonicalPath: string): SessionLoadResult {
    if (!fs.existsSync(canonicalPath)) {
      return { ok: false, cookieCount: 0, path: canonicalPath, source: 'none', reason: 'no_file' };
    }

    try {
      const fileContent = fs.readFileSync(canonicalPath, 'utf8');
      const sessionData = JSON.parse(fileContent);
      
      if (!sessionData.cookies || !Array.isArray(sessionData.cookies)) {
        return { ok: false, cookieCount: 0, path: canonicalPath, source: 'none', reason: 'invalid_file' };
      }

      const cookieCount = sessionData.cookies.length;
      console.log(`SESSION_LOADER: using existing session file (cookies=${cookieCount})`);
      
      const stats = fs.statSync(canonicalPath);
      return {
        ok: true,
        cookieCount,
        path: canonicalPath,
        source: 'file',
        updatedAt: stats.mtime.toISOString()
      };

    } catch (error) {
      console.log(`SESSION_LOADER: existing file found but invalid; ignoring`);
      return { ok: false, cookieCount: 0, path: canonicalPath, source: 'none', reason: 'corrupt_file' };
    }
  }

  /**
   * Get last load result for health endpoint
   */
  static getLastResult(): SessionLoadResult | null {
    return this.lastResult;
  }

  /**
   * Save current storage state back to file after successful post
   * Optionally prints masked base64 for rotation if PRINT_SESSION_B64_ON_SAVE=true
   */
  static saveStorageStateBack(storageState: SessionData): void {
    try {
      const canonicalPath = process.env.SESSION_CANONICAL_PATH || '/app/data/twitter_session.json';
      const dir = path.dirname(canonicalPath);
      
      // Ensure directory exists
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Write updated session atomically
      const tempPath = canonicalPath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify(storageState, null, 2));
      fs.renameSync(tempPath, canonicalPath);
      
      const cookieCount = storageState.cookies ? storageState.cookies.length : 0;
      console.log(`SESSION_LOADER: saved updated session with ${cookieCount} cookies`);
      
      // Update last result
      this.lastResult = {
        ok: true,
        cookieCount,
        path: canonicalPath,
        source: 'file',
        updatedAt: new Date().toISOString()
      };
      
      // Optional debug helper for session rotation
      if (process.env.PRINT_SESSION_B64_ON_SAVE === 'true') {
        const encoded = Buffer.from(JSON.stringify(storageState)).toString('base64');
        const masked = encoded.substring(0, 20) + '...' + encoded.substring(encoded.length - 20);
        console.log(`SESSION_EXPORT: base64 updated (masked: ${masked}) — copy to TWITTER_SESSION_B64 if you rotated login`);
      }
      
    } catch (error) {
      console.error(`SESSION_LOADER: Failed to save storage state back: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use SessionLoader.load() instead
 */
export function ensureTwitterSessionReady(): void {
  const result = SessionLoader.load();
  if (!result.ok) {
    console.log('WARNING: No valid Twitter session found — running in read-only until session is configured');
  }
}

/**
 * Legacy function for backward compatibility  
 * @deprecated Use SessionLoader.saveStorageStateBack() instead
 */
export function saveStorageStateBack(storageState: any): void {
  SessionLoader.saveStorageStateBack(storageState);
}
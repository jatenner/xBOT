/**
 * 🔐 BULLETPROOF RAILWAY SESSION MANAGER
 *
 * Unified session management for Railway deployment
 * Handles all session loading scenarios with proper fallbacks
 * RUNNER_MODE: uses resolver only (never /app/data)
 */

import fs from 'fs';
import path from 'path';
import type { Cookie } from 'playwright';

export interface SessionData {
  cookies: Cookie[];
  timestamp?: number;
  source?: 'file' | 'env' | 'none';
}

function getSessionPaths(): string[] {
  if (process.env.RUNNER_MODE === 'true' || process.env.RUNNER_MODE === '1') {
    const { resolveSessionPath } = require('../../utils/sessionPathResolver');
    return [resolveSessionPath(), '/tmp/xbot-session.json'].filter(Boolean);
  }
  return [
    '/tmp/xbot-session.json',
    process.env.XBOT_SESSION_PATH,
    './data/twitter_session.json',
    '/app/data/twitter_session.json'
  ].filter(Boolean) as string[];
}

export class RailwaySessionManager {
  private static instance: RailwaySessionManager;
  private sessionCache: SessionData | null = null;
  private get SESSION_PATHS(): string[] {
    return getSessionPaths();
  }

  public static getInstance(): RailwaySessionManager {
    if (!RailwaySessionManager.instance) {
      RailwaySessionManager.instance = new RailwaySessionManager();
    }
    return RailwaySessionManager.instance;
  }

  /**
   * 🔄 Load session with comprehensive fallback strategy
   */
  async loadSession(): Promise<SessionData> {
    if (this.sessionCache) {
      console.log('📋 Using cached session data');
      return this.sessionCache;
    }

    console.log('🔍 RAILWAY_SESSION: Loading Twitter session...');

    // Strategy 1: Try environment variable first (most reliable on Railway)
    const envSession = await this.loadFromEnvironment();
    if (envSession.cookies.length > 0) {
      this.sessionCache = envSession;
      return envSession;
    }

    // Strategy 2: Try file paths
    const fileSession = await this.loadFromFiles();
    if (fileSession.cookies.length > 0) {
      this.sessionCache = fileSession;
      return fileSession;
    }

    // Strategy 3: Return empty session with error
    console.error('❌ RAILWAY_SESSION: No valid session found');
    return { cookies: [], source: 'none' };
  }

  /**
   * 🌐 Load from TWITTER_SESSION_B64 environment variable
   */
  private async loadFromEnvironment(): Promise<SessionData> {
    try {
      const sessionB64 = process.env.TWITTER_SESSION_B64?.trim();
      
      if (!sessionB64) {
        console.log('📋 RAILWAY_SESSION: No TWITTER_SESSION_B64 found');
        return { cookies: [], source: 'env' };
      }

      console.log(`📋 RAILWAY_SESSION: Found TWITTER_SESSION_B64 (${sessionB64.length} chars)`);
      
      // Decode base64
      const decoded = Buffer.from(sessionB64, 'base64').toString('utf8');
      const sessionData = JSON.parse(decoded);
      
      // Normalize cookie format
      const cookies = this.normalizeCookies(sessionData.cookies || sessionData);
      const duplicatedCookies = this.duplicateForBothDomains(cookies);
      
      console.log(`✅ RAILWAY_SESSION: Loaded ${duplicatedCookies.length} cookies from environment`);
      
      return {
        cookies: duplicatedCookies,
        timestamp: Date.now(),
        source: 'env'
      };
      
    } catch (error) {
      console.error('❌ RAILWAY_SESSION: Failed to load from environment:', error.message);
      return { cookies: [], source: 'env' };
    }
  }

  /**
   * 📁 Load from file paths
   */
  private async loadFromFiles(): Promise<SessionData> {
    for (const sessionPath of this.SESSION_PATHS) {
      try {
        if (fs.existsSync(sessionPath)) {
          console.log(`📋 RAILWAY_SESSION: Trying file: ${sessionPath}`);
          
          const data = fs.readFileSync(sessionPath, 'utf8');
          const sessionData = JSON.parse(data);
          
          const cookies = this.normalizeCookies(sessionData.cookies || sessionData);
          const duplicatedCookies = this.duplicateForBothDomains(cookies);
          
          console.log(`✅ RAILWAY_SESSION: Loaded ${duplicatedCookies.length} cookies from file`);
          
          return {
            cookies: duplicatedCookies,
            timestamp: Date.now(),
            source: 'file'
          };
        }
      } catch (error) {
        console.log(`⚠️ RAILWAY_SESSION: Failed to load ${sessionPath}: ${error.message}`);
      }
    }
    
    return { cookies: [], source: 'file' };
  }

  /**
   * 🔄 Normalize cookie format
   */
  private normalizeCookies(rawCookies: any[]): Cookie[] {
    if (!Array.isArray(rawCookies)) {
      console.warn('⚠️ RAILWAY_SESSION: Invalid cookies format, expected array');
      return [];
    }

    return rawCookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain || '.x.com',
      path: cookie.path || '/',
      expires: cookie.expires || Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year default
      httpOnly: cookie.httpOnly || false,
      secure: cookie.secure !== false, // Default to true
      sameSite: cookie.sameSite || 'Lax'
    }));
  }

  /**
   * 🔄 Duplicate cookies for both .twitter.com and .x.com domains
   */
  private duplicateForBothDomains(cookies: Cookie[]): Cookie[] {
    const result: Cookie[] = [];
    const seen = new Set<string>();

    for (const cookie of cookies) {
      const domain = cookie.domain || '';
      
      if (domain.includes('twitter.com') || domain.includes('x.com')) {
        // Create for both domains
        const twitterCookie = { ...cookie, domain: '.twitter.com' };
        const xCookie = { ...cookie, domain: '.x.com' };
        
        const twitterKey = `${twitterCookie.name}|${twitterCookie.domain}|${twitterCookie.path}`;
        const xKey = `${xCookie.name}|${xCookie.domain}|${xCookie.path}`;
        
        if (!seen.has(twitterKey)) {
          result.push(twitterCookie);
          seen.add(twitterKey);
        }
        
        if (!seen.has(xKey)) {
          result.push(xCookie);
          seen.add(xKey);
        }
      } else {
        // Keep original
        const key = `${cookie.name}|${cookie.domain}|${cookie.path}`;
        if (!seen.has(key)) {
          result.push(cookie);
          seen.add(key);
        }
      }
    }

    return result;
  }

  /**
   * 🧪 Validate session has required cookies
   */
  validateSession(sessionData: SessionData): boolean {
    const requiredCookies = ['auth_token', 'ct0', 'twid'];
    const cookieNames = sessionData.cookies.map(c => c.name);
    
    const hasRequired = requiredCookies.some(required => 
      cookieNames.some(name => name.includes(required))
    );
    
    console.log(`🧪 RAILWAY_SESSION: Validation - Has required cookies: ${hasRequired}`);
    console.log(`🧪 RAILWAY_SESSION: Available cookies: ${cookieNames.slice(0, 5).join(', ')}...`);
    
    return hasRequired && sessionData.cookies.length > 0;
  }

  /**
   * 🗑️ Clear session cache
   */
  clearCache(): void {
    this.sessionCache = null;
    console.log('🗑️ RAILWAY_SESSION: Cache cleared');
  }

  /**
   * 📊 Get session status
   */
  getStatus(): { loaded: boolean; source?: string; cookieCount: number } {
    return {
      loaded: !!this.sessionCache,
      source: this.sessionCache?.source,
      cookieCount: this.sessionCache?.cookies.length || 0
    };
  }
}

// Export singleton instance
export const railwaySessionManager = RailwaySessionManager.getInstance();

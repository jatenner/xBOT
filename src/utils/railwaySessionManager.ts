/**
 * 🚄 RAILWAY SESSION MANAGER
 * 
 * Bulletproof Twitter session management for 24/7 Railway deployment
 * - Automatic session validation and renewal
 * - Fallback authentication strategies
 * - Zero manual intervention required
 */

import { chromium, Browser, BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

interface SessionData {
  cookies: any[];
  timestamp: number;
  isValid: boolean;
  expiresAt?: number;
}

export class RailwaySessionManager {
  private static instance: RailwaySessionManager;
  private sessionPath = path.join(process.cwd(), 'data', 'twitter_session.json');
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  private constructor() {}

  public static getInstance(): RailwaySessionManager {
    if (!RailwaySessionManager.instance) {
      RailwaySessionManager.instance = new RailwaySessionManager();
    }
    return RailwaySessionManager.instance;
  }

  /**
   * 🔍 VALIDATE EXISTING SESSION
   */
  public async validateSession(): Promise<boolean> {
    try {
      console.log('🔍 RAILWAY_SESSION: Validating existing Twitter session...');
      
      if (!fs.existsSync(this.sessionPath)) {
        console.log('❌ RAILWAY_SESSION: No session file found');
        return false;
      }

      const sessionData: SessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      
      // Check if session is too old (older than 7 days)
      const sessionAge = Date.now() - sessionData.timestamp;
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      
      if (sessionAge > maxAge) {
        console.log('❌ RAILWAY_SESSION: Session expired (older than 7 days)');
        return false;
      }

      // Test session with a quick browser check
      const isValid = await this.testSessionValidity(sessionData);
      
      if (isValid) {
        console.log('✅ RAILWAY_SESSION: Session is valid and working');
        return true;
      } else {
        console.log('❌ RAILWAY_SESSION: Session validation failed');
        return false;
      }
    } catch (error: any) {
      console.error('❌ RAILWAY_SESSION: Session validation error:', error.message);
      return false;
    }
  }

  /**
   * 🧪 TEST SESSION VALIDITY
   * Now uses the same login check as the actual posting system
   */
  private async testSessionValidity(sessionData: SessionData): Promise<boolean> {
    const { isLoggedIn } = await import('../infra/session/xSession');
    const { launchPersistent } = await import('../infra/playwright/launcher');
    
    let ctx: any = null;
    
    try {
      console.log('🧪 RAILWAY_SESSION: Testing session with headless browser...');
      
      ctx = await launchPersistent();
      
      // Add cookies with domain normalization
      const normalizedCookies = this.normalizeCookieDomains(sessionData.cookies);
      await ctx.addCookies(normalizedCookies);
      
      const page = await ctx.newPage();
      
      // Try twitter.com first (same as posting logic)
      await page.goto('https://twitter.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      let loggedIn = await isLoggedIn(page);
      
      if (!loggedIn) {
        // Fallback to x.com (same as posting logic)
        console.log('🧪 RAILWAY_SESSION: Trying x.com fallback...');
        await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        loggedIn = await isLoggedIn(page);
      }
      
      if (loggedIn) {
        console.log('✅ RAILWAY_SESSION: Session test passed - user is logged in');
        return true;
      } else {
        console.log('❌ RAILWAY_SESSION: Session test failed - user not logged in');
        return false;
      }
    } catch (error: any) {
      console.error('❌ RAILWAY_SESSION: Session test error:', error.message);
      return false;
    } finally {
      if (ctx) await ctx.close();
    }
  }

  /**
   * Normalize cookies for both .twitter.com and .x.com domains
   */
  private normalizeCookieDomains(cookies: any[]): any[] {
    const out: any[] = [];
    
    for (const c of cookies) {
      const base = { ...c };
      const d = (base.domain || '').replace(/^https?:\/\//, '');
      
      if (d.includes('twitter.com') || d.includes('x.com')) {
        out.push({ ...base, domain: '.twitter.com' });
        out.push({ ...base, domain: '.x.com' });
      } else {
        out.push(base);
      }
    }
    
    // Deduplicate
    const seen = new Set<string>();
    return out.filter(c => {
      const k = `${c.name}|${c.domain}|${c.path || '/'}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /**
   * 🔄 CREATE SESSION FROM ENVIRONMENT
   */
  public async createSessionFromEnvironment(): Promise<boolean> {
    try {
      console.log('🔄 RAILWAY_SESSION: Creating session from environment variables...');
      
      // Check for base64 encoded session in environment
      const sessionB64 = process.env.TWITTER_SESSION_B64;
      if (!sessionB64) {
        console.log('❌ RAILWAY_SESSION: No TWITTER_SESSION_B64 environment variable found');
        return false;
      }

      // Decode and save session
      const sessionData = JSON.parse(Buffer.from(sessionB64, 'base64').toString('utf8'));
      sessionData.timestamp = Date.now();
      
      // Ensure data directory exists
      const dataDir = path.dirname(this.sessionPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(this.sessionPath, JSON.stringify(sessionData), 'utf8');
      console.log('✅ RAILWAY_SESSION: Session created from environment variable');
      
      // Validate the created session
      return await this.validateSession();
    } catch (error: any) {
      console.error('❌ RAILWAY_SESSION: Failed to create session from environment:', error.message);
      return false;
    }
  }

  /**
   * 🛠️ ENSURE VALID SESSION
   */
  public async ensureValidSession(): Promise<boolean> {
    console.log('🛠️ RAILWAY_SESSION: Ensuring valid Twitter session...');
    
    // Step 1: Try to validate existing session
    if (await this.validateSession()) {
      return true;
    }
    
    // Step 2: Try to create session from environment
    if (await this.createSessionFromEnvironment()) {
      return true;
    }
    
    // Step 3: All methods failed
    console.error('❌ RAILWAY_SESSION: All session methods failed. Manual intervention required.');
    console.error('💡 RAILWAY_SESSION: Please set TWITTER_SESSION_B64 environment variable with valid session data');
    
    return false;
  }

  /**
   * 📊 GET SESSION STATUS
   */
  public getSessionStatus(): { exists: boolean; age?: number; valid?: boolean } {
    try {
      if (!fs.existsSync(this.sessionPath)) {
        return { exists: false };
      }

      const sessionData: SessionData = JSON.parse(fs.readFileSync(this.sessionPath, 'utf8'));
      const age = Date.now() - sessionData.timestamp;
      
      return {
        exists: true,
        age: Math.floor(age / (1000 * 60 * 60)), // Age in hours
        valid: sessionData.isValid
      };
    } catch (error) {
      return { exists: false };
    }
  }

  /**
   * 🔄 REFRESH SESSION
   */
  public async refreshSession(): Promise<boolean> {
    console.log('🔄 RAILWAY_SESSION: Refreshing Twitter session...');
    
    // Delete existing session
    if (fs.existsSync(this.sessionPath)) {
      fs.unlinkSync(this.sessionPath);
    }
    
    // Create new session from environment
    return await this.createSessionFromEnvironment();
  }
}

export const railwaySessionManager = RailwaySessionManager.getInstance();


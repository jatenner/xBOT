/**
 * TWITTER SESSION RECOVERY SYSTEM
 * 
 * Handles Twitter login issues and session recovery for Railway deployment
 * - Detects login failures
 * - Attempts automatic recovery
 * - Provides manual recovery instructions
 * - Graceful degradation to read-only mode
 */

import { Page, BrowserContext } from 'playwright';
import { PlaywrightFactory } from './browser';
import { isLoggedIn } from './xLoggedIn';
import fs from 'fs';
import path from 'path';

export interface SessionHealth {
  isValid: boolean;
  canPost: boolean;
  lastCheck: Date;
  cookieCount: number;
  recovery: {
    attempted: boolean;
    successful: boolean;
    method?: string;
    error?: string;
  };
}

export class TwitterSessionRecovery {
  private static instance: TwitterSessionRecovery;
  private lastHealthCheck: SessionHealth | null = null;
  private recoveryAttempts = 0;
  private maxRecoveryAttempts = 3;

  private constructor() {}

  public static getInstance(): TwitterSessionRecovery {
    if (!TwitterSessionRecovery.instance) {
      TwitterSessionRecovery.instance = new TwitterSessionRecovery();
    }
    return TwitterSessionRecovery.instance;
  }

  /**
   * Check Twitter session health
   */
  public async checkSessionHealth(): Promise<SessionHealth> {
    try {
      console.log('🔍 Checking Twitter session health...');
      
      const sessionPath = this.getSessionPath();
      const cookieCount = this.getCookieCount(sessionPath);
      
      // Basic session file check
      if (cookieCount === 0) {
        console.log('❌ No Twitter session cookies found');
        return this.createHealthResult(false, false, cookieCount, {
          attempted: false,
          successful: false,
          error: 'No session cookies'
        });
      }

      // Advanced login check with Playwright
      const canPost = await this.testPostingCapability();
      
      const health = this.createHealthResult(
        cookieCount > 0,
        canPost,
        cookieCount,
        {
          attempted: false,
          successful: false
        }
      );

      this.lastHealthCheck = health;
      return health;

    } catch (error) {
      console.error('❌ Session health check failed:', error.message);
      return this.createHealthResult(false, false, 0, {
        attempted: false,
        successful: false,
        error: error.message
      });
    }
  }

  /**
   * Test if we can actually post (not just check login)
   */
  private async testPostingCapability(): Promise<boolean> {
    try {
      const factory = PlaywrightFactory.getInstance();
      const { page, ctx } = await factory.getPageWithStorage();
      
      try {
        // Check if logged in
        const loggedIn = await isLoggedIn(page);
        if (!loggedIn) {
          console.log('❌ Login check failed');
          return false;
        }

        // Try to access composer (more thorough than just login check)
        await page.goto('https://x.com/compose/tweet', { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        });
        
        // Look for compose textarea
        const composer = await page.locator('[data-testid="tweetTextarea_0"]').first();
        const composerVisible = await composer.isVisible({ timeout: 5000 }).catch(() => false);
        
        if (!composerVisible) {
          console.log('❌ Composer not accessible');
          return false;
        }

        console.log('✅ Posting capability confirmed');
        return true;

      } finally {
        await ctx.close();
      }

    } catch (error) {
      console.error('❌ Posting capability test failed:', error.message);
      return false;
    }
  }

  /**
   * Attempt to recover Twitter session
   */
  public async attemptRecovery(): Promise<SessionHealth> {
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      console.log('❌ Max recovery attempts reached');
      return this.createHealthResult(false, false, 0, {
        attempted: true,
        successful: false,
        error: 'Max recovery attempts reached'
      });
    }

    this.recoveryAttempts++;
    console.log(`🔧 Attempting session recovery (${this.recoveryAttempts}/${this.maxRecoveryAttempts})...`);

    try {
      // Method 1: Check environment variables
      const envRecovery = await this.recoverFromEnvironment();
      if (envRecovery.successful) {
        return this.createHealthResult(true, true, 0, envRecovery);
      }

      // Method 2: Regenerate session if we have credentials
      const regenRecovery = await this.regenerateSession();
      if (regenRecovery.successful) {
        return this.createHealthResult(true, true, 0, regenRecovery);
      }

      // Method 3: Provide manual recovery instructions
      this.provideManualRecoveryInstructions();
      
      return this.createHealthResult(false, false, 0, {
        attempted: true,
        successful: false,
        method: 'manual_required',
        error: 'Manual session recovery required'
      });

    } catch (error) {
      console.error('❌ Session recovery failed:', error.message);
      return this.createHealthResult(false, false, 0, {
        attempted: true,
        successful: false,
        error: error.message
      });
    }
  }

  /**
   * Try to recover from TWITTER_SESSION_B64 environment variable
   */
  private async recoverFromEnvironment(): Promise<{ attempted: boolean; successful: boolean; method?: string; error?: string }> {
    try {
      const sessionB64 = process.env.TWITTER_SESSION_B64;
      
      if (!sessionB64) {
        return {
          attempted: true,
          successful: false,
          error: 'TWITTER_SESSION_B64 not found in environment'
        };
      }

      console.log('🔧 Attempting recovery from TWITTER_SESSION_B64...');
      
      // Decode and write session
      const sessionData = Buffer.from(sessionB64, 'base64').toString('utf8');
      const sessionObj = JSON.parse(sessionData);
      
      // Validate session structure
      if (!sessionObj.cookies || !Array.isArray(sessionObj.cookies)) {
        return {
          attempted: true,
          successful: false,
          method: 'env_decode',
          error: 'Invalid session structure in TWITTER_SESSION_B64'
        };
      }

      // Write to session file
      const sessionPath = this.getSessionPath();
      this.ensureDirectoryExists(sessionPath);
      fs.writeFileSync(sessionPath, JSON.stringify(sessionObj, null, 2));
      
      console.log(`✅ Session recovered from environment (${sessionObj.cookies.length} cookies)`);
      
      // Test the recovered session
      const canPost = await this.testPostingCapability();
      
      return {
        attempted: true,
        successful: canPost,
        method: 'env_recovery'
      };

    } catch (error) {
      return {
        attempted: true,
        successful: false,
        method: 'env_recovery',
        error: error.message
      };
    }
  }

  /**
   * Attempt to regenerate session (placeholder for future implementation)
   */
  private async regenerateSession(): Promise<{ attempted: boolean; successful: boolean; method?: string; error?: string }> {
    // This would require stored credentials and automated login
    // For now, just return false
    return {
      attempted: true,
      successful: false,
      method: 'auto_regen',
      error: 'Automatic regeneration not implemented'
    };
  }

  /**
   * Provide manual recovery instructions
   */
  private provideManualRecoveryInstructions(): void {
    console.log('\n🔧 MANUAL TWITTER SESSION RECOVERY REQUIRED');
    console.log('=====================================');
    console.log('');
    console.log('Your Twitter session has expired. To fix this:');
    console.log('');
    console.log('1. 🌐 LOCAL DEVELOPMENT:');
    console.log('   npm run seed:session');
    console.log('   # Opens Playwright browser to login manually');
    console.log('');
    console.log('2. 🚄 RAILWAY DEPLOYMENT:');
    console.log('   # After running seed:session locally:');
    console.log('   npm run b64:x-session');
    console.log('   # Copy the base64 output to Railway environment variable TWITTER_SESSION_B64');
    console.log('');
    console.log('3. ⚡ QUICK TEST:');
    console.log('   npm run test:x-session');
    console.log('   # Verify session works before deploying');
    console.log('');
    console.log('The bot will continue running in read-only mode until session is fixed.');
    console.log('=====================================\n');
  }

  /**
   * Get session file path
   */
  private getSessionPath(): string {
    // Check multiple possible paths
    const paths = [
      '/app/data/twitter_session.json', // Railway path
      process.env.TWITTER_SESSION_PATH,
      path.join(process.cwd(), 'data', 'twitter_session.json'), // Local path
      './data/twitter_session.json'
    ].filter(Boolean);

    for (const sessionPath of paths) {
      if (fs.existsSync(sessionPath!)) {
        return sessionPath!;
      }
    }

    // Return default Railway path
    return '/app/data/twitter_session.json';
  }

  /**
   * Count cookies in session file
   */
  private getCookieCount(sessionPath: string): number {
    try {
      if (!fs.existsSync(sessionPath)) {
        return 0;
      }

      const sessionData = fs.readFileSync(sessionPath, 'utf8');
      const sessionObj = JSON.parse(sessionData);
      
      if (sessionObj.cookies && Array.isArray(sessionObj.cookies)) {
        return sessionObj.cookies.length;
      }

      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Ensure directory exists
   */
  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Create health result object
   */
  private createHealthResult(
    isValid: boolean, 
    canPost: boolean, 
    cookieCount: number,
    recovery: { attempted: boolean; successful: boolean; method?: string; error?: string }
  ): SessionHealth {
    return {
      isValid,
      canPost,
      lastCheck: new Date(),
      cookieCount,
      recovery
    };
  }

  /**
   * Get last health check result
   */
  public getLastHealthCheck(): SessionHealth | null {
    return this.lastHealthCheck;
  }

  /**
   * Reset recovery attempts (call after successful recovery)
   */
  public resetRecoveryAttempts(): void {
    this.recoveryAttempts = 0;
  }
}

/**
 * Enhanced post execution with session recovery
 */
export async function executePostWithRecovery<T>(
  postFunction: () => Promise<T>
): Promise<{ success: boolean; result?: T; error?: string; sessionHealth?: SessionHealth }> {
  
  const recovery = TwitterSessionRecovery.getInstance();
  
  try {
    // Try posting normally first
    const result = await postFunction();
    
    return {
      success: true,
      result
    };
    
  } catch (error) {
    const errorMessage = error.message;
    
    // Check if it's a login-related error
    if (errorMessage.includes('POST_SKIPPED_PLAYWRIGHT') || 
        errorMessage.includes('login_required') ||
        errorMessage.includes('LOGIN_CHECK')) {
      
      console.log('🔧 Detected login error, attempting recovery...');
      
      // Check session health
      const health = await recovery.checkSessionHealth();
      
      if (!health.canPost) {
        // Attempt recovery
        const recoveryResult = await recovery.attemptRecovery();
        
        if (recoveryResult.canPost) {
          console.log('✅ Session recovered, retrying post...');
          try {
            const result = await postFunction();
            recovery.resetRecoveryAttempts();
            return {
              success: true,
              result,
              sessionHealth: recoveryResult
            };
          } catch (retryError) {
            return {
              success: false,
              error: `Post failed after recovery: ${retryError.message}`,
              sessionHealth: recoveryResult
            };
          }
        } else {
          return {
            success: false,
            error: 'Session recovery failed',
            sessionHealth: recoveryResult
          };
        }
      } else {
        return {
          success: false,
          error: 'Login error but session appears healthy',
          sessionHealth: health
        };
      }
    } else {
      // Non-login related error
      return {
        success: false,
        error: errorMessage
      };
    }
  }
}

/**
 * Simple session health check for monitoring
 */
export async function quickSessionCheck(): Promise<{ healthy: boolean; cookieCount: number; message: string }> {
  const recovery = TwitterSessionRecovery.getInstance();
  
  try {
    const health = await recovery.checkSessionHealth();
    
    return {
      healthy: health.canPost,
      cookieCount: health.cookieCount,
      message: health.canPost ? 
        `Session healthy (${health.cookieCount} cookies)` :
        `Session unhealthy: ${health.recovery.error || 'Unknown issue'}`
    };
  } catch (error) {
    return {
      healthy: false,
      cookieCount: 0,
      message: `Health check failed: ${error.message}`
    };
  }
}